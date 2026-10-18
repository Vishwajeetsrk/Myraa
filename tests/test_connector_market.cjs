'use strict';
/**
 * MYRAA Connector Marketplace - tests (Phase 19).
 * Run: node tests/test_connector_market.cjs (from repo root).
 * No real network: every fetch is a stub in TEMP-side test code.
 */
const assert = require('assert');
const mkt = require('../resources/app/dist/connector_market.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

function wik() { return mkt.CONNECTOR_CATALOG.find((c) => c.id === 'wikipedia'); }

async function main() {
  console.log('== catalog ==');
  ok('catalog has >= 8 connectors', mkt.CONNECTOR_CATALOG.length >= 8);
  ok('every connector declares hosts + actions + auth', mkt.CONNECTOR_CATALOG.every((c) => Array.isArray(c.hosts) && c.hosts.length === 1 && Array.isArray(c.actions) && c.actions.length >= 1 && typeof c.auth === 'string'));
  ok('keyed connectors point to env names', mkt.CONNECTOR_CATALOG.filter((c) => c.auth !== 'none').every((c) => /^[A-Z_.0-9]+$/.test(c.auth)));
  const list = mkt.listConnectors();
  ok('list bounded and streaming shape', list.ok && list.connectors.length === mkt.CONNECTOR_CATALOG.length && list.connectors.every((c) => typeof c.id === 'string'));
  ok('findConnector id case-insensitive', mkt.findConnector('WIKIPEDIA'.toLowerCase()) && mkt.findConnector('nope') === null);

  console.log('== search ==');
  const noQ = mkt.searchConnectors('   ');
  ok('search rejects empty', noQ.ok === false && noQ.code === 'VALIDATION');
  const hit = mkt.searchConnectors('weather key');
  ok('search ranks weather query', hit.ok && hit.results.length >= 1 && hit.results[0].id === 'openweather' && hit.results[0].matchScore >= 2);
  const none = mkt.searchConnectors('astronaut laundering');
  ok('search empty stays honest', none.ok && none.results.length === 0 && /declarative/.test(none.note));

  console.log('== validation ==');
  const unknownAction = await mkt.invokeRaw(wik(), { id: 'launch_missiles' }, {}, { fetchFn: async () => { throw new Error('must not be called'); } });
  ok('unknown action refused pre-network', unknownAction.ok === false && /unknown action/.test(unknownAction.error) && !/must not be called/.test(unknownAction.error));
  const noParams = await mkt.invokeRaw(wik(), { id: 'search' }, {}, { fetchFn: async () => { throw new Error('must not be called'); } });
  ok('missing params refused pre-network', noParams.ok === false && /missing params: query/.test(noParams.error));

  const saveKey = process.env.OPENWEATHER_API_KEY;
  delete process.env.OPENWEATHER_API_KEY;
  const openweather = mkt.findConnector('openweather');
  const noAuth = await mkt.invokeRaw(openweather, { id: 'current' }, { city: 'Delhi' }, { fetchFn: async () => { throw new Error('must not be called'); } });
  ok('keyed connector honest AUTH_REQUIRED', noAuth.ok === false && noAuth.code === 'AUTH_REQUIRED' && /OPENWEATHER_API_KEY/.test(noAuth.error) && !/must not be called/.test(noAuth.error));
  if (saveKey) process.env.OPENWEATHER_API_KEY = saveKey;

  console.log('== allowlist ==');
  const hostiled = { ...wik(), hosts: ['evil.example.com'] };
  const blocked = await mkt.invokeRaw(hostiled, { id: 'search' }, { query: 'x' }, { fetchFn: async () => { throw new Error('must not be called'); } });
  ok('out-of-allowlist host refused', blocked.ok === false && /allowlist/.test(blocked.error) && !/must not be called/.test(blocked.error));

  console.log('== offline + remote errors ==');
  const offline = await mkt.invokeRaw(wik(), { id: 'search' }, { query: 'solar' }, { fetchFn: async () => { throw new Error('ENOTFOUND'); } });
  ok('offline is WORKER_OFFLINE with reason', offline.ok === false && offline.code === 'WORKER_OFFLINE' && /ENOTFOUND/.test(offline.error));
  const dead = await mkt.invokeRaw(wik(), { id: 'search' }, { query: 'solar' }, { fetchFn: async () => ({ ok: false, status: 500, text: async () => 'kaput' }) });
  ok('remote 5xx is REMOTE_ERROR with slice', dead.ok === false && dead.code === 'REMOTE_ERROR' && dead.error.includes('500'));

  console.log('== happy paths + summarize ==');
  const okWiki = await mkt.invokeRaw(wik(), { id: 'search' }, { query: 'solar wind' }, {
    fetchFn: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ query: { search: [{ title: 'Solar wind', snippet: 'plasma <b>outflow</b>' }] } }) }),
  });
  ok('wiki search ok + json body', okWiki.ok === true && Array.isArray(okWiki.result.query.search));
  const s1 = mkt.summarize(okWiki);
  ok('wiki summarize titles + strips markup', /Solar wind/.test(s1) && !/<b>/.test(s1));
  const s2 = mkt.summarize({ ok: true, result: { hits: [{ title: 'Show HN', points: 5 }] } });
  ok('hn summarize pts', /Show HN.*5/.test(s2));
  const s3 = mkt.summarize({ ok: true, result: [{ word: 'turn', meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'rotate around an axis' }] }] }] });
  ok('dictionary summarize', /turn.*rotate/.test(s3));
  const s4 = mkt.summarize({ ok: true, result: { base: 'EUR', date: '2026-10-16', rates: { USD: 1.09 } } });
  ok('fx summarize', /EUR.*2026-10-16|USD/.test(s4));
  const s5 = mkt.summarize({ ok: true, result: { text: 'fallback body' } });
  ok('text summarize', /fallback body/.test(s5));
  const s6 = mkt.summarize({ ok: false, error: 'kaput' });
  ok('error summarize passthrough', /kaput/.test(s6));

  console.log('== agi tool registration ==');
  const registered = new Map();
  const fakeEngine = { register: (name, desc) => { registered.set(name, desc); return { name }; } };
  const reg = mkt.registerAgiTools(fakeEngine);
  ok('all actions registered as tools', reg.count === mkt.CONNECTOR_CATALOG.reduce((a, c) => a + c.actions.length, 0) && reg.count === registered.size);
  ok('tool names prefixed + risk LOW + category', [...registered.entries()].every(([n, d]) => n.startsWith('connector_') && d.risk === 'LOW' && d.category === 'connector' && typeof d.fn === 'function'));
  const execRes = await registered.get('connector_wikipedia_search').fn({ query: 'x' }, { fetchFn: async () => { throw new Error('ENOTFOUND'); } });
  ok('registered fn reaches invoke with injectable fetch', execRes.ok === false && execRes.code === 'WORKER_OFFLINE');

  console.log('== status ==');
  delete process.env.OPENWEATHER_API_KEY;
  const st = mkt.status({});
  ok('status reports keyed env presence honestly', st.keyed.length === 1 && st.keyed[0].env === 'OPENWEATHER_API_KEY' && st.keyed[0].present === false);
  ok('status includes offline policy text', /WORKER_OFFLINE/.test(st.offlinePolicy));

  console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('test crashed:', e.message); process.exit(1); });
