/**
 * MYRAA AI OS — Canonical AI Gateway Service
 * Supports: Google Gemini, Anthropic Claude, OpenAI, xAI Grok, DeepSeek, Ollama
 * Features: circuit-breaker cascade failover, token cost tracking, streaming
 */

"use strict";

const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");

// ─── Provider cost table (USD per 1M tokens, input/output) ───────────────────
const COST_TABLE = {
  "gemini-3.5-flash":       { in: 0.075,  out: 0.30  },
  "gemini-2.5-flash":       { in: 0.075,  out: 0.30  },
  "gemini-2.5-pro":         { in: 1.25,   out: 5.00  },
  "claude-opus-4-5":        { in: 15.00,  out: 75.00 },
  "claude-sonnet-4-5":      { in: 3.00,   out: 15.00 },
  "claude-haiku-3-5":       { in: 0.80,   out: 4.00  },
  "gpt-4o":                 { in: 2.50,   out: 10.00 },
  "gpt-4o-mini":            { in: 0.15,   out: 0.60  },
  "grok-3":                 { in: 3.00,   out: 15.00 },
  "deepseek-chat":          { in: 0.27,   out: 1.10  },
  "ollama/llama3":          { in: 0.00,   out: 0.00  },
};

// ─── Circuit Breaker states ───────────────────────────────────────────────────
const CB_CLOSED = "CLOSED";       // normal
const CB_OPEN   = "OPEN";         // tripped — skip this provider
const CB_HALF   = "HALF_OPEN";    // probing — allow 1 request

class CircuitBreaker {
  constructor(name, opts = {}) {
    this.name = name;
    this.state = CB_CLOSED;
    this.failures = 0;
    this.threshold = opts.threshold || 3;
    this.cooldownMs = opts.cooldownMs || 30_000;
    this.openAt = 0;
  }
  isAvailable() {
    if (this.state === CB_CLOSED) return true;
    if (this.state === CB_OPEN) {
      if (Date.now() - this.openAt >= this.cooldownMs) {
        this.state = CB_HALF;
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }
  success() {
    this.failures = 0;
    this.state = CB_CLOSED;
  }
  failure() {
    this.failures++;
    if (this.state === CB_HALF || this.failures >= this.threshold) {
      this.state = CB_OPEN;
      this.openAt = Date.now();
      console.warn(`[Gateway] CircuitBreaker tripped for provider — will retry in ${this.cooldownMs / 1000}s`);
    }
  }
}

// ─── Provider Adapters ────────────────────────────────────────────────────────

async function callGemini({ model, messages, apiKey, stream, onChunk }) {
  const { GoogleGenAI } = require("@google/genai");
  const client = new GoogleGenAI({ apiKey });
  const contents = messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  if (stream) {
    const result = await client.models.generateContentStream({ model, contents });
    let text = "";
    for await (const chunk of result) {
      const t = chunk.text ?? "";
      text += t;
      if (t && onChunk) onChunk(t);
    }
    return { text, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const result = await client.models.generateContent({ model, contents });
  return { text: result.text, usage: { inputTokens: result.usageMetadata?.promptTokenCount || 0, outputTokens: result.usageMetadata?.candidatesTokenCount || 0 } };
}

async function callAnthropic({ model, messages, apiKey, stream, onChunk }) {
  let Anthropic;
  try { Anthropic = require("@anthropic-ai/sdk"); } catch { throw new Error("@anthropic-ai/sdk not installed"); }
  const client = new Anthropic.default({ apiKey });
  const sysMsgs = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  const convMsgs = messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
  if (stream) {
    let text = "";
    const s = await client.messages.stream({ model, max_tokens: 8192, system: sysMsgs || undefined, messages: convMsgs });
    for await (const event of s) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        text += event.delta.text;
        if (onChunk) onChunk(event.delta.text);
      }
    }
    const final = await s.finalMessage();
    return { text, usage: { inputTokens: final.usage?.input_tokens || 0, outputTokens: final.usage?.output_tokens || 0 } };
  }
  const resp = await client.messages.create({ model, max_tokens: 8192, system: sysMsgs || undefined, messages: convMsgs });
  return { text: resp.content[0]?.text || "", usage: { inputTokens: resp.usage?.input_tokens || 0, outputTokens: resp.usage?.output_tokens || 0 } };
}

async function callOpenAI({ model, messages, apiKey, baseURL, stream, onChunk }) {
  let OpenAI;
  try { OpenAI = require("openai"); } catch { throw new Error("openai not installed"); }
  const client = new OpenAI.default({ apiKey, baseURL });
  if (stream) {
    let text = "";
    const s = await client.chat.completions.create({ model, messages, stream: true });
    for await (const chunk of s) {
      const t = chunk.choices[0]?.delta?.content || "";
      text += t;
      if (t && onChunk) onChunk(t);
    }
    return { text, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const resp = await client.chat.completions.create({ model, messages });
  return { text: resp.choices[0]?.message?.content || "", usage: { inputTokens: resp.usage?.prompt_tokens || 0, outputTokens: resp.usage?.completion_tokens || 0 } };
}

async function callOllama({ model, messages, stream, onChunk }) {
  let ollama;
  try { ollama = require("ollama"); } catch { throw new Error("ollama not installed"); }
  const client = new ollama.Ollama();
  if (stream) {
    const s = await client.chat({ model, messages, stream: true });
    let text = "";
    for await (const chunk of s) {
      const t = chunk.message?.content || "";
      text += t;
      if (t && onChunk) onChunk(t);
    }
    return { text, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const resp = await client.chat({ model, messages });
  return { text: resp.message?.content || "", usage: { inputTokens: 0, outputTokens: 0 } };
}

// ─── Gateway Class ────────────────────────────────────────────────────────────

class AIGateway extends EventEmitter {
  constructor() {
    super();
    this._breakers = {};
    this._costLog = [];
    this._totalCostUSD = 0;
    this._statsFile = path.join(__dirname, "../data/gateway_stats.json");
    this._loadStats();
  }

  _loadStats() {
    try {
      if (fs.existsSync(this._statsFile)) {
        const d = JSON.parse(fs.readFileSync(this._statsFile, "utf8"));
        this._totalCostUSD = d.totalCostUSD || 0;
        this._costLog = d.recentCalls || [];
      }
    } catch { /* ignore */ }
  }

  _saveStats() {
    try {
      fs.mkdirSync(path.dirname(this._statsFile), { recursive: true });
      fs.writeFileSync(this._statsFile, JSON.stringify({ totalCostUSD: this._totalCostUSD, recentCalls: this._costLog.slice(-200) }, null, 2));
    } catch { /* ignore */ }
  }

  _breaker(name) {
    if (!this._breakers[name]) this._breakers[name] = new CircuitBreaker(name);
    return this._breakers[name];
  }

  _trackCost(provider, model, usage) {
    const table = COST_TABLE[model] || { in: 0, out: 0 };
    const costUSD = ((usage.inputTokens || 0) * table.in + (usage.outputTokens || 0) * table.out) / 1_000_000;
    this._totalCostUSD += costUSD;
    const entry = { ts: Date.now(), provider, model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUSD };
    this._costLog.push(entry);
    this.emit("cost", entry);
    this._saveStats();
    return costUSD;
  }

  /**
   * Build an ordered list of providers to try for a given request.
   * Config comes from environment variables or explicit overrides.
   */
  _buildProviderChain(opts) {
    const primary = opts.provider || (process.env.MYRAA_AI_PROVIDER || "gemini").toLowerCase();
    const chain = [];

    const addGemini = (model) => chain.push({ id: "gemini", model: model || opts.model || process.env.MYRAA_FAST_MODEL || "gemini-3.5-flash", fn: callGemini, keyFn: () => process.env.GEMINI_API_KEY || opts.geminiKey });
    const addAnthropic = (model) => chain.push({ id: "anthropic", model: model || opts.model || "claude-haiku-3-5", fn: callAnthropic, keyFn: () => process.env.ANTHROPIC_API_KEY || opts.anthropicKey });
    const addOpenAI = (model) => chain.push({ id: "openai", model: model || opts.model || "gpt-4o-mini", fn: callOpenAI, keyFn: () => process.env.OPENAI_API_KEY || opts.openaiKey });
    const addGrok = (model) => chain.push({ id: "grok", model: model || "grok-3", fn: callOpenAI, keyFn: () => process.env.XAI_API_KEY || opts.xaiKey, baseURL: "https://api.x.ai/v1" });
    const addDeepSeek = (model) => chain.push({ id: "deepseek", model: model || "deepseek-chat", fn: callOpenAI, keyFn: () => process.env.DEEPSEEK_API_KEY || opts.deepseekKey, baseURL: "https://api.deepseek.com/v1" });
    const addOllama = (model) => chain.push({ id: "ollama", model: model || process.env.OLLAMA_MODEL || "llama3", fn: callOllama, keyFn: () => null });

    switch (primary) {
      case "anthropic": addAnthropic(); addGemini(); addOllama(); break;
      case "openai":    addOpenAI(); addGemini(); addOllama(); break;
      case "grok":      addGrok(); addGemini(); addOllama(); break;
      case "deepseek":  addDeepSeek(); addGemini(); addOllama(); break;
      case "ollama":    addOllama(); addGemini(); break;
      default:          addGemini(); addAnthropic(); addOllama(); break; // gemini first
    }
    return chain;
  }

  /**
   * Core inference call with cascade failover.
   * @param {object} opts
   * @param {string} opts.provider - primary provider name
   * @param {string} opts.model - model name override
   * @param {Array}  opts.messages - [{role,content}]
   * @param {boolean} opts.stream - enable streaming
   * @param {Function} opts.onChunk - called per streamed token
   */
  async call(opts) {
    const chain = this._buildProviderChain(opts);
    let lastError;
    for (const p of chain) {
      const cb = this._breaker(p.id);
      if (!cb.isAvailable()) {
        console.log(`[Gateway] Skipping ${p.id} — circuit open`);
        continue;
      }
      const apiKey = p.keyFn();
      if (!apiKey && p.id !== "ollama") {
        console.log(`[Gateway] Skipping ${p.id} — no API key`);
        continue;
      }
      try {
        console.log(`[Gateway] → ${p.id}/${p.model}`);
        const result = await p.fn({
          model: p.model,
          messages: opts.messages,
          apiKey,
          baseURL: p.baseURL,
          stream: opts.stream,
          onChunk: opts.onChunk,
        });
        cb.success();
        const cost = this._trackCost(p.id, p.model, result.usage || {});
        this.emit("response", { provider: p.id, model: p.model, cost, text: result.text });
        return { text: result.text, provider: p.id, model: p.model, cost, usage: result.usage };
      } catch (err) {
        console.error(`[Gateway] ${p.id} failed:`, err.message);
        cb.failure();
        lastError = err;
      }
    }
    throw lastError || new Error("All providers failed");
  }

  /**
   * Get current cost statistics
   */
  getStats() {
    return {
      totalCostUSD: this._totalCostUSD,
      recentCalls: this._costLog.slice(-20),
      circuitBreakers: Object.fromEntries(
        Object.entries(this._breakers).map(([k, v]) => [k, { state: v.state, failures: v.failures }])
      ),
    };
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetBreaker(providerId) {
    if (this._breakers[providerId]) {
      this._breakers[providerId].state = CB_CLOSED;
      this._breakers[providerId].failures = 0;
    }
  }
}

// Singleton
const gateway = new AIGateway();
module.exports = gateway;
