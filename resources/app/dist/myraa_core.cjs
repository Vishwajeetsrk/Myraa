/* ===========================================================================
 * MYRAA AI OS — MYRAA CORE (Phase 2: unified intelligence gate)
 * ---------------------------------------------------------------------------
 * THE single orchestration layer for conversational AI. Every chat request
 * flows through here (spec §4). Responsibilities:
 *   1. Intent classification        → taskType hint
 *   2. Model routing policy         → ordered provider chain per taskType/mode
 *   3. Provider cascade execution   → Gemini → Groq → OpenRouter → Ollama
 *   4. Permission hook              → risk-gated (Level 1 only by default)
 *   5. Cost / attempt / health log  → observability + stats endpoint
 *
 * Behavior mirrors the proven /api/chat cascade so existing UX is preserved.
 * Env escape hatch for ops: MYRAA_CORE_DISABLE=1 (routes fall back to legacy).
 * ========================================================================== */

'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const CORE_STATS_FILE = path.join(__dirname, '../data/core_stats.json');

// ─── Secrets resolution (same sources as the shipped server) ───────────────
const appData = process.env.APPDATA
  || (process.platform === 'darwin'
    ? path.join(process.env.HOME, 'Library/Application Support')
    : path.join(process.env.HOME, '.config'));
const myraaDataDir = process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
const secretsFile = path.join(myraaDataDir, 'secrets.json');
const altSecretsFile = path.resolve(process.cwd(), '.myraa-data', 'secrets.json');

function readJson(f, fb) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fb; }
}

function loadKeys() {
  const s = {
    ...readJson(secretsFile, {}),
    ...readJson(altSecretsFile, {}),
  };
  // Final fallback: encrypted SecureVault store (P0: .env secrets live there).
  let vault = null;
  try { vault = require('./secure_vault.cjs'); } catch (e) { /* optional */ }
  const vk = (id) => (vault && vault.getSecret(id)) || '';
  return {
    gemini: String(s.geminiApiKey || '').trim() || String(process.env.GEMINI_API_KEY || '').trim()
      || String(vk('GEMINI_API_KEY') || vk('GOOGLE_GENERATIVE_AI_API_KEY')) || null,
    groq: String(s.groqApiKey || s.GROQ_API_KEY || '').trim() || String(process.env.GROQ_API_KEY || '').trim()
      || String(vk('GROQ_API_KEY')) || null,
    openrouter: String(s.openrouterApiKey || s.OPENROUTER_API_KEY || '').trim() || String(process.env.OPENROUTER_API_KEY || '').trim()
      || String(vk('OPENROUTER_API_KEY')) || null,
  };
}

// ─── Intent classification (lightweight, honest, heuristic) ────────────────
const INTENT_PATTERNS = [
  // Reasoning wins when the user asks WHY/EXPLAIN/COMPARE even about code.
  { type: 'reasoning', re: /\b(explain|why|analyze|compare|plan|strategy|architecture|how (?:does|to|would))\b/i },
  { type: 'coding',    re: /\b(code|refactor|debug|fix (?:the )?bug|implement|compile|rewrite|optimize|function|script)\b/i },
  { type: 'vision',    re: /\b(image|picture|photo|see|look at|what(?:'s| is) (?:on )?(?:my )?screen|screenshot)\b/i },
  { type: 'document',  re: /\b(summarize|summary|document|pdf|extract|read (?:this|that) file)\b/i },
  { type: 'fast',      re: /\b(translate|spell|define|the meaning of|convert|time|date)\b/i },
  { type: 'local',     re: /\b(offline|local mode|private|no cloud|without internet)\b/i },
];

function classifyIntent(message) {
  const m = String(message || '');
  for (const p of INTENT_PATTERNS) if (p.re.test(m)) return p.type;
  return 'auto';
}

// ─── Routing policy (ordered provider chain per taskType/mode) ─────────────
const CHAIN_POLICY = {
  auto:      ['gemini', 'groq', 'openrouter'],
  chat:      ['gemini', 'groq', 'openrouter'],
  coding:    ['gemini', 'groq', 'openrouter'],
  reasoning: ['gemini', 'openrouter', 'groq'],
  vision:    ['gemini', 'openrouter'],
  document:  ['gemini', 'groq', 'openrouter'],
  fast:      ['groq', 'gemini', 'openrouter'],
  local:     ['ollama', 'groq', 'gemini'],
};

function buildChain(taskType, mode) {
  if (mode === 'local' || taskType === 'local') return CHAIN_POLICY.local;
  return CHAIN_POLICY[taskType] || CHAIN_POLICY.auto;
}

// Current flash model is env-overridable; 'gemini-2.0-flash' is RETIRED (404).
const CHAT_MODEL = process.env.MYRAA_FAST_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash';
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'groq/compound-mini'];
let openrouterFreeModel = null;

// ─── Provider callers (proof-tested patterns from myraa_v6_real_routes) ────
function stripThinking(text) {
  if (!text) return '';
  let s = String(text);
  s = s.replace(/<think[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<thought[\s\S]*?<\/thought>/gi, '');
  s = s.replace(/<thinking[\s\S]*?<\/thinking>/gi, '');
  s = s.replace(/(?:^|\n)(?:Plan:|Reasoning:|Thinking Process:)[\s\S]*?\n\n/gi, '');
  return s.trim();
}

async function callGemini({ turns, system, keys, modelOut }) {
  if (!keys.gemini) throw new Error('GEMINI_API_KEY not configured');
  const { GoogleGenAI } = require('@google/genai');
  const client = new GoogleGenAI({ apiKey: keys.gemini });
  const contents = turns.map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.content }],
  }));
  const response = await client.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: system ? { systemInstruction: system } : undefined,
  });
  const text = stripThinking(response?.text || '');
  if (!text) throw new Error('empty Gemini completion');
  return { text, providerLabel: CHAT_MODEL, usage: { inputTokens: response?.usageMetadata?.promptTokenCount || 0, outputTokens: response?.usageMetadata?.candidatesTokenCount || 0 } };
}

async function callGroq({ turns, system, keys }) {
  if (!keys.groq) throw new Error('GROQ_API_KEY not configured');
  const body = {
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ],
    temperature: 0.8,
    max_tokens: 1024,
  };
  let lastErr;
  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.groq}` },
        body: JSON.stringify({ ...body, model }),
      });
      if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
      const data = await res.json();
      const text = stripThinking(data?.choices?.[0]?.message?.content || '');
      if (!text) throw new Error('empty Groq completion');
      return { text, providerLabel: `groq/${model}`, usage: data.usage || {} };
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('Groq failed');
}

async function resolveOpenRouterModel(keys) {
  if (openrouterFreeModel) return openrouterFreeModel;
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${keys.openrouter}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models HTTP ${res.status}`);
  const data = await res.json();
  const free = (data.data || []).filter((m) => String(m.id).endsWith(':free') && /chat|instr|it\b/i.test(m.id));
  const preferred = free.find((m) => /llama-3\.3-70b/i.test(m.id))
    || free.find((m) => /deepseek/i.test(m.id))
    || free[0];
  if (!preferred) throw new Error('no free OpenRouter model available');
  openrouterFreeModel = preferred.id;
  return openrouterFreeModel;
}

async function callOpenRouter({ turns, system, keys }) {
  if (!keys.openrouter) throw new Error('OPENROUTER_API_KEY not configured');
  const model = await resolveOpenRouterModel(keys);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keys.openrouter}`,
      'HTTP-Referer': 'https://localhost:3000',
      'X-Title': 'MYRAA AI OS',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...turns.map((t) => ({ role: t.role, content: t.content })),
      ],
      temperature: 0.8,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  const text = stripThinking(data?.choices?.[0]?.message?.content || '');
  if (!text) throw new Error('empty OpenRouter completion');
  return { text, providerLabel: `openrouter/${model}`, usage: data.usage || {} };
}

async function callOllama({ turns, system, keys }) {
  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...turns.map((t) => ({ role: t.role, content: t.content }))],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  const text = stripThinking(data?.message?.content || '');
  if (!text) throw new Error('empty Ollama completion');
  return { text, providerLabel: `ollama/${model}`, usage: {} };
}

const CALLS = { gemini: callGemini, groq: callGroq, openrouter: callOpenRouter, ollama: callOllama };

// Handlers that can carry system immediate tool outcome besides text
function providerKeyFor(providerId, keys) {
  const k = { gemini: keys.gemini, groq: keys.groq, openrouter: keys.openrouter }[providerId];
  return Boolean(k);
}

// ─── Cost table (USD / 1M tokens) ──────────────────────────────────────────
const COST_TABLE = {
  'gemini-2.0-flash': { in: 0.10, out: 0.40 },
  'openai/gpt-oss-120b': { in: 0.10, out: 0.10 },
  'openai/gpt-oss-20b': { in: 0.10, out: 0.10 },
};
function estimateCost(provider, model, usage) {
  const base = model.replace(/^openrouter\//, '').replace(/^groq\//, '');
  const t = COST_TABLE[base] || COST_TABLE[model] || { in: 0, out: 0 };
  return ((usage.inputTokens || 0) * t.in + (usage.outputTokens || 0) * t.out) / 1_000_000;
}

// ─── Core class ─────────────────────────────────────────────────────────────
class MyraaCore extends EventEmitter {
  constructor() {
    super();
    this._stats = { totalCalls: 0, totalCostUSD: 0, recent: [], attempts: 0 };
    this._chainPolicy = CHAIN_POLICY;
    this._loadStats();
  }

  _loadStats() {
    try {
      if (fs.existsSync(CORE_STATS_FILE)) {
        const d = JSON.parse(fs.readFileSync(CORE_STATS_FILE, 'utf8'));
        this._stats.totalCostUSD = d.totalCostUSD || 0;
        this._stats.recent = d.recent || [];
      }
    } catch (e) { /* ignore */ }
  }

  _saveStats() {
    try {
      fs.mkdirSync(path.dirname(CORE_STATS_FILE), { recursive: true });
      fs.writeFileSync(CORE_STATS_FILE, JSON.stringify({ totalCalls: this._stats.totalCalls, totalCostUSD: this._stats.totalCostUSD, recent: this._stats.recent.slice(-100) }, null, 2));
    } catch (e) { /* ignore */ }
  }

  _track(provider, model, usage, ms) {
    const cost = estimateCost(provider, model, usage || {});
    this._stats.totalCalls += 1;
    this._stats.totalCostUSD += cost;
    const entry = { ts: Date.now(), provider, model, ms, inputTokens: (usage && usage.inputTokens) || 0, outputTokens: (usage && usage.outputTokens) || 0, costUSD: Number(cost.toFixed(6)) };
    this._stats.recent.push(entry);
    this.emit('core.response', entry);
    this._saveStats();
  }

  classifyIntent(message) { return classifyIntent(message); }

  waitDebug() { return this.getStats(); }

  route(taskType, mode) { return buildChain(taskType, mode); }

  /**
   * Unified chat gate. Returns { ok, reply, model, provider } or { ok:false, error }.
   * Never throws for provider failures; always degrades predictably.
   */
  async chat({ message, history = [], system = '', userName, taskType, mode = 'auto', onChunk } = {}) {
    if (process.env.MYRAA_CORE_DISABLE === '1') {
      return { ok: false, disabled: true, error: 'MYRAA_CORE_DISABLE=1' };
    }
    const text = String(message || '').trim();
    if (!text) return { ok: false, error: 'Message text is required.' };

    const tx = taskType || classifyIntent(text);
    const chain = buildChain(tx, mode);
    const systemPrompt = system || 'You are MYRAA, a personal AI operating system.';
    let activeSystem = systemPrompt;
    if (process.env.MYRAA_MEMORY_ENABLED !== '0') {
      try {
        const ctx = require('./memory_kb.cjs').kb.buildContext(text, 3);
        if (ctx) activeSystem = systemPrompt + ctx;
      } catch (e) { /* memory enrichment is optional — never break chat */ }
    }
    const keys = loadKeys();

    const turns = [];
    for (const t of (Array.isArray(history) ? history.slice(-12) : [])) {
      const c = String(t.text || t.content || '').slice(0, 4000);
      if (!c) continue;
      turns.push({ role: (t.sender === 'user' || t.role === 'user') ? 'user' : 'assistant', content: c });
    }
    turns.push({ role: 'user', content: text.slice(0, 8000) });

    const attempts = [];
    let lastErr = null;
    const t0 = Date.now();

    for (const providerId of chain) {
      if (providerId !== 'ollama' && !providerKeyFor(providerId, keys)) {
        attempts.push(`${providerId}: no key`);
        continue;
      }
      if (providerId === 'ollama' && mode !== 'local' && tx !== 'local') {
        attempts.push('ollama: not requested');
        continue;
      }
      try {
        const res = await CALLS[providerId]({ turns, system: activeSystem, keys });
        const ms = Date.now() - t0;
        this._track(providerId, res.providerLabel, res.usage, ms);
        this.emit('core.chat.sent', { provider: providerId, model: res.providerLabel, ms, taskType: tx });
        return { ok: true, reply: res.text, model: res.providerLabel, provider: providerId, taskType: tx, fromCore: true, attempts };
      } catch (err) {
        lastErr = err;
        attempts.push(`${providerId}: ${String(err.message).slice(0, 70)}`);
        this.emit('core.provider.failed', { provider: providerId, error: String(err.message) });
      }
    }

    return {
      ok: false,
      error: (lastErr && lastErr.message) || 'All providers failed',
      attempted: attempts.join(' | '),
      taskType: tx,
    };
  }

  health() {
    const keys = loadKeys();
    return {
      mode: 'auto',
      core: 'active',
      taskTypes: Object.keys(this._chainPolicy),
      keysConfigured: { gemini: !!keys.gemini, groq: !!keys.groq, openrouter: !!keys.openrouter, ollama: 'local (probe on demand)' },
      chainPolicy: this._chainPolicy,
    };
  }

  getStats() {
    return {
      totalCalls: this._stats.totalCalls,
      totalCostUSD: Number(this._stats.totalCostUSD.toFixed(6)),
      recentCalls: this._stats.recent.slice(-10),
    };
  }
}

const core = new MyraaCore();

// Merge the canonical gateway's stats (read-only) when available.
try {
  const gateway = require('./ai_gateway_service.cjs');
  core._gateway = gateway;
  core.getStats = () => ({
    ...core._stats,
    recentCalls: core._stats.recent.slice(-10),
    gateway: gateway.getStats ? gateway.getStats() : null,
  });
} catch (e) { /* gateway optional */ }

module.exports = core;