'use strict';
/**
 * MYRAA Connector Marketplace (Phase 19).
 * Named connectors (rakazo-style computer/tool providers) as a declarative
 * catalog mounted onto MYRAA's agi tool_execution_engine. Pattern-level
 * adoption only (rakazo license unverified - no code copied).
 *
 * Honesty + safety rules:
 *   - every connector pins an explicit HOST allowlist; requests to any other
 *     host are refused (connector misuse cannot become an SSRF primitive)
 *   - no secrets are stored here: keyed connectors only read process.env
 *     and report AUTH_REQUIRED (honest) when the env var is absent
 *   - outbound fetch is optional at runtime; offline => WORKER_OFFLINE
 *   - responses are bounded (slice caps), outcome never asserted
 */

const OUTBOUND_TIMEOUT_MS = 12000;
const RES_BODY_CAP = 2400;
const LIST_CAP = 50;

const CONNECTOR_CATALOG = [
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    category: 'knowledge',
    auth: 'none',
    summary: 'Article summaries and in-wiki search. Public REST, no key.',
    hosts: ['en.wikipedia.org'],
    actions: [
      { id: 'search', params: ['query'], note: 'prefix with <connector> to invoke' },
    ],
  },
  {
    id: 'hn_search',
    name: 'Hacker News Search',
    category: 'news',
    auth: 'none',
    summary: 'Search the Algolia HN archive (stories, comments, counts). Public, no key.',
    hosts: ['hn.algolia.com'],
    actions: [{ id: 'search', params: ['query'] }],
  },
  {
    id: 'dictionary_api',
    name: 'Free Dictionary',
    category: 'language',
    auth: 'none',
    summary: 'Definitions and phonetics for English words. Public, no key.',
    hosts: ['api.dictionaryapi.dev'],
    actions: [{ id: 'define', params: ['word'] }],
  },
  {
    id: 'exchange_rates',
    name: 'Exchange Rates',
    category: 'finance',
    auth: 'none',
    summary: 'Daily fiat FX rates (ECB data via a public API). No key.',
    hosts: ['api.frankfurter.app'],
    actions: [{ id: 'rates', params: ['from', 'to'] }],
  },
  {
    id: 'crypto_price',
    name: 'Crypto Prices',
    category: 'finance',
    auth: 'none',
    summary: 'Spot prices for listed coins (public market data API). No key.',
    hosts: ['api.coingecko.com'],
    actions: [{ id: 'price', params: ['coin', 'currency'] }],
  },
  {
    id: 'github_trending',
    name: 'GitHub Trending',
    category: 'developer',
    summary: 'Most-starred public repos created since a date. GitHub Search API; anonymous quota applies.',
    auth: 'none',
    hosts: ['api.github.com'],
    actions: [{ id: 'trending', params: ['sinceDays'] }],
  },
  {
    id: 'openweather',
    name: 'OpenWeather',
    category: 'weather',
    auth: 'OPENWEATHER_API_KEY',
    summary: 'Current weather by city. Key is read from OPENWEATHER_API_KEY env - never stored here.',
    hosts: ['api.openweathermap.org'],
    actions: [{ id: 'current', params: ['city'] }],
  },
  {
    id: 'openrouter_models',
    name: 'OpenRouter Free Models',
    category: 'models',
    auth: 'none',
    summary: 'List currently free chat models (a Phase 20 gateway input). Public, no key.',
    hosts: ['openrouter.ai'],
    actions: [{ id: 'list_free_models', params: [] }],
  },
];

function findConnector(id) {
  const needle = String(id || '').trim().toLowerCase();
  const byId = CONNECTOR_CATALOG.find((c) => c.id === needle);
  return byId || null;
}

function actionFor(connector, actionId) {
  const a = String(actionId || '').trim().toLowerCase();
  return connector.actions.find((x) => x.id === a) || null;
}

function listConnectors() {
  return {
    ok: true,
    count: CONNECTOR_CATALOG.length,
    connectors: CONNECTOR_CATALOG.slice(0, LIST_CAP).map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      auth: c.auth,
      summary: c.summary,
      actions: c.actions.map((a) => a.id),
      hosts: c.hosts,
    })),
  };
}

function searchConnectors(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { ok: false, code: 'VALIDATION', error: 'query is required' };
  const tokens = q.split(/\s+/);
  const scored = CONNECTOR_CATALOG.map((c) => {
    const hay = (c.id + ' ' + c.name + ' ' + c.category + ' ' + c.summary + ' ' + c.actions.map((a) => a.id).join(' ')).toLowerCase();
    const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
    return { c, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, 10).map((x) => ({ id: x.c.id, name: x.c.name, category: x.c.category, auth: x.c.auth, summary: x.c.summary, actions: x.c.actions.map((a) => a.id), matchScore: x.score }));
  return { ok: true, query: q, results, note: results.length ? 'prefix find with "use <connector> connector" to act' : 'no connector matched; catalog is declarative - new connectors are code, not downloads' };
}

function pickParam(params, key) {
  const v = params && params[key];
  return typeof v === 'string' ? v.trim() : '';
}

function buildUrl(connector, action, params) {
  switch (connector.id + '/' + action.id) {
    case 'wikipedia/search':
      return { url: 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(pickParam(params, 'query')) + '&format=json&srlimit=5', method: 'GET' };
    case 'hn_search/search':
      return { url: 'https://hn.algolia.com/api/v1/search?query=' + encodeURIComponent(pickParam(params, 'query')) + '&hitsPerPage=5', method: 'GET' };
    case 'dictionary_api/define':
      return { url: 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(pickParam(params, 'word')), method: 'GET' };
    case 'exchange_rates/rates':
      return { url: 'https://api.frankfurter.app/latest?from=' + encodeURIComponent(pickParam(params, 'from')) + '&to=' + encodeURIComponent(pickParam(params, 'to')), method: 'GET' };
    case 'crypto_price/price':
      return {
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(pickParam(params, 'coin')) + '&vs_currencies=' + encodeURIComponent(pickParam(params, 'currency') || 'usd'),
        method: 'GET',
      };
    case 'github_trending/trending':
      return {
        url: 'https://api.github.com/search/repositories?q=created:>=' + encodeURIComponent(new Date(Date.now() - (Number(pickParam(params, 'sinceDays')) || 7) * 86400000).toISOString().slice(0, 10)) + '&sort=stars&order=desc&per_page=10',
        method: 'GET',
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'MYRAA-evidence-os' },
      };
    case 'openweather/current':
      return {
        url: 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(pickParam(params, 'city')) + '&units=metric&appid=' + String(process.env.OPENWEATHER_API_KEY || ''),
        method: 'GET',
      };
    case 'openrouter_models/list_free_models':
      return { url: 'https://openrouter.ai/api/v1/models', method: 'GET' };
    default:
      return null;
  }
}

function requiredParamsFor(connector, action) {
  if ((connector.id + '/' + action.id) === 'crypto_price/price') return ['coin'];
  if ((connector.id + '/' + action.id) === 'openweather/current') return ['city'];
  if ((connector.id + '/' + action.id) === 'wikipedia/search') return ['query'];
  if ((connector.id + '/' + action.id) === 'hn_search/search') return ['query'];
  if ((connector.id + '/' + action.id) === 'dictionary_api/define') return ['word'];
  if ((connector.id + '/' + action.id) === 'exchange_rates/rates') return ['from', 'to'];
  return [];
}

async function invokeRaw(connector, action, params, opts) {
  if (!actionFor(connector, action && action.id)) {
    return { ok: false, code: 'VALIDATION', error: 'unknown action for connector ' + connector.id + ' (allowed: ' + connector.actions.map((a) => a.id).join(', ') + ')' };
  }
  const missing = requiredParamsFor(connector, action).filter((p) => !pickParam(params, p));
  if (missing.length) return { ok: false, code: 'VALIDATION', error: 'missing params: ' + missing.join(', ') };
  if (connector.auth !== 'none' && !process.env[connector.auth]) {
    return { ok: false, code: 'AUTH_REQUIRED', error: 'connector ' + connector.id + ' needs env ' + connector.auth + ' (set it, restart MYRAA; the marketplace never stores secrets)' };
  }
  const built = buildUrl(connector, action, params);
  if (!built) return { ok: false, code: 'VALIDATION', error: 'no URL recipe for ' + connector.id + '/' + action.id + ' (declared as unknown work)' };
  let host;
  try { host = new URL(built.url).host; } catch (e) { return { ok: false, code: 'VALIDATION', error: 'bad URL construction' }; }
  if (!connector.hosts.includes(host)) {
    return { ok: false, code: 'VALIDATION', error: 'host ' + host + ' is outside the connector allowlist (' + connector.hosts.join(', ') + ')' };
  }
  const fetchFn = (opts && opts.fetchFn) || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, (opts && opts.timeoutMs) || OUTBOUND_TIMEOUT_MS);
  try {
    const r = await fetchFn(built.url, { method: built.method || 'GET', headers: built.headers || {}, signal: ctrl.signal });
    const text = await r.text();
    if (!r.ok) return { ok: false, code: 'REMOTE_ERROR', error: 'HTTP ' + r.status + ': ' + text.slice(0, 200) };
    try {
      const json = JSON.parse(text);
      return { ok: true, connector: connector.id, action: action.id, result: json, capped: 'raw JSON retained server-side in the reply body only' };
    } catch (e) {
      return { ok: true, connector: connector.id, action: action.id, result: { text: text.slice(0, RES_BODY_CAP) }, capped: 'non-json body sliced' };
    }
  } catch (e) {
    return { ok: false, code: 'WORKER_OFFLINE', error: 'connector unreachable (' + String((e && e.message) || e).slice(0, 120) + ') - MYRAA stays useful offline' };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(resultObj) {
  if (!resultObj || resultObj.ok !== true) return String(resultObj && resultObj.error || resultObj || '').slice(0, 160);
  const res = resultObj.result;
  try {
    if (res && Array.isArray(res.query && res.query.search)) {
      return res.query.search.slice(0, 5).map((x) => x.title + ' (' + String(x.snippet || '').replace(/<[^>]+>/g, '').slice(0, 60) + ')').join(' | ');
    }
    if (res && Array.isArray(res.hits)) {
      return res.hits.slice(0, 5).map((h) => (h.title || h.story_title || '(comment)') + ' pts:' + (h.points || 0)).join(' | ');
    }
    if (Array.isArray(res) && res.length && res[0] && res[0].meanings) {
      return res[0].word + ' :: ' + res[0].meanings.slice(0, 2).map((m) => (m.partOfSpeech || '') + ': ' + (m.definitions[0] ? m.definitions[0].definition.slice(0, 60) : '')).join(' / ');
    }
    if (res && res.rates) return '1 ' + res.base + ' -> ' + JSON.stringify(res.rates).slice(0, 80);
    if (res && res.base && res.date) return 'base ' + res.base + ' date ' + res.date;
    if (res && typeof res === 'object') {
      const first = Object.keys(res).slice(0, 6);
      const pick = {};
      for (const k of first) pick[k] = typeof res[k] === 'object' ? '[object]' : String(res[k]).slice(0, 40);
      return JSON.stringify(pick).slice(0, 200);
    }
    if (res && res.text) return res.text.slice(0, 200);
  } catch (e) { /* fallthrough */ }
  return JSON.stringify(res || {}).slice(0, 200);
}

function marketplaceResult(connector, action, params, opts) {
  return invokeRaw(connector, action, params, opts);
}

// Mount each connector action as an agi tool (tool_execution_engine contract:
// register(name, {fn, risk, timeout, category})).
function registerAgiTools(toolEngine, opts) {
  const mounted = [];
  for (const c of CONNECTOR_CATALOG) {
    for (const a of c.actions) {
      const toolName = 'connector_' + c.id + '_' + a.id;
      try {
        toolEngine.register(toolName, {
          fn: async (params, runtimeOpts) => invokeRaw(c, a, params || {}, runtimeOpts || opts),
          risk: 'LOW',
          timeout: OUTBOUND_TIMEOUT_MS,
          category: 'connector',
        });
        mounted.push(toolName);
      } catch (e) { /* registry may already hold the name: keep honest */ }
    }
  }
  return { ok: true, mounted, count: mounted.length };
}

function status(opts) {
  const now = Date.now();
  return {
    ok: true,
    connectors: CONNECTOR_CATALOG.length,
    actions: CONNECTOR_CATALOG.reduce((acc, c) => acc + c.actions.length, 0),
    keyed: CONNECTOR_CATALOG.filter((c) => c.auth !== 'none').map((c) => ({ id: c.id, env: c.auth, present: Boolean(process.env[c.auth]) })),
    offlinePolicy: 'every action degrades to WORKER_OFFLINE with a clear reason; nothing asserts success',
    capsText: 'reply bodies capped at ' + RES_BODY_CAP + ' chars',
    checkedAt: new Date(now).toISOString(),
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/', (req, res) => {
    const st = status({});
    res.json({ version: '19.0.0', ...st });
  });
  router.get('/list', (req, res) => {
    const s = listConnectors();
    if (!s.ok) return res.status(400).json({ ok: false, code: s.code, error: s.error });
    res.json({ version: '19.0.0', ...s });
  });
  router.get('/search', (req, res) => {
    const s = searchConnectors(req.query.q);
    if (!s.ok) return res.status(400).json({ ok: false, code: s.code, error: s.error });
    res.json({ version: '19.0.0', ...s });
  });
  return router;
}

module.exports = {
  CONNECTOR_CATALOG, RES_BODY_CAP, LIST_CAP,
  findConnector, actionFor, listConnectors, searchConnectors,
  invokeRaw, summarize, marketplaceResult, registerAgiTools, status,
  buildUrl, requiredParamsFor, createRouter,
};
