'use strict';
/**
 * MYRAA Pointer — voice session (Phase 2).
 * Press-and-hold voice sessions with streaming speech bubble.
 * Reuses MYRAA's existing voice paths:
 *   - STT: Web Speech API (browser) or Gemini Live (WS)
 *   - TTS: speechSynthesis (pitch 1.25) or /api/speak (System.Speech Female)
 *   - Live: Gemini Live over WS /live (existing)
 * No new TTS provider. No new STT provider. Honest fallbacks only.
 *
 * Session states: idle -> listening (hold) -> thinking (release) -> speaking (reply) -> idle
 * The chirp on reply is a short synthesized tone via Web Audio (no asset needed).
 */

const SESSION_STATES = ['idle', 'listening', 'thinking', 'speaking'];

function createSession(sessionId, opts) {
  const o = opts || {};
  return {
    id: String(sessionId || 'ptr_voice'),
    state: 'idle',
    mode: o.mode || 'push-to-talk',
    provider: o.provider || 'gemini_live', // gemini_live | webspeech | system_speech
    transcript: [],
    startedAt: new Date().toISOString(),
    lastActivityAt: null,
  };
}

function transition(session, nextState) {
  if (!SESSION_STATES.includes(nextState)) {
    return { ok: false, error: 'invalid state: ' + nextState, code: 'VALIDATION' };
  }
  const prev = session.state;
  session.state = nextState;
  session.lastActivityAt = new Date().toISOString();
  return { ok: true, previous: prev, current: nextState };
}

// Start listening (press). Returns the session for the caller to drive STT.
function pressStart(session) {
  if (session.state !== 'idle' && session.state !== 'speaking') {
    return { ok: false, error: 'cannot start listening from ' + session.state, code: 'INVALID_STATE' };
  }
  const t = transition(session, 'listening');
  return Object.assign({ ok: t.ok }, t);
}

// Release (hold end) — commit audio, ask provider for a response.
function pressRelease(session) {
  if (session.state !== 'listening') {
    return { ok: false, error: 'not listening', code: 'INVALID_STATE' };
  }
  return transition(session, 'thinking');
}

// Provider response arrived — speak it.
function reply(session, text) {
  if (session.state !== 'thinking') {
    return { ok: false, error: 'not thinking', code: 'INVALID_STATE' };
  }
  session.transcript.push({ role: 'assistant', text: String(text || ''), at: new Date().toISOString() });
  return transition(session, 'speaking');
}

function finishSpeaking(session) {
  if (session.state !== 'speaking') {
    return { ok: false, error: 'not speaking', code: 'INVALID_STATE' };
  }
  return transition(session, 'idle');
}

function stop(session) {
  const was = session.state;
  session.state = 'idle';
  session.lastActivityAt = new Date().toISOString();
  return { ok: true, stoppedFrom: was };
}

// Chirp: short confirmation tone synthesized via Web Audio (no asset files).
// Returns JS to run in the browser; backend never generates audio.
function chirpScript(freq, durationMs) {
  const f = freq || 880;
  const d = durationMs || 120;
  return 'try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.type="sine";o.frequency.value=' + f + ';g.gain.setValueAtTime(0.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.18,ctx.currentTime+0.015);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+' + (d / 1000) + ');o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+' + (d / 1000) + ');}catch(e){}';
}

// Speech bubble render (plain HTML, MYRAA dark theme, no emoji).
function bubbleHtml(text) {
  const esc = String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<div style="position:absolute;pointer-events:none;background:rgba(16,24,39,0.92);border:1px solid var(--border-subtle);border-radius:12px;padding:10px 14px;color:#fff;font-size:13px;max-width:320px;box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:99999;">'
    + '<div style="font-size:10px;color:var(--accent-cyan);margin-bottom:4px;letter-spacing:0.08em;">MYRAA</div>'
    + '<div class="ptr-bubble-text">' + esc + '</div></div>';
}

module.exports = {
  SESSION_STATES,
  createSession,
  transition,
  pressStart,
  pressRelease,
  reply,
  finishSpeaking,
  stop,
  chirpScript,
  bubbleHtml,
};
