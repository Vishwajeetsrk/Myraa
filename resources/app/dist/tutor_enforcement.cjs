'use strict';
/**
 * MYRAA Tutor — enforcement bridge (Phase 10).
 * Connects tutor_policy.cjs to the live awareness loop. This module is the
 * wiring layer: it takes awareness context + learner state, scores whether
 * MYRAA may proactively speak, and returns a structured decision. The actual
 * speech synthesis happens in the caller (awareness routes / orchestrator).
 *
 * Design: never speaks without a green light from tutor_policy.score().
 * All decisions are logged with reasons for auditability.
 */

const tutor = require('./tutor_policy.cjs');

// Build the score input from awareness context + learner state.
// context: {intentConfidence, contextConfidence, value, cost, busy}
// learner: {lastNudgeAt, sameTopicNudges, lastTopic}
// mode: from awareness mode store (passive|assistive|active_tutor)
// topic: string label for the nudge (e.g. 'typescript-error')
function buildScoreInput(mode, context, learner, topic, nowMs) {
  return {
    mode: mode || 'passive',
    intentConfidence: context && context.intentConfidence,
    contextConfidence: context && context.contextConfidence,
    value: context && context.value,
    cost: context && context.cost,
    busy: context && context.busy === true,
    lastNudgeAt: learner && learner.lastNudgeAt != null ? learner.lastNudgeAt : null,
    sameTopicNudges: learner && learner.sameTopicNudges != null ? learner.sameTopicNudges : 0,
    topic: topic || null,
    lastTopic: learner && learner.lastTopic != null ? learner.lastTopic : null,
    nowMs: nowMs || Date.now(),
  };
}

// Decide whether to intervene. Returns {intervene, reasons, scores, mode}.
function decideIntervention(mode, context, learner, topic, nowMs) {
  const input = buildScoreInput(mode, context, learner, topic, nowMs);
  return tutor.score(input);
}

// Record a nudge (called after successful intervention).
function recordNudge(learnerState, topic, nowMs) {
  const now = nowMs || Date.now();
  learnerState.lastNudgeAt = now;
  if (learnerState.lastTopic === topic) {
    learnerState.sameTopicNudges = (learnerState.sameTopicNudges || 0) + 1;
  } else {
    learnerState.lastTopic = topic;
    learnerState.sameTopicNudges = 1;
  }
  return learnerState;
}

// Create a fresh learner nudge tracker.
function createNudgeTracker() {
  return { lastNudgeAt: null, lastTopic: null, sameTopicNudges: 0 };
}

// High-level: should MYRAA speak about this topic right now?
// topic: string label for the nudge (e.g. 'typescript-error', 'useeffect-lesson')
// Returns {speak:bool, reasons:[], mode:string}
function shouldSpeakAbout(mode, topic, context, learnerState, nowMs) {
  const decision = decideIntervention(mode, context, learnerState, topic, nowMs);
  if (decision.intervene) {
    recordNudge(learnerState, topic, nowMs);
  }
  return {
    speak: decision.intervene,
    reasons: decision.reasons,
    mode: decision.scores.mode,
  };
}

module.exports = {
  buildScoreInput,
  decideIntervention,
  recordNudge,
  createNudgeTracker,
  shouldSpeakAbout,
};
