'use strict';
/**
 * MYRAA Pointer — meeting notes (Phase 3).
 * Records session audio in chunks, transcribes with speaker labels,
 * writes notes to ~/Documents/Myraa Notes/<date>/<id>/, exports agent prompt.
 *
 * Honest design:
 * - Audio capture is explicit (user starts/stops a note session).
 * - Transcription uses MYRAA's existing STT paths (Gemini transcribe / whisper
 *   if available); speaker diarization is marked UNKNOWN when unsupported.
 * - Notes are plain Markdown; agent prompt is a text export, never executed.
 * - No audio leaves the machine unless a session is active.
 */

const fs = require('fs');
const path = require('path');

const NOTES_ROOT = process.env.MYRAA_NOTES_DIR
  || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'Myraa Notes');
const CHUNK_SECONDS = 300; // 5-minute chunks, mirroring the reference pattern

function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function notesDirFor(dateStr, id) {
  return path.join(NOTES_ROOT, String(dateStr || new Date().toISOString().slice(0, 10)), String(id || ''));
}

function createNotesSession(opts) {
  const o = opts || {};
  const id = makeId('note');
  const dir = notesDirFor(o.date, id);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  const session = {
    id,
    dir,
    startedAt: new Date().toISOString(),
    endedAt: null,
    chunks: [],
    transcript: null,
    speakers: 'UNKNOWN', // diarization is provider-dependent; never invented
    status: 'recording',
  };
  return session;
}

function chunkPath(session, index) {
  return path.join(session.dir, 'chunk_' + String(index).padStart(3, '0') + '.aac');
}

function sessionJsonPath(session) {
  return path.join(session.dir, 'session.json');
}

function notesPath(session) {
  return path.join(session.dir, 'notes.md');
}

// Register a recorded chunk. Audio itself stays in the session dir.
function addChunk(session, index, audioPath) {
  if (session.status !== 'recording') return { ok: false, error: 'session not recording', code: 'INVALID_STATE' };
  const cp = chunkPath(session, index);
  try {
    if (audioPath && audioPath !== cp) {
      fs.copyFileSync(audioPath, cp);
    } else if (!fs.existsSync(cp)) {
      return { ok: false, error: 'chunk file missing', code: 'ARTIFACT_ERROR' };
    }
  } catch (e) {
    return { ok: false, error: 'chunk write failed: ' + String((e && e.message) || e).slice(0, 200), code: 'ARTIFACT_ERROR' };
  }
  session.chunks.push({ index, path: cp, bytes: fs.statSync(cp).size, at: new Date().toISOString() });
  return { ok: true, chunk: session.chunks[session.chunks.length - 1] };
}

function writeSessionMeta(session) {
  try {
    fs.writeFileSync(sessionJsonPath(session), JSON.stringify({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      chunks: session.chunks.map((c) => ({ index: c.index, bytes: c.bytes, at: c.at })),
      transcript: session.transcript,
      speakers: session.speakers,
      status: session.status,
    }, null, 2), 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'meta write failed: ' + String((e && e.message) || e).slice(0, 200), code: 'ARTIFACT_ERROR' };
  }
}

// Transcribe the session. `transcriber` is injectable: async (chunks) =>
//   {transcript, speakers, provider}. Without one, honest UNKNOWN placeholder.
async function transcribe(session, transcriber) {
  if (session.status !== 'recording') return { ok: false, error: 'session not recording', code: 'INVALID_STATE' };
  if (typeof transcriber !== 'function') {
    session.transcript = '(transcription not configured in this MYRAA install — install a STT provider or wire /api/voice/transcribe)';
    session.speakers = 'UNKNOWN';
    return { ok: true, transcript: session.transcript, speakers: 'UNKNOWN', provider: 'none' };
  }
  try {
    const res = await transcriber(session.chunks.map((c) => c.path));
    session.transcript = String((res && res.transcript) || '');
    session.speakers = (res && res.speakers) || 'UNKNOWN';
    return { ok: true, transcript: session.transcript, speakers: session.speakers, provider: (res && res.provider) || 'unknown' };
  } catch (e) {
    session.transcript = '(transcription failed: ' + String((e && e.message) || e).slice(0, 200) + ')';
    session.speakers = 'UNKNOWN';
    return { ok: false, error: 'transcription failed: ' + String((e && e.message) || e).slice(0, 200), code: 'TRANSCRIPTION_FAILED' };
  }
}

function buildNotes(session) {
  const lines = [
    '# MYRAA Meeting Notes',
    '',
    '- Session: ' + session.id,
    '- Started: ' + session.startedAt,
    '- Ended: ' + (session.endedAt || '(not ended)'),
    '- Chunks: ' + session.chunks.length,
    '- Speakers: ' + session.speakers,
    '',
    '## Transcript',
    '',
    session.transcript || '(no transcript)',
    '',
    '## Audio',
    '',
    session.chunks.map((c) => '- chunk_' + String(c.index).padStart(3, '0') + ' (' + c.bytes + ' bytes)').join('\n'),
    '',
  ];
  return lines.join('\n');
}

function agentPrompt(session) {
  const transcript = session.transcript || '(no transcript)';
  const esc = transcript.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return 'Below is the transcript of a meeting recording in ~/Documents/Myraa Notes. '
    + 'Read it and produce: (1) a 3-bullet executive summary, '
    + '(2) a list of decisions, (3) a list of action items with owners if identifiable. '
    + 'If speakers are labeled, attribute action items. Never invent facts not in the transcript.\n\n'
    + 'TRANSCRIPT:\n' + esc;
}

// Stop the session: freeze chunks, run transcriber if provided, write meta + notes.
async function stop(session, transcriber) {
  if (session.status !== 'recording') return { ok: false, error: 'session not recording', code: 'INVALID_STATE' };
  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  const tr = await transcribe(session, transcriber);
  writeSessionMeta(session);
  try {
    fs.writeFileSync(notesPath(session), buildNotes(session), 'utf8');
  } catch (e) {
    return { ok: false, error: 'notes write failed', code: 'ARTIFACT_ERROR', transcription: tr };
  }
  return { ok: true, session, transcription: tr, notesPath: notesPath(session), sessionJsonPath: sessionJsonPath(session) };
}

function readNotes(id) {
  // Notes live under NOTES_ROOT/<date>/<id>/notes.md. Date may be unknown;
  // scan for the id across recent date dirs.
  try {
    const dates = fs.readdirSync(NOTES_ROOT).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    for (const d of dates.sort().reverse()) {
      const p = path.join(NOTES_ROOT, d, id, 'notes.md');
      if (fs.existsSync(p)) return { ok: true, notes: fs.readFileSync(p, 'utf8'), path: p };
    }
  } catch (e) { /* NOTES_ROOT missing yet */ }
  return { ok: false, error: 'notes not found for ' + id, code: 'NOT_FOUND' };
}

module.exports = {
  NOTES_ROOT, CHUNK_SECONDS,
  makeId, notesDirFor, createNotesSession, chunkPath,
  sessionJsonPath, notesPath,
  addChunk, writeSessionMeta, transcribe, buildNotes, agentPrompt,
  stop, readNotes,
};
