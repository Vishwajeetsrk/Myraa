'use strict';

/**
 * =============================================================================
 * MYRAA AI OS — Tavily Web Intelligence Provider (Search / Extract / Map)
 * =============================================================================
 * - Native REST integration with https://api.tavily.com (per Tavily agent-setup
 *   SKILL.md Path B: official REST API, key held in the project secret store)
 * - Key resolution: env TAVILY_API_KEY -> secure vault -> local .env files
 * - The key is NEVER logged, returned, or embedded in responses
 * - Results are normalized to MYRAA's existing { title, url, snippet, source }
 *   search shape so every consumer keeps working unchanged
 * - Callers treat this as best-effort primary; existing DuckDuckGo code stays
 *   as the fallback layer (nothing is removed)
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.tavily.com';
const TIMEOUT_MS = 15000;
let cachedKey = null;

function parseEnvFile(envPath) {
  try {
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        let v = trimmed.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch (e) { /* best effort */ }
}

function getKey() {
  if (cachedKey) return cachedKey;
  if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim()) {
    cachedKey = process.env.TAVILY_API_KEY.trim();
    return cachedKey;
  }
  // Secure vault (hardware-bound AES-256-GCM)
  try {
    const vault = require('./secure_vault.cjs');
    const v = vault.getSecret('TAVILY_API_KEY') || vault.getSecret('tavily_api_key');
    if (v && String(v).trim()) {
      cachedKey = String(v).trim();
      process.env.TAVILY_API_KEY = cachedKey;
      return cachedKey;
    }
  } catch (e) { /* vault optional */ }
  // Local .env files (same candidates myraa_v6_real_routes uses)
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '..', '..', '.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of candidates) parseEnvFile(p);
  if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim()) {
    cachedKey = process.env.TAVILY_API_KEY.trim();
    return cachedKey;
  }
  return null;
}

function postJson(endpoint, body) {
  const key = getKey();
  if (!key) return Promise.reject(new Error('TAVILY_API_KEY not configured'));
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + key
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Tavily: invalid JSON response')); }
        } else {
          const bodySnippet = String(data).slice(0, 200);
          reject(new Error(`Tavily HTTP ${res.statusCode}: ${bodySnippet}`));
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Tavily request timed out')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Live web search.
 * @param {string} query
 * @param {object} opts { maxResults, searchDepth: 'basic'|'advanced', topic: 'general'|'news'|'finance', includeAnswer }
 * @returns {Promise<{query, results:Array<{title,url,snippet,source}>, totalResults, answer?, provider, timestamp}>}
 */
async function search(query, opts = {}) {
  const key = getKey();
  if (!key) return { query, results: [], totalResults: 0, provider: 'tavily', configured: false, timestamp: Date.now() };
  const body = {
    query: String(query || '').slice(0, 400),
    max_results: Math.min(Math.max(parseInt(opts.maxResults, 10) || 8, 1), 20),
    search_depth: opts.searchDepth === 'advanced' ? 'advanced' : 'basic',
    topic: opts.topic || 'general',
    include_answer: opts.includeAnswer !== false,
    include_raw_content: false
  };
  const data = await postJson(API_BASE + '/search', body);
  const results = (Array.isArray(data.results) ? data.results : []).map(r => ({
    title: String(r.title || '').slice(0, 300),
    url: r.url || '',
    snippet: String(r.content || '').slice(0, 800),
    source: 'Tavily'
  })).filter(r => r.title && r.url);
  const out = {
    query, results, totalResults: results.length,
    provider: 'tavily', configured: true, timestamp: Date.now()
  };
  if (data.answer) out.answer = String(data.answer).slice(0, 1200);
  return out;
}

/**
 * Extract clean readable content from known URLs.
 * @param {string|string[]} urls
 * @returns {Promise<{ok, provider, pages:Array<{url,text,status}>}>}
 */
async function extract(urls, opts = {}) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean).slice(0, 5);
  if (!list.length) return { ok: false, provider: 'tavily', error: 'no urls' };
  const data = await postJson(API_BASE + '/extract', {
    urls: list,
    format: 'markdown',
    include_images: false
  });
  const pages = (Array.isArray(data.results) ? data.results : []).map(r => ({
    url: r.url,
    text: String(r.raw_content || r.content || '').slice(0, 20000),
    status: r.status || (r.raw_content ? 'ok' : 'empty')
  }));
  const failed = Array.isArray(data.failed_results) ? data.failed_results : [];
  return { ok: pages.length > 0, provider: 'tavily', pages, failed: failed.length, total: list.length };
}

/**
 * Discover URLs on a known site.
 */
async function mapSite(url, opts = {}) {
  const data = await postJson(API_BASE + '/map', {
    url: String(url || ''),
    max_depth: Math.min(Math.max(parseInt(opts.maxDepth, 10) || 1, 1), 3),
    limit: Math.min(Math.max(parseInt(opts.limit, 10) || 50, 1), 500)
  });
  const results = Array.isArray(data.results) ? data.results : [];
  return {
    ok: results.length > 0, provider: 'tavily',
    urls: results.slice(0, opts.maxUrls || 100).map(r =>
      typeof r === 'string' ? { url: r, title: '' } : { url: r.url || r.link || '', title: r.title || '' }
    ).filter(r => r.url),
    total: results.length
  };
}

/** Never exposes the key — safe to surface anywhere. */
function health() {
  return {
    provider: 'tavily',
    configured: Boolean(getKey()),
    endpoints: { search: API_BASE + '/search', extract: API_BASE + '/extract', map: API_BASE + '/map' },
    mcp: 'https://mcp.tavily.com/mcp/'
  };
}

module.exports = { search, extract, map: mapSite, health, getKey: () => Boolean(getKey()) };
