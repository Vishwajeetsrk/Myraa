'use strict';
/**
 * MYRAA Pointer routes — extended tests (Phase 11 / Pointer Phase 2-4 endpoints).
 * Stubs express + pointer_core + csDb so handler logic runs without the server.
 */
const Module = require('module');
const routes = {};
const stubRouter = { get: (p, h) => { routes['GET ' + p] = h; }, post: (p, h) => { routes['POST ' + p] = h; } };
const stubExpress = Object.assign(() => ({}), { Router: () => stubRouter });
const origLoad = Module._load;

const dbCalls = [];
const sessionsDb = {};
global.__csDb = (cmd, payload) => {
  dbCalls.push({ cmd, payload });
  if (cmd === 'pp_session_save') { sessionsDb[payload.id] = Object.assign({}, payload); return { ok: true, id: payload.id }; }
  if (cmd === 'pp_session_get') { const s = sessionsDb[payload.id]; return s ? { ok: true, session: s } : { ok: false, error: 'Not found' }; }
  if (cmd === 'pp_action_save') { return { ok: true, id: payload.id }; }
  return { ok: true, id: (payload && payload.id) || 'x' };
};

const pointerStub = {
  point: (target) => target && target.grid ? { ok: true, target: target.grid, via: 'grid' } : { ok: true, target: target && target.textId, via: 'uia' },
  act: (kind, detail, opts) => {
    if (kind === 'open_app' && /logout|lock/i.test(detail)) return { ok: false, code: 'GUARDRAIL_REFUSED' };
    if (opts && opts.requiresConfirm && !opts.confirmToken) return { ok: false, code: 'CONFIRMATION_REQUIRED' };
    return { ok: true, kind };
  },
  findTextId: (cm, q) => ({ textId: 'u1', name: q, confidence: 1 }),
};

const storeMod = { csDb: global.__csDb };
Module._load = function (request, parent) {
  if (request === 'express') return stubExpress;
  if (request === './course_studio_store.cjs') return storeMod;
  if (request === './pointer_core.cjs') return pointerStub;
  return origLoad.apply(this, arguments);
};
require('../resources/app/dist/pointer_routes.cjs');

function call(method, url, body) {
  return new Promise((resolve) => {
    const cleanUrl = url.split('?')[0];
    let h = routes[method + ' ' + cleanUrl];
    if (!h) {
      for (const key of Object.keys(routes)) {
        const [m, pattern] = key.split(' ');
        if (m !== method) continue;
        const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
        if (regex.test(cleanUrl)) { h = routes[key]; break; }
      }
    }
    if (!h) { resolve({ __noHandler: true }); return; }
    const req = { body: body || {}, params: {}, query: {} };
    const qIdx = url.indexOf('?');
    if (qIdx > -1) {
      url.slice(qIdx + 1).split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        if (k) req.query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    const urlMatch = cleanUrl.match(/\/api\/(?:pointer|notes)\/([^/]+)\/([^/]+)/);
    if (urlMatch) { req.params.id = urlMatch[2]; }
    const res = { _code: 200, status(c) { this._code = c; return this; }, json(o) { resolve({ code: this._code, body: o }); } };
    try {
      const r = h(req, res);
      if (r && r.catch) r.catch((e) => resolve({ code: 500, threw: String(e && e.message) }));
    } catch (e) { resolve({ code: 500, threw: String(e && e.message) }); }
  });
}

(async () => {
  let pass = 0, fail = 0;
  const ok = (n, c, x) => { if (c) { pass++; console.log('  [OK] ' + n); } else { fail++; console.log('  [BAD] ' + n + (x ? ' :: ' + x : '')); } };

  console.log('== pairing endpoints ==');
  const mint = await call('POST', '/api/pairing/secret', { deviceId: 'phone-1' });
  ok('mint returns secret + ttl', mint.code === 200 && mint.body.ok === true && typeof mint.body.secret === 'string' && mint.body.ttlSeconds === 600);
  const pid = mint.body.pairingId;
  const sec = mint.body.secret;

  const verify = await call('POST', '/api/pairing/verify', { pairingId: pid, secret: sec });
  ok('verify correct secret', verify.code === 200 && verify.body.ok === true && verify.body.deviceId === 'phone-1');

  const reuse = await call('POST', '/api/pairing/verify', { pairingId: pid, secret: sec });
  ok('reuse rejected 410', reuse.code === 410 && reuse.body.code === 'ALREADY_USED');

  const mint2 = await call('POST', '/api/pairing/secret', { deviceId: 'phone-2' });
  const wrong = await call('POST', '/api/pairing/verify', { pairingId: mint2.body.pairingId, secret: 'nope' });
  ok('wrong secret 403', wrong.code === 403 && wrong.body.code === 'INVALID');

  const disc = await call('GET', '/api/pairing/discover');
  ok('discover returns endpoints', disc.code === 200 && disc.body.discovery.endpoints.mint === '/api/pairing/secret');

  console.log('== notes endpoints ==');
  const ns = await call('POST', '/api/notes/session/start', {});
  ok('notes session start', ns.code === 200 && ns.body.ok === true && ns.body.session.id);

  const chunk = await call('POST', '/api/notes/chunk-meta', { sessionId: ns.body.session.id, audioPath: 'chunk_0.aac', index: 0, bytes: 1024 });
  ok('notes chunk accepted', chunk.code === 200 && chunk.body.ok === true);

  const stop = await call('POST', '/api/notes/session/stop', { sessionId: ns.body.session.id, dir: ns.body.session.dir });
  ok('notes stop works', stop.code === 200 && stop.body.ok === true);

  const missingNotes = await call('GET', '/api/notes/note_nope');
  ok('notes 404 for missing', missingNotes.code === 404 && missingNotes.body.code === 'NOT_FOUND');

  console.log('== voice endpoints ==');
  const press = await call('POST', '/api/pointer/voice/press', { sessionId: 'v1' });
  ok('voice press starts listening', press.code === 200 && press.body.state === 'listening');

  const release = await call('POST', '/api/pointer/voice/release', { sessionId: 'v1' });
  ok('voice release goes to thinking', release.code === 200 && release.body.state === 'thinking');

  const reply = await call('POST', '/api/pointer/voice/reply', { sessionId: 'v1', text: 'hello' });
  ok('voice reply goes to speaking + chirp', reply.code === 200 && reply.body.state === 'speaking' && typeof reply.body.chirp === 'string');

  const bubble = await call('GET', '/api/pointer/voice/bubble?text=hello%20world');
  ok('bubble returns escaped HTML', bubble.code === 200 && bubble.body.html.indexOf('hello world') >= 0);

  const pressBad = await call('POST', '/api/pointer/voice/press', { sessionId: 'v1' });
  ok('voice press from idle ok', pressBad.code === 200);

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
