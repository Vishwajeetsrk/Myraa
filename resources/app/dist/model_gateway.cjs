'use strict';
/**
 * MYRAA Model Gateway (Phase 20).
 * Lane-based chat routing over providers the user actually owns:
 *   - openrouter_free  (env OPENROUTER_API_KEY; free-tier models only)
 *   - ollama_local     (http://127.0.0.1:11434, no key, offline lane)
 *   - openai_owned     (env OPENAI_API_KEY)
 *   - groq_owned       (env GROQ_API_KEY)
 * Pattern-level adoption from dsh-our-free-model (MIT): NO ported code, and
 * dsh's resold/commercial-channel subscribers are deliberately NOT provided.
 *
 * Honesty + safety rules:
 *   - every lane pins an explicit HOST allowlist (no SSRF via lane misuse)
 *   - keys are read from process.env only, never stored, never logged
 *   - a missing key is an honest AUTH_REQUIRED, never a silent error
 *   - offline/dead lane => WORKER_OFFLINE with reason; outcome only from responses
 *   - health info comes from real probes (dsh pattern), cached 60s
 *   - "token saver": history capped to last 10 messages / 2000 chars each
 *   - reply text capped (RES_TEXT_CAP)
 */

const OUTBOUND_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 5000;
const RES_TEXT_CAP = 4000;
const HISTORY_CAP = 10;
const PROBE_CACHE_MS = 60000;

const LANES = [
  {
    id: 'openrouter_free',
    label: 'OpenRouter free-tier models',
    host: 'openrouter.ai',
    keyEnv: 'OPENROUTER_API_KEY',
    probeUrl: 'https://openrouter.ai/api/v1/models',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
    style: 'openai',
  },
  {
    id: 'ollama_local',
    label: 'Ollama local (offline lane)',
    host: '127.0.0.1:11434',
    keyEnv: null,
    probeUrl: 'http://127.0.0.1:11434/api/tags',
    chatUrl: 'http://127.0.0.1:11434/api/chat',
    defaultModel: 'llama3.2',
    style: 'ollama',
  },
  {
    id: 'openai_owned',
    label: 'OpenAI (owned key)',
    host: 'api.openai.com',
    keyEnv: 'OPENAI_API_KEY',
    probeUrl: 'https://api.openai.com/v1/models',
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    style: 'openai',
  },
  {
    id: 'groq_owned',
    label: 'Groq (owned key)',
    host: 'api.groq.com',
    keyEnv: 'GROQ_API_KEY',
    probeUrl: 'https://api.groq.com/openai/v1/models',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.1-8b-instant',
    style: 'openai',
  },
];

const DEFAULT_CHAIN = ['openrouter_free', 'ollama_local', 'openai_owned', 'groq_owned'];
const OFFLINE_FIRST_CHAIN = ['ollama_local', 'openrouter_free', 'openai_owned', 'groq_owned'];
const probeCache = new Map();

function findLane(id) {
  const needle = String(id || '').trim().toLowerCase();
  return LANES.find((l) => l.id === needle) || null;
}

function laneKeyPresent(lane) {
  if (!lane.keyEnv) return { required: false, present: true };
  return { required: true, env: lane.keyEnv, present: Boolean(process.env[lane.keyEnv]) };
}

function chainFor(need, laneOverride) {
  if (laneOverride) {
    const lane = findLane(laneOverride);
    return lane ? [lane.id] : null;
  }
  return (need && String(need).toLowerCase() === 'offline' ? OFFLINE_FIRST_CHAIN : DEFAULT_CHAIN).slice();
}

function capMessages(messages) {
  const kept = (Array.isArray(messages) ? messages.filter((m) => m && typeof m.content === 'string' && m.content.trim()) : [])
    .map((m) => ({ role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user', content: m.content.trim().slice(0, 2000) }));
  return kept.slice(-HISTORY_CAP);
}

function buildChatRequest(lane, model, messages, opts) {
  const body = lane.style === 'ollama'
    ? { model: model || lane.defaultModel, messages: messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })), stream: false }
    : { model: model || lane.defaultModel, messages, max_tokens: (opts && opts.maxTokens) || 600 };
  return {
    url: lane.chatUrl,
    method: 'POST',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      lane.keyEnv && process.env[lane.keyEnv] ? { 'Authorization': 'Bearer ' + process.env[lane.keyEnv] } : {}
    ),
    body: JSON.stringify(body),
  };
}

function extractText(lane, json, rawText) {
  try {
    if (lane.style === 'ollama') return String(json.message && json.message.content || '').slice(0, RES_TEXT_CAP);
    const pick = json.choices && json.choices[0];
    return String((pick && pick.message && pick.message.content) || (pick && pick.text) || rawText || '').slice(0, RES_TEXT_CAP);
  } catch (e) {
    return String(rawText || '').slice(0, RES_TEXT_CAP);
  }
}

async function fetchWithTimeout(request, timeoutMs, opts) {
  const fetchFn = (opts && opts.fetchFn) || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, timeoutMs);
  try {
    return await fetchFn(request.url, {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: request.body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function validateLaneHost(lane, request) {
  let host;
  try { host = new URL(request.url).host; } catch (e) { return 'LANE_CONFIG'; }
  if (host !== lane.host) return 'LANE_CONFIG: host ' + host + ' is outside the lane allowlist (' + lane.host + ')';
  return null;
}

async function chat(customOpts, opts) {
  const options = customOpts || {};
  const chain = chainFor(options.need, options.lane);
  if (!chain) {
    return { ok: false, code: 'VALIDATION', error: 'unknown lane: ' + options.lane + ' (lanes: ' + LANES.map((l) => l.id).join(', ') + ')' };
  }
  const messages = capMessages(options.messages);
  if (!messages.length) return { ok: false, code: 'VALIDATION', error: 'messages are required (at least one user/content string)' };
  const attempts = [];
  for (const laneId of chain) {
    const lane = findLane(laneId);
    if (!lane) continue;
    const keyState = laneKeyPresent(lane);
    if (keyState.required && !keyState.present) {
      attempts.push({ lane: lane.id, code: 'AUTH_REQUIRED', error: 'set env ' + lane.keyEnv });
      continue;
    }
    const request = buildChatRequest(lane, options.model, messages, options);
    const hostErr = validateLaneHost(lane, request);
    if (hostErr) { attempts.push({ lane: lane.id, code: 'LANE_CONFIG', error: hostErr }); continue; }
    try {
      const r = await fetchWithTimeout(request, OUTBOUND_TIMEOUT_MS, opts);
      const raw = await r.text();
      if (!r.ok) {
        attempts.push({ lane: lane.id, code: 'REMOTE_ERROR', error: 'HTTP ' + r.status + ': ' + raw.slice(0, 160) });
        continue;
      }
      let json;
      try { json = JSON.parse(raw); } catch (e) {
        attempts.push({ lane: lane.id, code: 'REMOTE_ERROR', error: 'non-json reply' });
        continue;
      }
      const text = extractText(lane, json, raw);
      if (!text.trim()) {
        attempts.push({ lane: lane.id, code: 'REMOTE_ERROR', error: 'empty completion text' });
        continue;
      }
      return {
        ok: true,
        lane: lane.id,
        model: options.model || lane.defaultModel,
        text,
        attempts,
        capped: 'text capped at ' + RES_TEXT_CAP + ' chars; history last ' + HISTORY_CAP,
      };
    } catch (e) {
      attempts.push({ lane: lane.id, code: 'WORKER_OFFLINE', error: 'lane unreachable (' + String((e && e.message) || e).slice(0, 120) + ')' });
    }
  }
  return {
    ok: false,
    code: 'NO_PROVIDER',
    error: 'no chat lane answered (attempts below). Set an owned key env or start Ollama for the offline lane.',
    attempts,
  };
}

async function probeLane(laneId, opts) {
  const lane = findLane(laneId);
  if (!lane) return { ok: false, code: 'VALIDATION', error: 'unknown lane: ' + laneId };
  const cached = probeCache.get(lane.id);
  const now = Date.now();
  if (cached && now - cached.at < PROBE_CACHE_MS) return Object.assign({}, cached.value, { cached: true, checkedAt: new Date(cached.at).toISOString() });
  const keyState = laneKeyPresent(lane);
  if (keyState.required && !keyState.present) {
    const value = { ok: false, lane: lane.id, state: 'AUTH_REQUIRED', error: 'env ' + lane.keyEnv + ' not set' };
    probeCache.set(lane.id, { at: now, value });
    return value;
  }
  const request = { url: lane.probeUrl, method: 'GET', headers: lane.keyEnv && process.env[lane.keyEnv] ? { 'Authorization': 'Bearer ' + process.env[lane.keyEnv] } : {} };
  const hostErr = validateLaneHost(lane, request);
  if (hostErr) { const value = { ok: false, lane: lane.id, state: 'LANE_CONFIG', error: hostErr }; probeCache.set(lane.id, { at: now, value }); return value; }
  try {
    const r = await fetchWithTimeout(request, PROBE_TIMEOUT_MS, opts);
    const raw = await r.text();
    let extra = '';
    if (r.ok && lane.style === 'ollama') {
      try { const j = JSON.parse(raw); const names = (j.models || []).map((m) => String(m.name || m.model || '').split(':')[0]).filter(Boolean).slice(0, 12); if (names.length) extra = ' models: ' + names.join(', '); } catch (e) {}
    }
    const value = { ok: r.ok, lane: lane.id, state: r.ok ? 'ONLINE' : 'DEGRADED', code: 'HTTP ' + r.status, sample: extra || undefined };
    if (!r.ok) { value.error = raw.slice(0, 160); }
    probeCache.set(lane.id, { at: now, value });
    return value;
  } catch (e) {
    const value = { ok: false, lane: lane.id, state: 'OFFLINE', error: 'unreachable (' + String((e && e.message) || e).slice(0, 120) + ')' };
    probeCache.set(lane.id, { at: now, value });
    return value;
  }
}

async function probeAll(opts) {
  const out = [];
  for (const l of LANES) out.push(await probeLane(l.id, opts));
  return { ok: true, lanes: out, chainDefault: DEFAULT_CHAIN, checkedAt: new Date().toISOString() };
}

function status(opts) {
  return {
    ok: true,
    lanes: LANES.map((l) => ({ id: l.id, host: l.host, keyEnv: l.keyEnv, keyEnvPresent: l.keyEnv ? Boolean(process.env[l.keyEnv]) : undefined, model: l.defaultModel })),
    chainDefault: DEFAULT_CHAIN.join(' -> '),
    chainOfflineFirst: OFFLINE_FIRST_CHAIN.join(' -> '),
    policy: 'owned keys (env-only), free tiers, local runtimes; resold/commercial channels are not provided',
    caps: { textCap: RES_TEXT_CAP, historyCap: HISTORY_CAP, probeCacheMs: PROBE_CACHE_MS },
  };
}

function registerAgiTools(toolEngine, opts) {
  const mounted = [];
  try {
    toolEngine.register('gateway_chat', {
      fn: async (params, runtimeOpts) => chat({ messages: params && params.messages, lane: params && params.lane, model: params && params.model, need: params && params.need }, runtimeOpts || opts),
      risk: 'LOW',
      timeout: OUTBOUND_TIMEOUT_MS + 5000,
      category: 'gateway',
    });
    mounted.push('gateway_chat');
    toolEngine.register('gateway_probe', {
      fn: async () => probeAll(opts),
      risk: 'LOW',
      timeout: PROBE_TIMEOUT_MS * LANES.length + 2000,
      category: 'gateway',
    });
    mounted.push('gateway_probe');
  } catch (e) { /* registry may already hold names: honest no-op */ }
  return { ok: true, mounted, count: mounted.length };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    const st = status({});
    res.json({ version: '20.0.0', ...st });
  });
  router.get('/probe', async (req, res) => {
    try {
      const result = req.query.lane ? await probeLane(req.query.lane) : await probeAll();
      res.json({ version: '20.0.0', ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'probe failed' });
    }
  });
  router.post('/chat', async (req, res) => {
    try {
      const result = await chat({ messages: (req.body && req.body.messages) || [], lane: req.body && req.body.lane, model: req.body && req.body.model, need: req.body && req.body.need });
      const code = result.ok ? 200 : result.code === 'VALIDATION' ? 400 : 503;
      res.status(code).json({ version: '20.0.0', ...result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'chat failed' });
    }
  });
  return router;
}

function clearProbeCache() { probeCache.clear(); return { ok: true }; }

module.exports = {
  LANES, DEFAULT_CHAIN, OFFLINE_FIRST_CHAIN, RES_TEXT_CAP, HISTORY_CAP,
  findLane, chainFor, capMessages, buildChatRequest, extractText, validateLaneHost,
  chat, probeLane, probeAll, status, registerAgiTools, createRouter, clearProbeCache,
};
