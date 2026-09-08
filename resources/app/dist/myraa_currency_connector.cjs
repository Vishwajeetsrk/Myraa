// MYRAA AI OS — Currency Connector (universal adapter, additive)
// Provider: Frankfurter (ECB-backed), no key, HTTPS, CORS-enabled.
// READ-ONLY ONLY. No transactions. Always include disclaimer note.
// Honest: network/parse failure → ok:false with reason, never invented rate.

'use strict';

const CACHE_TTL_MS = 15 * 60 * 1000;
const _cache = new Map();

function cacheGet(k) { const e = _cache.get(k); if (!e) return null; if (Date.now() - e.at > CACHE_TTL_MS) { _cache.delete(k); return null; } return e.data; }
function cacheSet(k, d) { _cache.set(k, { at: Date.now(), data: d }); if (_cache.size > 100) _cache.delete(_cache.keys().next().value); }

const BASE = process.env.MYRAA_FX_BASE || 'https://api.frankfurter.dev/v1';

function getJson(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': 'MYRAA-AI-OS/1.0', 'Accept': 'application/json' }, timeout: 10000 }, (res) => {
      // Follow redirects (Frankfurter moved app → dev) up to 3 hops.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getJson(new URL(res.headers.location, url).toString()));
      }
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        try {
          if (d.trim().length === 0) resolve({ status: res.statusCode, data: null });
          else resolve({ status: res.statusCode, data: JSON.parse(d) });
        }
        catch (e) { reject(new Error('bad json')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const connector = {
  id: 'currency',
  name: 'Currency Intelligence (read-only)',
  category: 'Finance',

  async connect() { /* no-key */ },
  async disconnect() { _cache.clear(); },

  async ping() {
    const r = await getJson(`${BASE}/latest?from=USD&to=INR`);
    if (r.status >= 400 || !r.data || r.data.rates === undefined) throw new Error('currency ping failed');
  },

  async healthCheck() {
    const t0 = Date.now();
    try { await this.ping(); return { state: 'healthy', latencyMs: Date.now() - t0, lastSuccess: new Date().toISOString() }; }
    catch (e) { return { state: 'unavailable', reason: String((e && e.message) || e) }; }
  },

  async listResources() {
    return [{ id: 'frankfurter-fx', kind: 'api', name: 'Frankfurter FX Rates (ECB)', uri: 'https://api.frankfurter.app' }];
  },

  getCapabilities() {
    return [{ id: 'currency-conversion', description: 'read-only current/historical FX conversion', tools: ['myraa.currency.convert'] }];
  },

  /**
   * execute('convert', { amount, from, to }, ctx) → honest result.
   * ctx.confirmed: not required (READ_ONLY). Financial disclaimer returned in output.
   */
  async execute(action, input) {
    if (action !== 'convert' && action !== 'latest') throw new Error(`Unknown currency action: ${action}`);
    const amount = Number((input && input.amount) != null ? input.amount : 1);
    const from = String((input && input.from) || 'USD').toUpperCase();
    const to = String((input && input.to) || 'INR').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'amount must be a positive number' };

    const rateKey = `latest:${from}->${to}`;
    let rate = cacheGet(rateKey);
    if (rate == null) {
      try {
        const r = await getJson(`${BASE}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        if (r.status >= 400 || !r.data || r.data.rates === undefined) return { ok: false, reason: `provider responded ${r.status}` };
        rate = r.data.rates[to];
        if (rate == null) return { ok: false, reason: `pair ${from}->${to} not supported (check ISO codes)` };
        cacheSet(rateKey, rate);
      } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
    }

    const converted = round(amount * Number(rate));
    const date = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      tool: 'myraa.currency.convert', connector: 'currency',
      amount, from, to, rate: Number(rate), converted, date,
      summary: `${amount} ${from} = ${converted} ${to} (rate ${Number(rate).toFixed(4)}, ECB/Frankfurter, ${date})`,
      disclaimer: 'Read-only informational rate. Not financial advice; no transactions performed.',
      timestamp: new Date().toISOString(),
    };
  },

  // historic rate support
  async executeHistoric(action, input) {
    if (action !== 'historic') throw new Error(`Unknown action: ${action}`);
    const from = String((input && input.from) || 'USD').toUpperCase();
    const to = String((input && input.to) || 'INR').toUpperCase();
    const d = String((input && input.date) || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, reason: 'date must be YYYY-MM-DD' };
    try {
      const r = await getJson(`${BASE}/${d}?from=${from}&to=${to}`);
      if (r.status >= 400 || !r.data || r.data.rates === undefined) return { ok: false, reason: `provider responded ${r.status}` };
      const rate = r.data.rates[to];
      if (rate == null) return { ok: false, reason: `pair ${from}->${to} not supported on ${d}` };
      return { ok: true, tool: 'myraa.currency.convert', date: d, from, to, rate: Number(rate), summary: `${d}: 1 ${from} = ${Number(rate).toFixed(4)} ${to}`, disclaimer: 'Read-only. ECB/Frankfurter.' };
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },
};

function round(n) { return Math.round(n * 100) / 100; }

module.exports = connector;
