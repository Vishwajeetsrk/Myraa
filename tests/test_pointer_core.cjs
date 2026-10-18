'use strict';
/**
 * MYRAA Pointer core — tests (Phase 11 / Pointer Phase 1).
 * Run: node tests/test_pointer_core.cjs (from repo root).
 * Pure-logic tests; Windows execution paths use honest refusal codes.
 */
const pointer = require('../resources/app/dist/pointer_core.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

console.log('== text-id resolution ==');
const controlMap = [
  { id: 'uia_1', name: 'Email', type: 'Edit' },
  { id: 'uia_2', name: 'Password', type: 'Edit', isPassword: true },
  { id: 'uia_3', name: 'Submit button', type: 'Button' },
  { id: 'uia_4', name: 'Search field', type: 'Edit' },
];
const t1 = pointer.findTextId(controlMap, 'Email');
ok('exact match returns textId', t1 && t1.textId === 'uia_1' && t1.confidence === 1.0, JSON.stringify(t1));
const t2 = pointer.findTextId(controlMap, 'search');
ok('partial match returns shortest name', t2 && t2.textId === 'uia_4' && t2.confidence === 0.8, JSON.stringify(t2));
const t3 = pointer.findTextId(controlMap, 'submit');
ok('button match works', t3 && t3.textId === 'uia_3');
const t4 = pointer.findTextId(controlMap, 'nonexistent');
ok('no match returns null', t4 === null);
const t5 = pointer.findTextId(null, 'x');
ok('null controlMap returns null', t5 === null);
const t6 = pointer.findTextId(controlMap, 'Password');
ok('password field excluded from text-id search', t6 === null);

console.log('== password detection ==');
ok('isPassword by flag', pointer.isPassword({ type: 'Edit', isPassword: true }) === true);
ok('isPassword by name', pointer.isPassword({ name: 'Password', type: 'Edit' }) === true);
ok('isPassword rejects normal edit', pointer.isPassword({ name: 'Email', type: 'Edit' }) === false);
ok('isPassword rejects button', pointer.isPassword({ name: 'Submit', type: 'Button' }) === false);

console.log('== grid conversion ==');
const g1 = pointer.screenToGrid(960, 540, 1920, 1080);
ok('screen center -> grid 500/500', g1.x === 500 && g1.y === 500, JSON.stringify(g1));
const s1 = pointer.gridToScreen({ x: 500, y: 500 }, 1920, 1080);
ok('grid 500/500 -> screen center', s1.x === 960 && s1.y === 540, JSON.stringify(s1));
const g2 = pointer.screenToGrid(0, 0, 1920, 1080);
ok('origin -> grid 0/0', g2.x === 0 && g2.y === 0);
const g3 = pointer.screenToGrid(1920, 1080, 1920, 1080);
ok('bottom-right -> grid 1000/1000', g3.x === 1000 && g3.y === 1000);

console.log('== guardrails ==');
const gr1 = pointer.guardrailRejects('open_app', 'Task Manager');
ok('task manager refused', gr1.allowed === false && /hard-to-undo/.test(gr1.message));
const gr2 = pointer.guardrailRejects('open_app', 'logout');
ok('logout refused', gr2.allowed === false);
const gr3 = pointer.guardrailRejects('open_app', 'notepad');
ok('notepad allowed', gr3.allowed === true);
const gr4 = pointer.guardrailRejects('press_keys', 'ctrl+alt+del');
ok('ctrl+alt+del refused', gr4.allowed === false);
const gr5 = pointer.guardrailRejects('press_keys', 'win+l');
ok('win+l refused', gr5.allowed === false);
const gr6 = pointer.guardrailRejects('press_keys', 'ctrl+shift+esc');
ok('ctrl+shift+esc refused', gr6.allowed === false);
const gr7 = pointer.guardrailRejects('press_keys', 'ctrl+c');
ok('ctrl+c allowed', gr7.allowed === true);

console.log('== target password check ==');
ok('targetIsPassword true for password id', pointer.targetIsPassword({ textId: 'uia_2' }, controlMap) === true);
ok('targetIsPassword false for normal id', pointer.targetIsPassword({ textId: 'uia_1' }, controlMap) === false);
ok('targetIsPassword false without controlMap', pointer.targetIsPassword({ textId: 'uia_2' }, null) === false);

console.log('== point / act (mock services) ==');
const mockServices = {
  ok: true,
  desktop: {
    clickAt: () => ({ ok: true }),
    typeText: () => ({ ok: true }),
    pressKey: () => ({ ok: true }),
    scroll: () => ({ ok: true }),
    drag: () => ({ ok: true }),
    openApp: () => ({ ok: true }),
    openUrl: () => ({ ok: true }),
  },
  ui: { invokeControl: () => ({ ok: true }) },
};
const p1 = pointer.point({ textId: 'uia_2' }, controlMap, mockServices);
ok('point at password refused', p1.ok === false && p1.code === 'GUARDRAIL_REFUSED', JSON.stringify(p1));
const p2 = pointer.point({ textId: 'uia_1' }, controlMap, mockServices);
ok('point at normal id ok', p2.ok === true && p2.target === 'uia_1', JSON.stringify(p2));
const p3 = pointer.point({ grid: { x: 100, y: 200 } }, null, mockServices);
ok('grid point ok', p3.ok === true && p3.target.x === 100 && p3.target.y === 200);
const p4 = pointer.point(null, null, mockServices);
ok('point without target errors', p4.ok === false);

const a1 = pointer.act('click', { x: 100, y: 200 }, { services: mockServices });
ok('act click ok', a1.ok === true && a1.kind === 'click');
const a2 = pointer.act('open_app', 'logout');
ok('act logout refused', a2.ok === false && a2.code === 'GUARDRAIL_REFUSED');
const a3 = pointer.act('click', { x: 1, y: 1 }, { requiresConfirm: true, services: mockServices });
ok('act requiring confirm blocked without token', a3.ok === false && a3.code === 'CONFIRMATION_REQUIRED');
const a4 = pointer.act('press_keys', 'win+l');
ok('act win+l refused', a4.ok === false && a4.code === 'GUARDRAIL_REFUSED');
const a5 = pointer.act('teleport', 'nowhere', { services: mockServices });
ok('unknown kind refused', a5.ok === false && a5.code === 'INVALID_JOB');
const a6 = pointer.act('type_text', 'hello', { services: mockServices });
ok('act type_text ok', a6.ok === true && a6.kind === 'type_text');

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
