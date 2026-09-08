// MYRAA AI OS — Holidays Connector (universal adapter, additive)
// Provider: Nager.Date (public holiday API), no key, HTTPS.
// READ-ONLY. Honest: failure/unknown → ok:false with reason.

'use strict';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const _cache = new Map();

function cacheGet(k) { const e = _cache.get(k); if (!e) return null; if (Date.now() - e.at > CACHE_TTL_MS) { _cache.delete(k); return null; } return e.data; }
function cacheSet(k, d) { _cache.set(k, { at: Date.now(), data: d }); if (_cache.size > 200) _cache.delete(_cache.keys().next().value); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': 'MYRAA-AI-OS/1.0', 'Accept': 'application/json' }, timeout: 10000 }, (res) => {
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
  id: 'holidays',
  name: 'Holiday Intelligence',
  category: 'Date & Time',

  async connect() { /* no-key */ },
  async disconnect() { _cache.clear(); },

  async ping() {
    const r = await getJson('https://date.nager.at/api/v3/NextPublicHolidays/DE');
    if (r.status >= 400 || r.status === 204 || !Array.isArray(r.data)) throw new Error('holidays ping failed');
  },

  async healthCheck() {
    const t0 = Date.now();
    try { await this.ping(); return { state: 'healthy', latencyMs: Date.now() - t0, lastSuccess: new Date().toISOString() }; }
    catch (e) { return { state: 'unavailable', reason: String((e && e.message) || e) }; }
  },

  async listResources() {
    return [{ id: 'nager-holidays', kind: 'api', name: 'Nager.Date Public Holidays', uri: 'https://date.nager.at/api/v3' }];
  },

  getCapabilities() {
    return [{ id: 'holidays-lookup', description: 'public holidays by country/year, upcoming holidays', tools: ['myraa.holidays.get'] }];
  },

  /**
   * execute('upcoming', { countryCode }, ctx) → next public holidays.
   * execute('year', { countryCode, year }, ctx) → public holidays for a year.
   */
  async execute(action, input) {
    if (!action || !['upcoming', 'year', 'get'].includes(action)) throw new Error(`Unknown holidays action: ${action}`);
    const cc = String((input && input.countryCode) || (input && input.country) || 'IN').toUpperCase().slice(0, 2);
    const year = Number((input && input.year) || new Date().getFullYear());

    let key, url;
    if (action === 'upcoming') { key = `u:${cc}`; url = `https://date.nager.at/api/v3/NextPublicHolidays/${encodeURIComponent(cc)}`; }
    else { key = `y:${cc}:${year}`; url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(cc)}`; }

    let hit = cacheGet(key);
    if (hit) return { ...hit, cached: true };

    try {
      const r = await getJson(url);
      if (r.status === 204) return { ok: false, reason: `no public holiday data for country ${cc} in Nager.Date coverage (204 No Content)` };
      if (r.status >= 400 || !Array.isArray(r.data)) return { ok: false, reason: `provider responded ${r.status}` };
      const list = r.data.map((h) => ({ date: h.date, localName: h.localName, name: h.name })).slice(0, 30);
      const out = {
        ok: true, tool: 'myraa.holidays.get', connector: 'holidays', countryCode: cc,
        count: list.length, holidays: list, scope: action === 'upcoming' ? 'upcoming' : year,
        summary: `${list.length} public holiday(s)${action === 'upcoming' ? ' (upcoming)' : ' in ' + year} for ${cc}`,
        timestamp: new Date().toISOString(),
      };
      cacheSet(key, out);
      return out;
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },
};

module.exports = connector;
