'use strict';
/**
 * MYRAA Compute — local/cloud executors (Phase 7c).
 * LOCAL: Ollama HTTP API (127.0.0.1:11434) for LLM_INFERENCE + EMBEDDING.
 * CLOUD: existing ai_gateway for LLM_INFERENCE.
 * Anything else -> honest EXECUTOR_PENDING / NOT_CONFIGURED errors.
 * httpFetch and gateway are injectable for tests; production uses global fetch.
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

async function fetchJson(fetchFn, url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, timeoutMs || 30000);
  try {
    const r = await fetchFn(url, Object.assign({}, opts, { signal: ctrl.signal }));
    const text = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 200));
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('non-JSON response: ' + text.slice(0, 200));
    }
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('TIMEOUT after ' + (timeoutMs || 30000) + 'ms: ' + url);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaStatus(fetchFn) {
  const f = fetchFn || fetch;
  try {
    const d = await fetchJson(f, OLLAMA_HOST + '/api/tags', { method: 'GET' }, 5000);
    const models = Array.isArray(d.models) ? d.models.map((m) => m.name).filter(Boolean) : [];
    return { ok: true, host: OLLAMA_HOST, models };
  } catch (e) {
    return { ok: false, error: 'NOT_CONFIGURED: Ollama unreachable at ' + OLLAMA_HOST + ' (' + String((e && e.message) || e).slice(0, 160) + ')' };
  }
}

function pickModel(models, prefer) {
  if (prefer && models.includes(prefer)) return prefer;
  const embed = models.find((m) => /embed/i.test(m));
  if (prefer === 'embed') return embed || null;
  return models[0] || null;
}

async function ollamaGenerate(fetchFn, model, prompt, timeoutMs) {
  const f = fetchFn || fetch;
  const d = await fetchJson(f, OLLAMA_HOST + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: String(prompt || ''), stream: false }),
  }, timeoutMs || 120000);
  if (typeof d.response !== 'string') throw new Error('unexpected Ollama response shape');
  return { text: d.response, metrics: { model, done: d.done === true } };
}

async function ollamaEmbed(fetchFn, model, texts, timeoutMs) {
  const f = fetchFn || fetch;
  const arr = Array.isArray(texts) ? texts : [texts];
  const out = [];
  for (const t of arr.slice(0, 64)) {
    const d = await fetchJson(f, OLLAMA_HOST + '/api/embeddings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: String(t || '') }),
    }, timeoutMs || 60000);
    if (!Array.isArray(d.embedding)) throw new Error('unexpected Ollama embeddings shape');
    out.push(d.embedding);
  }
  return { embeddings: out, metrics: { model, count: out.length, dims: out.length ? out[0].length : 0 } };
}

async function gatewayStatus(gw) {
  let gateway = gw;
  if (!gateway) {
    try {
      gateway = require('./ai_gateway_service.cjs');
    } catch (e) {
      return { ok: false, error: 'AI gateway module unavailable: ' + String((e && e.message) || e).slice(0, 160) };
    }
  }
  const env = process.env;
  const keys = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
  if (!keys.some((k) => env[k] && String(env[k]).trim().length > 8)) {
    return { ok: false, error: 'NOT_CONFIGURED: no cloud provider keys in env.' };
  }
  return { ok: true, gateway };
}

// execute(job, deps) — deps {fetchFn, gateway}. Throws coded Error on refusal/failure.
async function execute(job, deps) {
  const d = deps || {};
  const route = String(job.route || '').toUpperCase();
  const type = String(job.jobType || '');
  const input = (job.spec && job.spec.input) || {};
  if (route === 'LOCAL') {
    if (type !== 'LLM_INFERENCE' && type !== 'EMBEDDING') {
      const e = new Error('Local executor handles LLM_INFERENCE and EMBEDDING only; got ' + type);
      e.code = 'EXECUTOR_PENDING';
      throw e;
    }
    const st = await ollamaStatus(d.fetchFn);
    if (!st.ok) {
      const e = new Error(st.error);
      e.code = 'NOT_CONFIGURED';
      throw e;
    }
    if (type === 'EMBEDDING') {
      const model = pickModel(st.models, process.env.OLLAMA_EMBED_MODEL || 'embed');
      if (!model) {
        const e = new Error('No embedding model in Ollama. Pull one (e.g. nomic-embed-text) or set OLLAMA_EMBED_MODEL.');
        e.code = 'MODEL_NOT_FOUND';
        throw e;
      }
      const texts = input.texts || input.text || input.docs || '';
      return Object.assign({ route: 'LOCAL' }, await ollamaEmbed(d.fetchFn, model, texts));
    }
    const model = pickModel(st.models, process.env.OLLAMA_MODEL);
    if (!model) {
      const e = new Error('No models in Ollama. Pull one (e.g. llama3) or set OLLAMA_MODEL.');
      e.code = 'MODEL_NOT_FOUND';
      throw e;
    }
    if (!input.prompt && !input.text) {
      const e = new Error('LLM_INFERENCE needs input.prompt');
      e.code = 'INVALID_JOB';
      throw e;
    }
    return Object.assign({ route: 'LOCAL' }, await ollamaGenerate(d.fetchFn, model, input.prompt || input.text));
  }
  if (route === 'CLOUD') {
    if (type !== 'LLM_INFERENCE') {
      const e = new Error('Cloud executor handles LLM_INFERENCE only in this slice; got ' + type);
      e.code = 'EXECUTOR_PENDING';
      throw e;
    }
    const st = await gatewayStatus(d.gateway);
    if (!st.ok) {
      const e = new Error(st.error);
      e.code = 'NOT_CONFIGURED';
      throw e;
    }
    if (!input.prompt && !input.text) {
      const e = new Error('LLM_INFERENCE needs input.prompt');
      e.code = 'INVALID_JOB';
      throw e;
    }
    const res = await st.gateway.call({ messages: [{ role: 'user', content: String(input.prompt || input.text) }] });
    return { route: 'CLOUD', text: res.text, metrics: { provider: res.provider, model: res.model, usage: res.usage || null } };
  }
  const e = new Error('No executor for route ' + route + ' in this slice');
  e.code = 'EXECUTOR_PENDING';
  throw e;
}

module.exports = { execute, ollamaStatus, gatewayStatus, ollamaGenerate, ollamaEmbed, OLLAMA_HOST };
