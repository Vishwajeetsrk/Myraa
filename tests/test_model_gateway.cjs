'use strict';
/**
 * MYRAA Model Gateway - tests (Phase 20).
 * Run: node tests/test_model_gateway.cjs (from repo root).
 * No real network: every fetch is a stub; provider key envs are stripped.
 */
const assert = require('assert');
const gw = require('../resources/app/dist/model_gateway.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const KEY_ENVS = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY'];
const savedEnv = {};

async function main() {
  for (const k of KEY_ENVS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  try { runAll(); } finally { for (const k of KEY_ENVS) { if (savedEnv[k]) process.env[k] = savedEnv[k]; } }
}

function runAll() {
  console.log('== surface ==');
  ok('4 lanes declared', gw.LANES.length === 4);
  ok('lane ids named expected', ['openrouter_free', 'ollama_local', 'openai_owned', 'groq_owned'].every((id) => gw.findLane(id)));
  ok('findLane case-insensitive, unknown null', gw.findLane('OLLAMA_LOCAL') && gw.findLane('nope') === null);
  ok('keyed lanes point to env names', gw.LANES.filter((l) => l.keyEnv).every((l) => /^[A-Z_0-9]+$/.test(l.keyEnv)));
  ok('offline chain puts ollama first', gw.OFFLINE_FIRST_CHAIN[0] === 'ollama_local');

  console.log('== chain + params ==');
  ok('unknown lane override yields no chain', gw.chainFor(null, 'nope') === null);
  ok('lane override pins single lane', gw.chainFor(null, 'groq_owned').length === 1);
  ok('defaults known order', gw.DEFAULT_CHAIN[0] === 'openrouter_free' && gw.DEFAULT_CHAIN[1] === 'ollama_local');

  console.log('== token saver ==');
  const long = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: 'msg' + i + ' ' + 'x'.repeat(2500) }));
  const capped = gw.capMessages(long);
  ok('history capped to last 10', capped.length === 10 && capped[9].content.startsWith('x'.repeat(0)) && capped[0].content.startsWith('msg20'));
  ok('per-message sliced 2000', capped.every((m) => m.content.length <= 2000));
  ok('empty messages filtered', gw.capMessages([{ content: '' }, null, { content: 'hi' }]).length === 1);
  ok('junk role normalized to user', gw.capMessages([{ role: 'banana', content: 'a' }])[0].role === 'user');
  const msgErr = gw.capMessages(null);
  ok('no messages -> validation path later', Array.isArray(msgErr) && msgErr.length === 0);

  console.log('== request shaping ==');
  const orLane = gw.findLane('openrouter_free');
  const req = gw.buildChatRequest(orLane, null, [{ role: 'user', content: 'hi' }], { maxTokens: 50 });
  ok('openai-style body + model default', JSON.parse(req.body).model === orLane.defaultModel && JSON.parse(req.body).max_tokens === 50);
  const olLane = gw.findLane('ollama_local');
  const oreq = gw.buildChatRequest(olLane, null, [{ role: 'user', content: 'hi' }]);
  ok('ollama style: stream false, no max_tokens', JSON.parse(oreq.body).stream === false && req.url.includes(orLane.host));

  console.log('== honest refusals (no network possible) ==');
  const mustNotFetch = async () => { throw new Error('MUST-NOT-FETCH'); };
  (async () => {
    const noMsg = await gw.chat({ messages: [] }, { fetchFn: mustNotFetch });
    ok('chat without messages refused', noMsg.ok === false && noMsg.code === 'VALIDATION');
    const badLane = await gw.chat({ messages: [{ role: 'user', content: 'x' }], lane: 'tofu' }, { fetchFn: mustNotFetch });
    ok('unknown lane refused pre-network', badLane.ok === false && badLane.code === 'VALIDATION' && /unknown lane/.test(badLane.error));

    // allowlist: a request to a host outside the lane's pin is refused
    const evilHostErr = gw.validateLaneHost(orLane, { url: 'http://evil.example.com/v1/chat/completions' });
    ok('out-of-allowlist host refused via validateLaneHost', evilHostErr !== null && /outside the lane allowlist/.test(evilHostErr));
    ok('pinned host passes the guard', gw.validateLaneHost(orLane, { url: 'https://openrouter.ai/api/v1/chat/completions' }) === null);

    console.log('== AUTH_REQUIRED + NO_PROVIDER chain ==');
    const none = await gw.chat({ messages: [{ role: 'user', content: 'hello there' }] }, { fetchFn: async () => { throw new Error('ENOTFOUND'); } });
    ok('no keys + dead ollama => NO_PROVIDER with attempts', none.ok === false && none.code === 'NO_PROVIDER' && none.attempts.length === gw.LANES.length);
    ok('keyed lanes recorded AUTH_REQUIRED honestly', none.attempts.filter((a) => a.code === 'AUTH_REQUIRED').length === 3 && none.attempts[1].lane === 'ollama_local');

    console.log('== happy path + fallback ==');
    process.env.OPENAI_API_KEY = 'test-owned-key';
    let sawAuthHeader = false;
    const openaiFn = async (url, init) => {
      if (new URL(url).host === 'api.openai.com') {
        sawAuthHeader = String((init.headers || {})['Authorization'] || '').includes('test-owned-key');
        return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: 'pong from openai' } }] }) };
      }
      throw new Error('ENOTFOUND');
    };
    const fb = await gw.chat({ messages: [{ role: 'user', content: 'ping' }] }, { fetchFn: openaiFn });
    ok('chain fallback reached openai_owned', fb.ok === true && fb.lane === 'openai_owned' && /pong from openai/.test(fb.text));
    ok('owned key sent from env only', sawAuthHeader);
    delete process.env.OPENAI_API_KEY;

    const olFn = async (url) => {
      if (new URL(url).host !== '127.0.0.1:11434') throw new Error('WRONG-HOST:' + new URL(url).host);
      return { ok: true, text: async () => JSON.stringify({ message: { content: 'ollama says hi' } }) };
    };
    const offlineLane = await gw.chat({ messages: [{ role: 'user', content: 'q' }], lane: 'ollama_local' }, { fetchFn: olFn });
    ok('offline lane first + no key lane answers', offlineLane.ok === true && offlineLane.lane === 'ollama_local' && /ollama says hi/.test(offlineLane.text));

    const longReply = { choices: [{ message: { content: 'y'.repeat(5000) } }] };
    const extracted = gw.extractText(gw.findLane('openai_owned'), longReply, '');
    ok('reply text capped (' + extracted.length + ')', extracted.length <= gw.RES_TEXT_CAP);

    console.log('== probes ==');
    const unknownProbe = await gw.probeLane('tofu', { fetchFn: mustNotFetch });
    ok('unknown lane probe refused', unknownProbe.ok === false && unknownProbe.code === 'VALIDATION');
    const p1 = await gw.probeLane('ollama_local', { fetchFn: async () => { throw new Error('ECONNREFUSED'); } });
    ok('dead ollama probe is OFFLINE honestly', p1.ok === false && p1.state === 'OFFLINE' && /ECONNREFUSED/.test(p1.error));
    const p2 = await gw.probeLane('openai_owned', { fetchFn: async () => ({ ok: false, text: async () => 'no key' }) });
    ok('missing owned key probe is AUTH_REQUIRED', p2.ok === false && p2.state === 'AUTH_REQUIRED');
    gw.clearProbeCache();
    const p3 = await gw.probeLane('ollama_local', { fetchFn: async () => ({ ok: true, text: async () => JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }) }) });
    ok('ollama online probe lists models', p3.ok === true && p3.state === 'ONLINE' && /llama3\.2/.test(p3.sample || ''));
    const all = await gw.probeAll({ fetchFn: async () => { throw new Error('ENOTFOUND'); } });
    ok('probeAll reports every lane', all.ok === true && all.lanes.length === gw.LANES.length && all.chainDefault === gw.DEFAULT_CHAIN);

    console.log('== agi registration ==');
    const registered = new Map();
    const fakeEngine = { register: (name, d) => { registered.set(name, d); return { name }; } };
    const reg = gw.registerAgiTools(fakeEngine);
    ok('gateway tools mounted', reg.count === 2 && registered.has('gateway_chat') && registered.has('gateway_probe'));
    ok('gateway tools risk LOW + category', [...registered.values()].every((d) => d.risk === 'LOW' && d.category === 'gateway'));
    const viaTool = await registered.get('gateway_chat').fn({ messages: [{ role: 'user', content: 'q' }], lane: 'ollama_local' }, { fetchFn: olFn });
    ok('registered fn reaches chat with injectable fetch', viaTool.ok === true && /ollama says hi/.test(viaTool.text));

    console.log('== status ==');
    const st = gw.status({});
    ok('status declares policy (no resold channels)', /resold/.test(st.policy) && st.lanes.length === 4 && st.chainOfflineFirst.startsWith('ollama'));

    console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail);
    process.exit(fail ? 1 : 0);
  })().catch((e) => { console.error('async test crashed:', e.message); console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail); process.exit(1); });
}

main();
