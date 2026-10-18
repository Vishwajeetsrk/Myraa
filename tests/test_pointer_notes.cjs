'use strict';
/**
 * MYRAA Pointer notes — tests (Phase 11 / Pointer Phase 3).
 * Run: node tests/test_pointer_notes.cjs (from repo root).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const notes = require('../resources/app/dist/pointer_notes.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const tmpRoot = path.join(os.tmpdir(), 'myraa-notes-test-' + Date.now());
process.env.MYRAA_NOTES_DIR = tmpRoot;
const fresh = require('../resources/app/dist/pointer_notes.cjs');

(async () => {
  console.log('== notes session lifecycle ==');
  const s = fresh.createNotesSession();
  ok('session starts recording with dir', s.status === 'recording' && fs.existsSync(s.dir), s.dir);

  const c1 = path.join(s.dir, 'chunk_000.aac');
  fs.writeFileSync(c1, Buffer.alloc(1024, 1));
  const a1 = fresh.addChunk(s, 0, c1);
  ok('addChunk registers bytes', a1.ok === true && a1.chunk.bytes === 1024);
  const a2 = fresh.addChunk(s, 1, c1);
  ok('second chunk ok', a2.ok === true && s.chunks.length === 2);

  const w1 = fresh.writeSessionMeta(s);
  ok('session.json written', w1.ok === true && fs.existsSync(fresh.sessionJsonPath(s)));

  console.log('== transcription ==');
  const stubTranscriber = async () => ({ transcript: 'Alice: hello\nBob: hi there', speakers: 'Alice, Bob', provider: 'stub' });
  const tr = await fresh.transcribe(s, stubTranscriber);
  ok('transcript captured', tr.ok === true && s.transcript.indexOf('Alice') >= 0);
  ok('speakers captured', s.speakers === 'Alice, Bob');

  const s2 = fresh.createNotesSession();
  const none = await fresh.transcribe(s2, null);
  ok('no provider -> honest UNKNOWN', none.ok === true && none.speakers === 'UNKNOWN' && /not configured/.test(s2.transcript));

  const s3 = fresh.createNotesSession();
  const failing = await fresh.transcribe(s3, async () => { throw new Error('STT down'); });
  ok('failing provider -> FAILED code', failing.ok === false && failing.code === 'TRANSCRIPTION_FAILED' && /STT down/.test(s3.transcript));

  console.log('== stop + notes + agent prompt ==');
  const st = await fresh.stop(s, stubTranscriber);
  ok('stop writes notes.md', st.ok === true && fs.existsSync(fresh.notesPath(s)));
  ok('session.json ended', JSON.parse(fs.readFileSync(fresh.sessionJsonPath(s), 'utf8')).status === 'ended');
  const md = fs.readFileSync(fresh.notesPath(s), 'utf8');
  ok('notes contain transcript', md.indexOf('Alice: hello') >= 0 && md.indexOf('# MYRAA Meeting Notes') >= 0);

  const ap = fresh.agentPrompt(s);
  ok('agent prompt references notes dir', ap.indexOf('Myraa Notes') >= 0);
  ok('agent prompt escapes HTML', ap.indexOf('<script>') === -1);

  const rd = fresh.readNotes(s.id);
  ok('readNotes finds written notes', rd.ok === true && rd.notes.indexOf('Alice') >= 0);

  const rdBad = fresh.readNotes('note_nope');
  ok('readNotes 404 for missing', rdBad.ok === false && rdBad.code === 'NOT_FOUND');

  const s4 = fresh.createNotesSession();
  const r1 = await fresh.stop(s4, null);
  ok('stop on fresh session ok', r1.ok === true);
  const r2 = await fresh.stop(s4, null);
  ok('double stop rejected', r2.ok === false && r2.code === 'INVALID_STATE');

  const a3 = fresh.addChunk(s, 5, c1);
  ok('addChunk after stop rejected', a3.ok === false && a3.code === 'INVALID_STATE');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
