'use strict';
/**
 * Phase 23 task timeline tests. Seeds temp stores for all three sources
 * (event bus, safety broker, agent workspace) then verifies build/summary/
 * today/render/router/agi registration.
 * Run: NODE_PATH="<repo>\resources\app\node_modules" node tests\test_timeline.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p23_'));
process.env.MYRAA_EVENTS_DB = path.join(tmp, 'events.jsonl');
process.env.MYRAA_BROKER_DB = path.join(tmp, 'broker.json');
process.env.MYRAA_WORKSPACE_DB = path.join(tmp, 'workspace.json');

const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const timeline = require(path.join(DIST, 'task_timeline.cjs'));
const bus = require(path.join(DIST, 'event_bus.cjs'));
const brokerMod = require(path.join(DIST, 'safety_broker.cjs'));
const wsMod = require(path.join(DIST, 'agent_workspace.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  // ---- seed events
  bus.emit('task.recognized', { intent: 'git_status', message: 'git status' });
  bus.emit('tool.executed', { tool: 'connector_wikipedia_search', ok: false }, { severity: 'error' });
  bus.emit('system.server_start', { version: 'test' });

  // ---- seed broker bindings (one waiting, one executed)
  const engine = {
    calls: [],
    async execute(name, params, opts) { this.calls.push({ name, params, opts }); return { success: true, result: { echo: 1 } }; },
  };
  const broker = brokerMod.createBroker({ storePath: process.env.MYRAA_BROKER_DB, engine });
  const r1 = broker.requestApproval({ tool: 'test_tool_high', risk: 'HIGH', params: { q: 'one' }, summary: 'high risk demo' });
  check('broker binding 1 created (waiting)', r1.ok === true && r1.binding.status === 'waiting');
  const r2 = broker.requestApproval({ tool: 'test_tool_two', risk: 'CRITICAL', params: { q: 'two' }, summary: 'second demo' });
  check('broker binding 2 created', r2.ok === true);

  const ws = wsMod.createWorkspace({});
  const d = ws.decideApproval({ id: r2.binding.approvalId, decision: 'approve', decidedBy: 'tester' });
  check('workspace card approved', d.ok === true);
  const sync = broker.syncWithWorkspace();
  check('broker synced with workspace', sync.ok === true);
  const ex = await broker.executeBinding(r2.binding.id);
  check('binding 2 executed', ex.ok === true);

  // ---- seed a routine
  const cr = ws.createRoutine({ spec: { kind: 'daily', time: '07:30' }, instruction: 'summarize the news', phrase: 'morning news brief' });
  check('routine created', cr.ok === true);

  // ---- build
  const b1 = timeline.build({ limit: 30 });
  check('build ok', b1.ok === true);
  check('sources honest booleans', typeof b1.sources.events === 'boolean' && typeof b1.sources.broker === 'boolean' && typeof b1.sources.workspace === 'boolean');
  check('all sources reachable', b1.sources.events === true && b1.sources.broker === true && b1.sources.workspace === true);

  const kinds = b1.items.map((x) => x.kind);
  check('event item present', kinds.includes('event'));
  check('error item present', kinds.includes('error'));
  check('approval item present (executed binding)', kinds.includes('approval'));
  check('pending items present (waiting binding + open card)', kinds.filter((k) => k === 'pending').length >= 2);
  check('scheduled routine in upcoming', b1.upcoming.length >= 1 && b1.upcoming[0].kind === 'scheduled');

  const times = b1.items.map((x) => Date.parse(x.at));
  const sorted = times.every((t, idx) => idx === 0 || times[idx - 1] >= t);
  check('items sorted newest first', sorted);
  check('item shape complete', b1.items.every((x) => x.at && x.kind && x.source && x.ref && x.text));

  // ---- summary
  const s1 = timeline.summary({ limit: 30 });
  check('summary counts match items', s1.counts.events === kinds.filter((k) => k === 'event').length && s1.counts.errors === kinds.filter((k) => k === 'error').length);
  check('summary sample is text lines', Array.isArray(s1.sample) && s1.sample.length > 0 && typeof s1.sample[0] === 'string');

  // ---- today window
  const t1 = timeline.today();
  const start = new Date(Date.parse(t1.windowStart));
  check('today starts at local midnight', start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0);
  check('today contains fresh seeded items', t1.items.length >= 3);

  // ---- since filter
  const bf = timeline.build({ sinceMs: Date.now() + 86400000 });
  check('future window yields no past items', bf.items.length === 0 && bf.upcoming.length === 0);

  // ---- render
  const lines = timeline.render(b1, 5);
  check('render bounded to maxLines + upcoming', lines.length <= 5 + 3 && lines.every((l) => l.startsWith('- ')));
  const empty = timeline.render({ items: [], upcoming: [] });
  check('render honest when empty', empty.length === 1 && /no activity/.test(empty[0]));

  // ---- cap
  for (let i = 0; i < 80; i++) bus.emit('task.progress', { message: 'bulk ' + i });
  const bc = timeline.build({ limit: 999 });
  check('item cap respected', bc.items.length <= timeline.ITEM_CAP);

  // ---- agi tools
  const fakeEngine = { registered: {}, register(name, spec) { this.registered[name] = spec; } };
  const reg = timeline.registerAgiTools(fakeEngine);
  check('agi tools registered', reg.ok === true && reg.count === 2 && !!fakeEngine.registered.timeline_summary && !!fakeEngine.registered.timeline_today);
  const toolOut = await fakeEngine.registered.timeline_summary.fn({});
  check('timeline_summary fn returns counts', toolOut.ok === true && toolOut.counts && typeof toolOut.counts.events === 'number');

  // ---- router
  const router = timeline.createRouter();
  check('router builds (express available) or null', router === null || typeof router.use === 'function');

  console.log('');
  console.log('task_timeline tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
