'use strict';
/**
 * MYRAA Pointer routes — tests (Phase 11).
 * Stubs express + csDb so handler logic runs without the server/bridge.
 */
const Module = require('module');
const routes = {};
const stubRouter = { get: (p, h) => { routes['GET ' + p] = h; }, post: (p, h) => { routes['POST ' + p] = h; }, delete: (p, h) => { routes['DELETE ' + p] = h; } };
const stubExpress = Object.assign(() => ({}), { Router: () => stubRouter });
const origLoad = Module._load;
Module._load = function (request) { if (request === 'express') return stubExpress; return origLoad.apply(this, arguments); };

const dbCalls = [];
const sessionsDb = {};
global.__csDb = (cmd, payload) => {
  dbCalls.push({ cmd, payload });
  if (cmd === 'pp_session_save') { sessionsDb[payload.id] = Object.assign({}, payload); return { ok: true, id: payload.id }; }
  if (cmd === 'pp_session_get') {
    const s = sessionsDb[payload.id];
    return s ? { ok: true, session: s } : { ok: false, error: 'Not found' };
  }
  if (cmd === 'pp_action_save') { return { ok: true, id: payload.id }; }
  return { ok: true, id: (payload && payload.id) || 'x' };
};
const storeMod = { csDb: global.__csDb };
const pointerStub = {
  point: (target, controlMap) => {
    if (!target) return { ok: false, error: 'point needs target' };
    if (target.textId && controlMap) {
      const entry = controlMap.find((c) => c.id === target.textId);
      if (entry && (entry.isPassword === true || /password|passwd|pin/i.test(entry.name || ''))) {
        return { ok: false, code: 'GUARDRAIL_REFUSED', error: 'password fields cannot be pointed at' };
      }
    }
    if (target.grid) return { ok: true, target: target.grid, via: 'grid' };
    if (target.textId) return { ok: true, target: target.textId, via: 'uia' };
    return { ok: false, error: 'unrecognized target' };
  },
  act: (kind, detail, opts) => {
    if (kind === 'open_app' && /logout|lock|shutdown|restart|force.?quit/i.test(String(detail))) return { ok: false, code: 'GUARDRAIL_REFUSED' };
    if (kind === 'press_keys' && /^(ctrl\+alt\+del|ctrl\+shift\+esc|win\+l|alt\+f4)$/i.test(String(detail))) return { ok: false, code: 'GUARDRAIL_REFUSED' };
    if (opts && opts.requiresConfirm && !opts.confirmToken) return { ok: false, code: 'CONFIRMATION_REQUIRED' };
    return { ok: true, kind };
  },
  findTextId: (cm, q) => {
    const query = String(q || '').toLowerCase();
    const match = (cm || []).find((c) => {
      if (c.isPassword === true || /password|passwd|pin/i.test(c.name || '')) return false;
      return String(c.name || '').toLowerCase() === query;
    });
    return match ? { textId: match.id, name: match.name, confidence: 1 } : null;
  },
};
Module._load = function (request, parent) {
  if (request === 'express') return stubExpress;
  if (request === './course_studio_store.cjs') return storeMod;
  if (request === './pointer_core.cjs') return pointerStub;
  return origLoad.apply(this, arguments);
};
require('../resources/app/dist/pointer_routes.cjs');

function call(method, url, body) {
  return new Promise((resolve) => {
    let h = routes[method + ' ' + url];
    if (!h) {
      for (const key of Object.keys(routes)) {
        const [m, pattern] = key.split(' ');
        if (m !== method) continue;
        const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$');
        if (regex.test(url)) { h = routes[key]; break; }
      }
    }
    if (!h) { resolve({ __noHandler: true }); return; }
    const req = { body: body || {}, params: {} };
    const urlMatch = url.match(/\/api\/pointer\/session\/([^/]+)/);
    if (urlMatch) req.params.id = urlMatch[1];
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

  dbCalls.length = 0;
  const s = await call('POST', '/api/pointer/session/start', { mode: 'follow' });
  ok('session start 200 + persists', s.code === 200 && s.body && s.body.ok === true && s.body.session && s.body.session.id, JSON.stringify(s).slice(0, 140));
  const sid = s.body.session.id;
  ok('pp_session_save called', dbCalls.some((c) => c.cmd === 'pp_session_save'));

  const g = await call('GET', '/api/pointer/session/' + sid);
  ok('session get works', g.code === 200 && g.body.ok === true && g.body.session.id === sid);

  const st = await call('POST', '/api/pointer/session/stop', { id: sid });
  ok('session stop sets endedAt', st.code === 200 && st.body.session.endedAt !== null);

  const badStop = await call('POST', '/api/pointer/session/stop', { id: 'ptr_missing' });
  ok('stop missing session 404', badStop.code === 404 && badStop.body.code === 'NOT_FOUND');

  const pt = await call('POST', '/api/pointer/point', { sessionId: sid, target: { grid: { x: 10, y: 20 } }, controlMap: [] });
  ok('point grid 200', pt.code === 200 && pt.body.ok === true && pt.body.via === 'grid');
  ok('point action persisted', dbCalls.some((c) => c.cmd === 'pp_action_save'));

  const pw = await call('POST', '/api/pointer/point', {
    sessionId: sid,
    target: { textId: 'uia_pw' },
    controlMap: [{ id: 'uia_pw', name: 'Password', type: 'Edit', isPassword: true }],
  });
  ok('point at password 403', pw.code === 403 && pw.body.code === 'GUARDRAIL_REFUSED');

  const ac = await call('POST', '/api/pointer/action', { sessionId: sid, kind: 'click', detail: { x: 1, y: 2 } });
  ok('action click 200', ac.code === 200 && ac.body.ok === true);

  const al = await call('POST', '/api/pointer/action', { sessionId: sid, kind: 'open_app', detail: 'logout' });
  ok('action logout 403', al.code === 403 && al.body.code === 'GUARDRAIL_REFUSED');

  const cf = await call('POST', '/api/pointer/action', { sessionId: sid, kind: 'open_app', detail: 'notepad', requiresConfirm: true });
  ok('action without confirm token 428', cf.code === 428 && cf.body.code === 'CONFIRMATION_REQUIRED');

  const noSess = await call('POST', '/api/pointer/action', { kind: 'click', detail: {} });
  ok('action without sessionId 400', noSess.code === 400);

  const rid = await call('POST', '/api/pointer/resolve-text-id', {
    controlMap: [{ id: 'u1', name: 'Email', type: 'Edit' }, { id: 'u2', name: 'Password', type: 'Edit', isPassword: true }],
    query: 'email',
  });
  ok('resolve-text-id finds non-password', rid.code === 200 && rid.body.target.textId === 'u1');
  const ridPw = await call('POST', '/api/pointer/resolve-text-id', {
    controlMap: [{ id: 'u1', name: 'Email', type: 'Edit' }, { id: 'u2', name: 'Password', type: 'Edit', isPassword: true }],
    query: 'password',
  });
  ok('resolve-text-id never returns password', ridPw.code === 404);

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
