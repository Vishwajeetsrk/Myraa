// MYRAA AI OS — Weather Connector (universal adapter, additive)
// Wraps existing REAL implementation: ./weather_service.cjs (Open-Meteo + geocoding + Memory Core)
// Fixes duplication: desktopAutomation.getWeather (wttr.in + dishonest 28°C fallback) is secondary only.
// Rule: NEVER invent data. Offline/unknown → ok:false + reason, never ok:true with fake temp.

'use strict';

const CACHE_TTL_MS = 10 * 60 * 1000;
const _cache = new Map(); // key -> { at, data }

function cacheGet(key) {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return e.data;
}
function cacheSet(key, data) {
  _cache.set(key, { at: Date.now(), data });
  if (_cache.size > 50) { const k = _cache.keys().next().value; _cache.delete(k); }
}

function loadWeatherService() {
  try { return require('./weather_service.cjs'); }
  catch (e) { return null; }
}

const connector = {
  id: 'weather',
  name: 'Weather Intelligence',
  category: 'Weather',

  async connect() { /* no-key provider, nothing to auth */ },
  async disconnect() { _cache.clear(); },

  async ping() {
    // Lightweight Open-Meteo ping (Delhi coords). Throws on failure → health maps to unavailable.
    const https = require('https');
    await new Promise((resolve, reject) => {
      const req = https.get(
        'https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.20&current=temperature_2m&timezone=auto',
        { headers: { 'User-Agent': 'MYRAA-AI-OS/1.0' }, timeout: 8000 },
        (res) => {
          let d = '';
          res.on('data', (c) => { d += c; });
          res.on('end', () => {
            try { const j = JSON.parse(d); if (j && j.current) resolve(); else reject(new Error('bad payload')); }
            catch (e) { reject(e); }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
  },

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this.ping();
      return { state: 'healthy', latencyMs: Date.now() - t0, lastSuccess: new Date().toISOString() };
    } catch (e) {
      return { state: 'unavailable', reason: String((e && e.message) || e) };
    }
  },

  async listResources() {
    return [{ id: 'open-meteo-forecast', kind: 'api', name: 'Open-Meteo Forecast + Geocoding', uri: 'https://api.open-meteo.com' }];
  },

  getCapabilities() {
    return [{ id: 'weather-intelligence', description: 'get current weather + forecast + alerts (via forecast)', tools: ['myraa.weather.get'] }];
  },

  /**
   * execute('get', { location }, ctx) → { ok, ... } — honest, cached, audited.
   * ctx.confirmed unused (READ_ONLY). ctx.privacyMode respected (no PII stored beyond Memory Core location).
   */
  async execute(action, input, context) {
    if (action !== 'get' && action !== 'get_current' && action !== 'forecast') {
      throw new Error(`Unknown weather action: ${action}`);
    }
    const location = String((input && input.location) || '').trim();
    const key = `weather:${location.toLowerCase() || '__auto__'}`;
    const hit = cacheGet(key);
    if (hit) return { ...hit, cached: true };

    const ws = loadWeatherService();
    if (!ws) {
      return { ok: false, error: 'unavailable', reason: 'weather_service.cjs missing', location };
    }
    const t0 = Date.now();
    try {
      const res = await ws.getWeather(location || null);
      // weather_service already honest: needsLocation / error → ok:false. Pass through, never fake.
      if (!res || res.ok !== true) {
        return { ok: false, reason: (res && (res.message || res.error)) || 'location unavailable', location, latencyMs: Date.now() - t0 };
      }
      const out = { ok: true, tool: 'myraa.weather.get', connector: 'weather', location: res.location, summary: res.summary, data: res, latencyMs: Date.now() - t0, timestamp: new Date().toISOString() };
      cacheSet(key, out);
      return out;
    } catch (e) {
      return { ok: false, error: 'unavailable', reason: String((e && e.message) || e), location };
    }
  },
};

module.exports = connector;
