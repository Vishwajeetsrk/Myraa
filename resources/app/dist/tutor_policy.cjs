'use strict';
/**
 * MYRAA Tutor — intervention policy engine (Phase 9).
 * Pure logic, zero dependencies. Decides whether MYRAA may proactively
 * speak given awareness context. Enforcement (actual speech) lands with the
 * live Tutor phase; this module is the testable rule core.
 *
 * Modes:
 *   passive      -> never interrupts (reasons recorded).
 *   assistive    -> occasional, high-confidence, value > cost, cooldowns.
 *   active_tutor -> teaching mode, lower bars, tighter cooldowns.
 * Guards (all modes): busy, cooldown since last nudge, repeat-topic nag cap.
 */

const MODES = ['passive', 'assistive', 'active_tutor'];
const COOLDOWN_MS = { assistive: 5 * 60 * 1000, active_tutor: 60 * 1000 };
const NAG_CAP = 2;

const THRESHOLDS = {
  assistive: { intent: 0.7, context: 0.6, value: 0.6 },
  active_tutor: { intent: 0.5, context: 0.4, value: 0.4 },
};

function clamp01(v) {
  const n = Number(v);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// input: {mode, intentConfidence, contextConfidence, value, cost, busy,
//         lastNudgeAt (ms epoch|null), sameTopicNudges, topic, lastTopic, nowMs}
// returns {intervene:bool, reasons:[...], scores:{...}}
function score(input) {
  const inp = input || {};
  const mode = MODES.includes(inp.mode) ? inp.mode : 'passive';
  const now = Number(inp.nowMs) || Date.now();
  const reasons = [];
  const scores = {
    mode,
    intent: clamp01(inp.intentConfidence),
    context: clamp01(inp.contextConfidence),
    value: clamp01(inp.value),
    cost: clamp01(inp.cost),
  };
  const deny = (r) => { reasons.push(r); return { intervene: false, reasons, scores }; };

  if (mode === 'passive') return deny('mode=passive: observation only');
  if (inp.busy === true) return deny('user busy: never interrupt');
  const cool = COOLDOWN_MS[mode] || COOLDOWN_MS.assistive;
  if (inp.lastNudgeAt != null && now - Number(inp.lastNudgeAt) < cool) {
    return deny('cooldown: last nudge ' + Math.round((now - Number(inp.lastNudgeAt)) / 1000) + 's ago < ' + Math.round(cool / 1000) + 's');
  }
  // Nag guard only applies to the SAME topic as last nudge
  const sameTopic = inp.topic != null && inp.lastTopic != null && inp.topic === inp.lastTopic;
  if (sameTopic && (inp.sameTopicNudges | 0) >= NAG_CAP) return deny('nag guard: same topic suggested ' + inp.sameTopicNudges + 'x already');

  const th = THRESHOLDS[mode];
  if (scores.intent < th.intent) return deny('intent confidence ' + scores.intent + ' < ' + th.intent);
  if (scores.context < th.context) return deny('context confidence ' + scores.context + ' < ' + th.context);
  if (scores.value < th.value) return deny('intervention value ' + scores.value + ' < ' + th.value);
  if (!(scores.value > scores.cost)) return deny('value does not exceed interruption cost');

  reasons.push('all bars passed in ' + mode + ' mode');
  return { intervene: true, reasons, scores };
}

module.exports = { MODES, COOLDOWN_MS, NAG_CAP, THRESHOLDS, score };
