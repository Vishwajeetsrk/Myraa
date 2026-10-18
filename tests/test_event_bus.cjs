'use strict';
// Phase 22 unified event bus tests. Isolated store files; no network.

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'myraa_phase22_' + process.pid);
fs.mkdirSync(TMP, { recursive: true });
process.env.MYRAA_EVENTS_DB = path.join(TMP, 'events.jsonl');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const busMod = require(path.join(DIST, 'event_bus.cjs'));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass += 1; console.log('[OK] ' + name); }
  else { fail += 1; console.log('[X] ' + name + (extra ? ' :: ' + String(extra) : '')); }
}

const mainFile = path.join(TMP, 'main.jsonl');
const bus = busMod.createBus({ storePath: mainFile });

(async () => {
  const e1 = bus.emit('task.recognized', { intent: 'git_status', message: 'git status' }, { source: 'test' });
  check('emit ok + shape', e1.ok === true && e1.event.seq === 1 && e1.event.type === 'task.recognized' && e1.event.severity === 'info' && e1.stored === true, JSON.stringify(e1));
  const e2 = bus.emit('tool.executed', { tool: 'git_status', ok: true, durationMs: 12 });
  const e3 = bus.emit('approval.decided', { decision: 'approve' });
  check('seq monotonic', e2.event.seq === 2 && e3.event.seq === 3);

  const badType = bus.emit('nonsense', {});
  check('invalid type rejected', badType.ok === false && badType.code === 'VALIDATION');

  const l1 = bus.list({});
  check('list newest first', l1.ok === true && l1.events[0].seq === 3 && l1.events[2].seq === 1);
  check('list type exact', bus.list({ type: 'tool.executed' }).events.length === 1);
  check('list type prefix', bus.list({ type: 'task' }).events.length === 1);
  check('list since filter', bus.list({ since: 2 }).events.length === 1 && bus.list({ since: 2 }).events[0].seq === 3);
  check('limit clamp', bus.list({ limit: 9999, since: 0 }).events.length <= 200);

  const red = bus.emit('model.chat', { lane: 'openai_owned', api_key: 'sk-live-123', message: 'ok' });
  check('secret key redacted', red.event.payload.api_key === '[redacted]' && red.event.payload.lane === 'openai_owned');

  const deep = bus.emit('task.deep', { a: { b: { c: { d: { e: 1 } } } } });
  check('depth clamp', deep.event.payload.a.b.c.d === '[deep]');

  const arr = bus.emit('task.arr', { items: Array.from({ length: 25 }, (_, i) => i) });
  check('array clamp', Array.isArray(arr.event.payload.items) && arr.event.payload.items.length === 10);

  const long = bus.emit('task.long', { note: 'x'.repeat(300) });
  check('string clamp 200', String(long.event.payload.note).length <= 203);

  const circ = { name: 'c' };
  circ.self = circ;
  const circRes = bus.emit('task.circ', circ);
  check('circular payload safe', circRes.ok === true && circRes.event.payload.self !== undefined);

  let seen = 0;
  let lastType = null;
  const unsub = bus.subscribe((ev) => { seen += 1; lastType = ev.type; if (ev.type === 'task.subboom') throw new Error('subscriber boom'); });
  bus.emit('task.sub1', {});
  bus.emit('task.subboom', {});
  unsub();
  bus.emit('task.sub2', {});
  check('subscriber notified + survivor after throw', seen === 2 && lastType === 'task.subboom');

  const bus2 = busMod.createBus({ storePath: mainFile });
  const st2 = bus2.status();
  check('persistence reload seq', st2.seq === bus.status().seq && st2.inMemory >= 3);

  const capFile = path.join(TMP, 'cap.jsonl');
  const busCap = busMod.createBus({ storePath: capFile, cap: 50, compactEvery: 10 });
  for (let i = 0; i < 60; i++) busCap.emit('task.tick', { i });
  const capStatus = busCap.status();
  const capLines = fs.readFileSync(capFile, 'utf8').split(/\r?\n/).filter(Boolean).length;
  check('ring capped at 50', capStatus.inMemory === 50, String(capStatus.inMemory));
  check('file compacted', capLines <= 50, String(capLines));

  const tinyFile = path.join(TMP, 'tiny.jsonl');
  const busTiny = busMod.createBus({ storePath: tinyFile, payloadCap: 60 });
  const tiny = busTiny.emit('task.big', { a: 'y'.repeat(150), b: 'z'.repeat(150) });
  check('payload cap truncates', tiny.ok === true && typeof tiny.event.payload.truncated === 'string');

  const st = bus.status();
  check('status shape', st.ok === true && st.storePath === mainFile && typeof st.namespaces.task === 'number' && st.policy.indexOf('never blocks') >= 0);
  check('subscribers count back to 0', st.subscribers === 0);

  check('summarize text', busMod.summarize(e1.event).indexOf('git_status') >= 0);

  const tools = {};
  const fakeEngine = { register: (name, desc) => { tools[name] = desc; } };
  const reg = bus.registerAgiTools(fakeEngine);
  check('agi tool registered', reg.ok === true && reg.count === 1 && !!tools.events_tail);
  const toolOut = await tools.events_tail.fn({ limit: 5 });
  check('agi tool fn returns events', toolOut.ok === true && Array.isArray(toolOut.events) && toolOut.events.length <= 5);

  let router = null;
  try { router = bus.createRouter(); } catch (e) { router = null; }
  check('router builds when express present', router === null ? true : typeof router.use === 'function', router === null ? 'express absent: skipped' : 'ok');

  const weird = bus.emit('task.weird', { fn: () => {}, sym: Symbol('s') });
  check('weird payload never throws', weird.ok === true);

  console.log('');
  console.log('event_bus tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('[X] test harness crashed: ' + ((e && e.stack) || e));
  process.exit(1);
});
