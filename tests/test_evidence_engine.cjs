'use strict';
/**
 * MYRAA Evidence Engine - tests (Phase 16).
 * Run: node tests/test_evidence_engine.cjs (from repo root).
 * No network, no repo writes: store uses a TEMP json file per run.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const evm = require('../resources/app/dist/evidence_engine.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const tmpStore = path.join(os.tmpdir(), 'myraa-evidence-test-' + Date.now() + '.json');

function mkEngine() {
  return evm.createEngine({ storePath: tmpStore });
}

async function main() {
  console.log('== module surface ==');
  ok('exports kinds', Array.isArray(evm.FINDING_KINDS) && Array.isArray(evm.EVIDENCE_KINDS));
  ok('sha256 known vector', evm.sha256('abc') === crypto.createHash('sha256').update('abc', 'utf8').digest('hex'));

  const eng = mkEngine();

  console.log('== sessions ==');
  const noLabel = eng.createSession({});
  ok('session rejects empty label', noLabel.ok === false && noLabel.code === 'VALIDATION');
  const s1 = eng.createSession({ label: 'build 1.4 report', subject: 'C:\\tmp\\app.exe' });
  ok('session created with id', s1.ok === true && String(s1.session.id).startsWith('evs_'));
  const s2 = eng.createSession({ label: 'build 1.5 report', subject: 'C:\\tmp\\app2.exe' });
  ok('second session ok', s2.ok === true && s2.session.id !== s1.session.id);
  const ls = eng.listSessions();
  ok('listSessions newest first + bounded', ls.ok === true && ls.sessions[0].id === s2.session.id && ls.sessions.length <= 50);

  console.log('== finding honesty rules ==');
  const fBadKind = eng.addFinding({ sessionId: s1.session.id, kind: 'guessy', inference: 'x' });
  ok('rejects unknown kind', fBadKind.ok === false && fBadKind.code === 'VALIDATION');
  const fNoEv = eng.addFinding({ sessionId: s1.session.id, kind: 'observed', inference: 'uses TLS pinning' });
  ok('observed without evidence rejected', fNoEv.ok === false && /evidence record/.test(fNoEv.error));
  const fNoConf = eng.addFinding({ sessionId: s1.session.id, kind: 'inferred', inference: 'probably vendored openssl' });
  ok('inferred without confidence rejected', fNoConf.ok === false && /confidence/.test(fNoConf.error));
  const fBadConf = eng.addFinding({ sessionId: s1.session.id, kind: 'inferred', inference: 'x', confidence: 5 });
  ok('confidence >1 rejected', fBadConf.ok === false && /confidence/.test(fBadConf.error));
  const fBadSess = eng.addFinding({ sessionId: 'evs_missing', kind: 'inferred', inference: 'x', confidence: 0.5 });
  ok('unknown session rejected', fBadSess.ok === false && /sessionId/.test(fBadSess.error));

  const known = 'usage of OpenSSL version 1.1.1k';
  const f1 = eng.addFinding({
    sessionId: s1.session.id, kind: 'observed',
    inference: 'Binary links OpenSSL 1.1.1k',
    sourceTool: 'strings',
    evidence: [{ kind: 'text', value: known, provenance: 'strings output slice 12' }],
  });
  ok('observed with evidence ok', f1.ok === true && f1.evidence.length === 1);
  ok('evidence sha256 of value', f1.evidence[0].sha256 === evm.sha256(known));

  const f2 = eng.addFinding({
    sessionId: s1.session.id, kind: 'inferred',
    inference: 'Surveillance-oriented package (auto-update + registry run key)',
    confidence: 0.62,
    sourceTool: 'code_review',
  });
  ok('inferred with confidence ok, no evidence needed', f2.ok === true && f2.finding.confidence === 0.62);

  console.log('== evidence attach + listing ==');
  const evAdd = eng.addEvidence({ findingId: f2.finding.id, kind: 'note', value: 'Run keys seen in offline sample #3', provenance: 'registry review' });
  ok('attach evidence to finding', evAdd.ok === true && evAdd.evidence[0].kind === 'note');
  const evBad = eng.addEvidence({ findingId: f2.finding.id, kind: 'hex', value: 'deadbeef' });
  ok('evidence kind restricted', evBad.ok === false && /evidence.kind/.test(evBad.error));
  const listF = eng.listFindings({ sessionId: s1.session.id });
  ok('listFindings joins evidence hashes', listF.ok === true && listF.findings.some((x) => x.evidence.length >= 1 && x.evidence[0].sha256.length === 64));
  ok('inferred finding carries confidence, observed does not', listF.findings.some((x) => x.kind === 'inferred' && x.confidence === 0.62) && listF.findings.some((x) => x.kind === 'observed' && x.confidence === undefined));

  console.log('== unknowns ==');
  const u1 = eng.addUnknown({ sessionId: s1.session.id, question: 'What packer? attempted strings only', attemptedTools: ['strings'] });
  ok('unknown created', u1.ok === true && u1.unknown.resolved === false);
  const uResolve = eng.resolveUnknown({ id: u1.unknown.id, resolution: 'UPX-like section names, not UPX header' });
  ok('unknown resolved', uResolve.ok === true && uResolve.unknown.resolved === true);
  const uBad = eng.resolveUnknown({ id: 'evu_missing', resolution: 'x' });
  ok('unknown id validated', uBad.ok === false && /unknown id/.test(uBad.error));

  console.log('== compare + caps ==');
  const f3 = eng.addFinding({
    sessionId: s2.session.id, kind: 'observed',
    inference: 'New: telemetry endpoint ping.example',
    sourceTool: 'strings',
    evidence: [{ kind: 'text', value: 'https://ping.example/beat' }],
  });
  ok('finding on session 2 ok', f3.ok === true);
  const cmp = eng.compareSessions({ a: s1.session.id, b: s2.session.id });
  ok('compare validates ids', cmp.ok === true);
  ok('compare finds b-only finding', cmp.summary.onlyInB === 1 && cmp.summary.shared === 0 && cmp.summary.onlyInA === 2);
  const cmpBad = eng.compareSessions({ a: 'evs_x', b: 'evs_y' });
  ok('compare rejects unknown sessions', cmpBad.ok === false && /not found/.test(cmpBad.error));

  const bounded = eng.listFindings({ sessionId: s1.session.id, limit: 1 });
  ok('output caps honored', bounded.ok === true && bounded.findings.length === 1 && bounded.capped === true);

  console.log('== persistence ==');
  const eng2 = mkEngine();
  const st2 = eng2.status();
  ok('new engine instance loads same store', st2.ok === true && st2.counts.sessions === eng.status().counts.sessions && st2.counts.findings > 0);
  const st = eng.status();
  ok('status counts sane', st.counts.sessions === 2 && st.counts.findings === 3 && st.counts.unknowns === 1 && st.counts.evidence >= 2);

  fs.closeSync(fs.openSync(tmpStore, 'a'));
  const raw = JSON.parse(fs.readFileSync(tmpStore, 'utf8'));
  ok('store file has 4 collections', ['sessions', 'findings', 'evidence', 'unknowns'].every((k) => Array.isArray(raw[k])));

  console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('test crashed:', e.message); process.exit(1); });
