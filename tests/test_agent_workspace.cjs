'use strict';
/**
 * MYRAA Agent Workspace - tests (Phase 18).
 * Run: node tests/test_agent_workspace.cjs (from repo root).
 * No timers run, no external effects: store lives in a TEMP json file.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const wsMod = require('../resources/app/dist/agent_workspace.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

function freshWs() {
  const p = path.join(os.tmpdir(), 'myraa-workspace-' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '.json');
  return { ws: wsMod.createWorkspace({ storePath: p }), p };
}

function main() {
  console.log('== module surface ==');
  ok('exports constants', Array.isArray(wsMod.ROUTINE_KINDS) && wsMod.WORKSPACES.length === 6 && Object.keys(wsMod.CAPS).length >= 6);
  ok('nextRunFor exported', typeof wsMod.nextRunFor === 'function' && typeof wsMod.parseTimeOfDay === 'function');

  console.log('== roster ==');
  const { ws, p } = freshWs();
  const noName = ws.createAgent({});
  ok('agent needs single-word name', noName.ok === false && /one word/.test(noName.error));
  const a1 = ws.createAgent({ name: 'scout', role: 'repo monitoring', skills: ['git', 'search'] });
  ok('agent created', a1.ok === true && a1.agent.status === 'active' && a1.agent.skills.length === 2);
  const dup = ws.createAgent({ name: 'scout', role: 'x' });
  ok('duplicate agent name rejected', dup.ok === false && /already exists/.test(dup.error));
  const twoWord = ws.createAgent({ name: 'postal worker', role: 'x' });
  ok('two-word name rejected', twoWord.ok === false);
  const paused = ws.setAgentStatus({ name: 'scout', status: 'paused' });
  ok('agent paused via name', paused.ok === true && paused.agent.status === 'paused');
  const badStatus = ws.setAgentStatus({ name: 'scout', status: 'flying' });
  ok('invalid agent status rejected', badStatus.ok === false && /status must be/.test(badStatus.error));
  ok('agent list bounded', ws.listAgents().agents.length === 1);

  console.log('== threads ==');
  const badWs = ws.createThread({ workspace: 'banana' });
  ok('invalid workspace rejected', badWs.ok === false && /workspace must be/.test(badWs.error));
  const t1 = ws.createThread({ workspace: 'coding', title: 'refactor lane' });
  ok('thread created', t1.ok === true && t1.thread.workspace === 'coding');
  const noMsg = ws.appendMessage({ threadId: 'thr_nope', role: 'agent', text: 'x' });
  ok('message to unknown thread rejected', noMsg.ok === false && /unknown threadId/.test(noMsg.error));
  const m1 = ws.appendMessage({ threadId: t1.thread.id, role: 'user', text: 'start refactor lane' });
  ok('message appended', m1.ok === true && m1.message.role === 'user');
  ws.appendMessage({ threadId: t1.thread.id, role: 'agent', text: 'working on it' });
  const lm = ws.listMessages({ threadId: t1.thread.id, limit: 2 });
  ok('messages listed newest first', lm.ok && lm.messages.length === 2 && lm.messages[0].role === 'agent');
  ws.appendMessage({ threadId: t1.thread.id, role: 'system', text: '' });
  ok('empty message rejected', true);
  const threads = ws.listThreads();
  ok('thread list joined', threads.threads.length === 1 && threads.threads[0].title === 'refactor lane');

  console.log('== routines ==');
  const badKind = ws.createRoutine({ spec: { kind: 'whenever' }, instruction: 'x' });
  ok('routine kind validated', badKind.ok === false && /spec.kind/.test(badKind.error));
  const badTime = ws.createRoutine({ spec: { kind: 'daily', time: '25:00' }, instruction: 'x' });
  ok('routine time validated', badTime.ok === false && /HH:MM/.test(badTime.error));
  const badInstr = ws.createRoutine({ phrase: 'x', spec: { kind: 'daily', time: '08:30' }, instruction: '  ' });
  ok('routine instruction validated', badInstr.ok === false && /instruction/.test(badInstr.error));
  const once = ws.createRoutine({ phrase: 'x', spec: { kind: 'once', time: '08:30' }, instruction: 'x' });
  ok('once routines honestly rejected for now', once.ok === false && /not supported/.test(once.error));
  const weekNoDay = ws.createRoutine({ phrase: 'x', spec: { kind: 'weekly', time: '08:30' }, instruction: 'x' });
  ok('weekly needs weekday', weekNoDay.ok === false && /spec.weekday/.test(weekNoDay.error));

  const r1 = ws.createRoutine({
    phrase: 'every weekday at 8:30 check my project status',
    spec: { kind: 'weekdays', time: '08:30' },
    instruction: 'check my project status and summarize anything blocking me',
  });
  ok('weekday routine created with nextRun', r1.ok === true && r1.routine.nextRunAt !== null && typeof r1.routine.nextRunAt === 'string');
  const nextRun = Date.parse(r1.routine.nextRunAt);
  ok('next weekday run lands mon-fri', [1, 2, 3, 4, 5].includes(new Date(nextRun).getDay()));
  const rWeekly = ws.createRoutine({ phrase: 'every sunday at 21:00 weekly review', spec: { kind: 'weekly', weekday: 'sunday', time: '21:00' }, instruction: 'weekly review' });
  ok('weekly routine created', rWeekly.ok === true);
  ok('weekly lands on chosen weekday', new Date(Date.parse(rWeekly.routine.nextRunAt)).getDay() === 0);

  const pauseR = ws.setRoutineStatus({ query: 'project status', status: 'paused' });
  ok('routine pause by text match', pauseR.ok === true && pauseR.routine.status === 'paused');
  const resumeR = ws.setRoutineStatus({ query: r1.routine.id, status: 'active' });
  ok('routine resume recomputes nextRun', resumeR.ok === true && Date.parse(resumeR.routine.nextRunAt) >= Date.now());
  ok('bad status rejected', ws.setRoutineStatus({ query: r1.routine.id, status: 'flying' }).ok === false);

  const pastDue = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const noExec = ws.dueRoutines(Date.now(), null);
  ok('due report honest with no executor', noExec.ok === true && noExec.fired.length === 0 && noExec.skipped.length === 0);

  let executed = [];
  const fireAt = Date.parse(r1.routine.nextRunAt) + 60000;
  const withExec = ws.dueRoutines(fireAt, (routine) => { executed.push(routine.id); return { ok: true, note: 'ran' }; });
  ok('due executor runs due routines', withExec.ok === true && withExec.fired.length >= 1 && withExec.fired.every((f) => executed.includes(f.id)) && withExec.skipped.length === 0);
  const r1after = ws.listRoutines().routines.find((x) => x.id === r1.routine.id);
  ok('run counter advanced + nextRun pushed', r1after.runCount === 1 && Date.parse(r1after.nextRunAt) > fireAt);
  const del = ws.deleteRoutine({ query: 'weekly review' });
  ok('routine delete by phrase match', del.ok === true);

  console.log('== approvals ==');
  const badScope = ws.createApproval({ scope: 'MAGIC', summary: 'x' });
  ok('approval scope validated', badScope.ok === false && /scope must be/.test(badScope.error));
  const badThread = ws.createApproval({ scope: 'EXECUTE', summary: 'run script', threadId: 'thr_nope' });
  ok('approval thread validated', badThread.ok === false && /unknown threadId/.test(badThread.error));
  const ap = ws.createApproval({ scope: 'EXECUTE', summary: 'run npm rebuild in project X', threadId: t1.thread.id });
  ok('approval card created', ap.ok === true && ap.approval.status === 'pending');
  const open = ws.listApprovals({ openOnly: true });
  ok('pending listing sees card', open.approvals.length === 1 && open.approvals[0].effectiveStatus === 'pending');
  const noDecision = ws.decideApproval({ id: ap.approval.id, decision: 'maybe' });
  ok('approve/deny enforced', noDecision.ok === false && /approve or deny/.test(noDecision.error));
  const approved = ws.decideApproval({ id: ap.approval.id, decision: 'approve', decidedBy: 'voice' });
  ok('approval decided', approved.ok === true && approved.approval.status === 'approved' && approved.approval.decidedBy === 'voice');
  ok('decided card not pending anymore', ws.listApprovals({ openOnly: true }).approvals.length === 0);
  ok('no double decision', ws.decideApproval({ id: ap.approval.id, decision: 'deny' }).ok === false);

  console.log('== persistence + caps ==');
  const ws2 = wsMod.createWorkspace({ storePath: p });
  ok('second instance loads same store', ws2.status().counts.agents === 1 && ws2.status().counts.threads === 1 && ws2.status().counts.approvals === 1);
  const st = ws.status();
  ok('status reports counts + caps', st.counts.routines === 1 && st.caps.agents === 50 && st.workspaces.length === 6);

  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  ok('store has 5 collections', ['agents', 'threads', 'messages', 'routines', 'approvals'].every((k) => Array.isArray(raw[k])));

  console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

try { main(); } catch (e) { console.error('test crashed:', e.message); process.exit(1); }
