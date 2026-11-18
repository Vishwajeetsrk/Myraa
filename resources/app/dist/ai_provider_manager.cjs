'use strict';
/**
 * MYRAA AI Provider Manager (Phase 4).
 * ONE abstraction over real providers. It reuses the existing model gateway
 * lanes instead of duplicating HTTP logic. Every capability flag is a fact
 * about the adapter, not a claim that an unimplemented method works.
 * Keys are read from env only and are NEVER returned by any API here.
 */
const gateway = require('./model_gateway.cjs');
const registry = require('./agi/capability_registry.cjs');

const ADAPTERS = [
  {
    id: 'gemini', label: 'Google Gemini', keyEnv: 'GEMINI_API_KEY',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    capabilities: { chat: true, stream: true, tools: true, structuredOutput: true, vision: true, audio: true, realtime: true, embed: true, transcribe: false, speak: false },
    implemented: { chat: false, listModels: true, probe: true },
    contextWindow: 'model-dependent',
  },
  {
    id: 'anthropic', label: 'Anthropic Claude', keyEnv: 'ANTHROPIC_API_KEY',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    capabilities: { chat: true, stream: true, tools: true, structuredOutput: true, vision: true, audio: false, realtime: false, embed: false, transcribe: false, speak: false },
    implemented: { chat: false, listModels: true, probe: true },
    contextWindow: 'model-dependent',
  },
  ...gateway.LANES.map((lane) => ({
    id: lane.id === 'openrouter_free' ? 'openrouter' : lane.id === 'openai_owned' ? 'openai' : lane.id === 'groq_owned' ? 'groq' : 'ollama',
    laneId: lane.id,
    label: lane.label,
    keyEnv: lane.keyEnv,
    modelsUrl: lane.probeUrl,
    capabilities: {
      chat: true, stream: false, tools: false, structuredOutput: false,
      vision: false, audio: false, realtime: false, embed: false, transcribe: false, speak: false,
    },
    implemented: { chat: true, listModels: lane.style === 'ollama' || lane.id === 'openrouter_free' || lane.id === 'openai_owned' || lane.id === 'groq_owned', probe: true },
    contextWindow: 'model-dependent',
  })),
];

function find(id) { return ADAPTERS.find((a) => a.id === String(id || '').toLowerCase()) || null; }
function configured(a) { return !a.keyEnv || !!process.env[a.keyEnv]; }

function publicAdapter(a) {
  return {
    id: a.id,
    label: a.label,
    configured: configured(a),
    keyRequired: !!a.keyEnv,
    keyEnv: a.keyEnv || null,
    modelsUrl: a.modelsUrl || null,
    capabilities: Object.assign({}, a.capabilities),
    implemented: Object.assign({}, a.implemented),
    contextWindow: a.contextWindow,
    source: a.laneId ? 'model_gateway.lane' : 'ai_provider_manager.adapter',
  };
}
function listAdapters() { return ADAPTERS.map(publicAdapter); }

async function boundedFetch(url, headers, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, Number(timeoutMs) || 5000));
  try { return await fetch(url, { headers: headers || {}, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function probe(id, opts) {
  const a = find(id);
  if (!a) return { ok: false, code: 'VALIDATION', error: 'unknown provider' };
  const t0 = Date.now();
  if (!configured(a)) {
    return { ok: false, serviceId: a.id, status: registry.STATUS.AUTH_REQUIRED, latencyMs: Date.now() - t0, checkedAt: new Date().toISOString(), error: 'set env ' + a.keyEnv };
  }
  if (a.laneId) {
    const p = await gateway.probeLane(a.laneId, opts);
    const status = p.state === 'ONLINE' ? registry.STATUS.READY
      : p.state === 'AUTH_REQUIRED' ? registry.STATUS.AUTH_REQUIRED
        : p.state === 'OFFLINE' ? registry.STATUS.UNAVAILABLE
          : p.state === 'DEGRADED' ? registry.STATUS.DEGRADED : registry.STATUS.ERROR;
    return {
      ok: p.ok === true, serviceId: a.id, status,
      latencyMs: Date.now() - t0, checkedAt: new Date().toISOString(),
      version: null, capabilities: Object.keys(a.capabilities).filter((k) => a.capabilities[k]),
      error: p.error || null, sample: p.sample || undefined,
    };
  }
  try {
    const headers = a.keyEnv ? { 'x-goog-api-key': process.env[a.keyEnv], 'Authorization': 'Bearer ' + process.env[a.keyEnv] } : {};
    const r = await boundedFetch(a.modelsUrl, headers, 5000);
    return {
      ok: r.ok, serviceId: a.id,
      status: r.ok ? registry.STATUS.READY : registry.STATUS.DEGRADED,
      latencyMs: Date.now() - t0, checkedAt: new Date().toISOString(),
      version: null, capabilities: Object.keys(a.capabilities).filter((k) => a.capabilities[k]),
      error: r.ok ? null : 'HTTP ' + r.status,
    };
  } catch (e) {
    return {
      ok: false, serviceId: a.id, status: registry.STATUS.UNAVAILABLE,
      latencyMs: Date.now() - t0, checkedAt: new Date().toISOString(),
      version: null, capabilities: [], error: String(e && e.message).slice(0, 200),
    };
  }
}

async function listModels(id, opts) {
  const a = find(id);
  if (!a) return { ok: false, code: 'VALIDATION', error: 'unknown provider' };
  if (!configured(a)) return { ok: false, code: 'AUTH_REQUIRED', provider: a.id, models: [] };
  if (!a.implemented.listModels) return { ok: false, code: 'NOT_IMPLEMENTED', provider: a.id, models: [] };
  try {
    const headers = a.keyEnv ? (a.id === 'gemini'
      ? { 'x-goog-api-key': process.env[a.keyEnv] }
      : { 'Authorization': 'Bearer ' + process.env[a.keyEnv] }) : {};
    const r = await boundedFetch(a.modelsUrl, headers, 8000);
    if (!r.ok) return { ok: false, code: 'REMOTE_ERROR', provider: a.id, models: [], error: 'HTTP ' + r.status };
    const json = await r.json();
    const raw = Array.isArray(json) ? json : (json.data || json.models || []);
    const models = raw.slice(0, 200).map((m) => ({
      id: String(m.id || m.name || '').replace(/^models\//, ''),
      displayName: m.displayName || m.name || m.id || '',
      contextWindow: null,
      inputModalities: Array.isArray(m.inputTokenLimit) ? [] : [],
      local: a.id === 'ollama',
    })).filter((m) => m.id);
    return { ok: true, provider: a.id, models, count: models.length };
  } catch (e) {
    return { ok: false, code: 'WORKER_OFFLINE', provider: a.id, models: [], error: String(e && e.message).slice(0, 200) };
  }
}

function route(request) {
  const r = request || {};
  const need = String(r.modality || r.task || 'chat').toLowerCase();
  const preferLocal = r.localOnly === true || String(r.privacyPreference || '').toLowerCase() === 'local';
  const pool = ADAPTERS.filter(configured);
  if (!pool.length) return { ok: false, code: 'NO_PROVIDER', reason: 'no provider configured', fallbacks: [] };

  let chosen = null;
  let reason = '';
  if (preferLocal) {
    chosen = pool.find((a) => a.id === 'ollama');
    reason = 'localOnly/privacy preference requires the offline lane';
  }
  if (!chosen && (need.includes('voice') || need.includes('realtime') || need.includes('audio'))) {
    chosen = pool.find((a) => a.capabilities.realtime) || null;
    reason = 'realtime/audio modality requires a realtime-capable provider';
  }
  if (!chosen && (need.includes('vision') || need.includes('image'))) {
    chosen = pool.find((a) => a.capabilities.vision && a.implemented.chat) || null;
    reason = 'vision modality requires a provider with implemented vision chat';
  }
  if (!chosen && (need.includes('coding') || need.includes('reasoning'))) {
    chosen = pool.find((a) => a.id === 'anthropic' && a.implemented.chat)
      || pool.find((a) => (a.id === 'openai' || a.id === 'openrouter') && a.implemented.chat);
    reason = 'coding/reasoning prefers an implemented chat adapter';
  }
  if (!chosen) {
    chosen = pool.find((a) => a.id === 'openrouter' && a.implemented.chat)
      || pool.find((a) => a.implemented.chat)
      || pool[0];
    reason = 'default chain: first configured provider with an implemented method';
  }
  const fallbacks = pool.filter((a) => a.id !== chosen.id && a.implemented.chat).map((a) => a.id);
  return {
    ok: true,
    provider: chosen.id,
    model: r.model || null,
    reason,
    // null means no measurement or price table exists - never invent numbers.
    estimatedCost: null,
    expectedLatency: null,
    capabilities: Object.keys(chosen.capabilities).filter((k) => chosen.capabilities[k]),
    fallbacks,
  };
}

async function chat(request, opts) {
  const r = request || {};
  const a = find(r.provider);
  if (!a) return { ok: false, code: 'VALIDATION', error: 'provider is required' };
  if (!configured(a)) return { ok: false, code: 'AUTH_REQUIRED', provider: a.id };
  if (!a.implemented.chat) return { ok: false, code: 'NOT_IMPLEMENTED', provider: a.id, error: 'chat adapter not implemented yet - use a gateway lane provider' };
  return gateway.chat({ ...r, lane: a.laneId }, opts);
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/adapters', (req, res) => res.json({ ok: true, adapters: listAdapters() }));
  router.get('/models/:id', async (req, res) => res.json(await listModels(req.params.id)));
  router.post('/probe', async (req, res) => res.json(await probe((req.body || {}).id)));
  router.post('/route', (req, res) => res.json(route(req.body || {})));
  router.post('/chat', async (req, res) => res.json(await chat(req.body || {})));
  return router;
}

module.exports = { ADAPTERS, listAdapters, probe, listModels, route, chat, createRouter };
