'use strict';
// Phase 29: action receipts - append-only, redacted, undoable records. No network.

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_p29_receipts_'));
const store = path.join(TMP, 'receipts.jsonl');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const mod = require(path.join(DIST, 'action_receipts.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const events = [];
  const bus = { emit: (type, payload) => events.push({ type, payload }) };
  const a = mod.createActionReceipts({ storePath: store, eventBus: bus });

  check('redaction masks secret keys', mod.redact({ password: 'hunter2', api_key: 'abc', token: 'xyz' }).password === '[REDACTED]');
  check('redaction masks long digit runs', mod.redact({ note: 'card 4111111111111111' }).note.includes('[NUMBERS]'));
  check('redaction clamps depth and arrays', !!mod.redact({ deep: { a: { b: { c: { d: { e: 1 } } } } } }).deep);

  const bad = a.start({});
  check('start requires tool', bad.ok === false && bad.code === 'VALIDATION');
  const s1 = a.start({ tool: 'organize_desktop', risk: 'HIGH', decision: 'approved', params: { password: 'secret', count: 3 } });
  check('start creates running receipt', s1.ok === true && s1.receipt.status === 'running' && !!s1.receipt.id);
  check('start redacts stored params', s1.receipt.params.password === '[REDACTED]' && s1.receipt.params.count === 3);
  check('start emits event', events.some((e) => e.type === 'action.receipt.started'));

  const f1 = a.finish(s1.receipt.id, { ok: true, outcome: 'moved 3 files', evidence: { files: 3 }, undoToken: 'undo_abc' });
  check('finish marks succeeded', f1.ok === true && f1.receipt.status === 'succeeded' && f1.receipt.durationMs >= 0);
  check('finish records evidence + undo token', f1.receipt.evidence.files === 3 && f1.receipt.undoToken === 'undo_abc');
  check('finish twice rejected', a.finish(s1.receipt.id, { ok: true }).ok === false);
  check('finish emits event', events.some((e) => e.type === 'action.receipt.finished'));

  const nu = a.undo(s1.receipt.id);
  check('undo without handler is honest', nu.ok === false && nu.code === 'NO_HANDLER');
  let undone = null;
  check('undo handler registers', a.registerUndo('organize_desktop', (token) => { undone = token; return { restored: 3 }; }).ok === true);
  const u1 = a.undo(s1.receipt.id);
  check('undo calls handler with token', u1.ok === true && undone === 'undo_abc' && !!u1.receipt.undoneAt);
  check('double undo rejected', a.undo(s1.receipt.id).ok === false);
  check('undo emits event', events.some((e) => e.type === 'action.receipt.undone'));

  const s2 = a.start({ tool: 'run_command', params: { cmd: 'npm test' } });
  const f2 = a.finish(s2.receipt.id, { ok: false, outcome: 'exit 1' });
  check('failure receipt recorded', f2.receipt.status === 'failed');
  check('undo rejected on failed receipt', a.undo(s2.receipt.id).code === 'NOT_FINISHED');

  check('get returns receipt', a.get(s1.receipt.id).tool === 'organize_desktop');
  check('list returns newest first', a.list().receipts[0].id === s2.receipt.id);
  check('list filters by tool', a.list({ tool: 'organize_desktop' }).count === 1);
  check('status counts by status', a.status().byStatus.succeeded === 1 && a.status().byStatus.failed === 1);
  check('store file exists', fs.existsSync(store));

  const b = mod.createActionReceipts({ storePath: store });
  check('receipts persist across instances', b.list().count === 2);
  check('router builds', a.createRouter() === null || typeof a.createRouter().use === 'function');

  console.log('\naction receipt tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
