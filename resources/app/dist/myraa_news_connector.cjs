// MYRAA AI OS — News / RSS Connector (universal adapter, additive)
// No-key HTTPS RSS parsing from curated, content-safe feeds (BBC, Reuters, Al Jazeera, Wikipedia).
// READ-ONLY. Honest: feed failure/empty → ok:false with reason (never fabricated headlines).

'use strict';

const CACHE_TTL_MS = 15 * 60 * 1000;
const _cache = new Map();

const FEEDS = {
  'bbc': { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
  'ars': { url: 'https://feeds.arstechnica.com/arstechnica/index', name: 'Ars Technica' },
  'verge': { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
  'npr': { url: 'https://feeds.npr.org/1001/rss.xml', name: 'NPR News' },
  'wired': { url: 'https://www.wired.com/feed/rss', name: 'Wired' },
  'techcrunch': { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' },
  'hindu': { url: 'https://www.thehindu.com/news/national/feeder/default.rss', name: 'The Hindu' },
};

function cacheGet(k) { const e = _cache.get(k); if (!e) return null; if (Date.now() - e.at > CACHE_TTL_MS) { _cache.delete(k); return null; } return e.data; }
function cacheSet(k, d) { _cache.set(k, { at: Date.now(), data: d }); if (_cache.size > 100) _cache.delete(_cache.keys().next().value); }

function getText(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': 'MYRAA-AI-OS/1.0', 'Accept': 'application/rss+xml, text/xml, */*' }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getText(new URL(res.headers.location, url).toString()));
      }
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, text: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function extractItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1];
    const title = (body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1];
    const link = (body.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1];
    const pub = (body.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i) || [])[1];
    const desc = (body.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1];
    if (title && title.trim()) items.push({ title: strip(title), link: (link || '').trim(), published: (pub || '').trim(), description: strip((desc || '').slice(0, 300)) });
  }
  return items;
}

function strip(s) { return String(s || '').replace(/<\/?[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

const connector = {
  id: 'news',
  name: 'News / RSS Intelligence',
  category: 'News',

  async connect() { /* no-key */ },
  async disconnect() { _cache.clear(); },

  async ping() {
    const r = await getText(FEEDS.bbc.url);
    if (r.status >= 400 || !r.text.includes('<item')) throw new Error('news ping failed');
  },

  async healthCheck() {
    const t0 = Date.now();
    try { await this.ping(); return { state: 'healthy', latencyMs: Date.now() - t0, lastSuccess: new Date().toISOString() }; }
    catch (e) { return { state: 'unavailable', reason: String((e && e.message) || e) }; }
  },

  async listResources() {
    return Object.entries(FEEDS).map(([id, f]) => ({ id, kind: 'rss', name: f.name, uri: f.url }));
  },

  getCapabilities() {
    return [{ id: 'news-headlines', description: 'curated RSS headlines from trusted feeds', tools: ['myraa.news.headlines'] }];
  },

  /**
   * execute('headlines', { source, limit }, ctx) → honest headlines list.
   */
  async execute(action, input) {
    if (action !== 'headlines' && action !== 'news') throw new Error(`Unknown news action: ${action}`);
    const src = String((input && input.source) || 'bbc').toLowerCase();
    const limit = Math.min(Number((input && input.limit) || 10), 20);
    const feed = FEEDS[src];
    if (!feed) return { ok: false, reason: `unknown source '${src}' (try: ${Object.keys(FEEDS).join(', ')})` };

    let hit = cacheGet(src);
    if (hit) return { ...hit, cached: true };

    try {
      const r = await getText(feed.url);
      if (r.status >= 400) return { ok: false, reason: `feed responded ${r.status}` };
      const items = extractItems(r.text);
      if (!items.length) return { ok: false, reason: 'feed returned no items (may be temporarily unavailable)', source: src };
      const out = {
        ok: true, tool: 'myraa.news.headlines', connector: 'news', source: src, sourceName: feed.name,
        count: Math.min(items.length, limit), articles: items.slice(0, limit),
        summary: `${Math.min(items.length, limit)} headline(s) from ${feed.name}`,
        disclaimer: 'Headlines are pulled live from the provider feed for the current request.',
        timestamp: new Date().toISOString(),
      };
      cacheSet(src, out);
      return out;
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },

  async listSources() { return FEEDS; },
};

module.exports = connector;
