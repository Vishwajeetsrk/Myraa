import type { CognitionConfig } from "./config";
import type {
  AttentionAssessment,
  CognitiveEvent,
  InitiativeAction,
  InitiativeDecision,
  SituationSnapshot,
} from "./types";

export class InitiativeEngine {
  constructor(private readonly config: CognitionConfig) {}

  decide(
    event: CognitiveEvent,
    assessment: AttentionAssessment,
    situation: SituationSnapshot,
  ): InitiativeDecision {
    const socialOpportunityScore = typeof event.metadata.socialOpportunityScore === "number"
      ? Math.max(0, Math.min(1, event.metadata.socialOpportunityScore))
      : 0;
    const score = event.type.startsWith("internal.")
      ? Math.max(assessment.score, socialOpportunityScore)
      : assessment.score;
    const { factors } = assessment;
    let action: InitiativeAction = "IGNORE";

    if (!this.config.enabled) {
      action = "IGNORE";
    } else if (situation.autonomyPaused || this.config.autonomyPaused) {
      action = score >= this.config.attention.rememberThreshold ? "OBSERVE" : "IGNORE";
    } else if (!this.config.initiativeEnabled) {
      action = score >= this.config.attention.rememberThreshold ? "REMEMBER" : "IGNORE";
    } else if (factors.repetitionPenalty >= 0.55 && factors.urgency < 0.8) {
      action = score >= this.config.attention.rememberThreshold ? "REMEMBER" : "IGNORE";
    } else if (score < this.config.attention.rememberThreshold) {
      action = "IGNORE";
    } else if (score < this.config.attention.mentionThreshold) {
      action = "REMEMBER";
    } else if (score < this.config.attention.speakThreshold) {
      action = "WAIT";
    } else if (factors.risk >= 0.8 || /confirmation_required|delete_requested/.test(event.type)) {
      action = "WARN";
    } else if (score >= this.config.attention.interruptThreshold && factors.urgency >= 0.75) {
      action = "WARN";
    } else if (event.metadata.needsClarification === true) {
      action = "ASK";
    } else {
      action = "SPEAK";
    }

    // Endogenous cognition has already passed the thought queue and social
    // opportunity model. It is a real cognitive turn, not simulated user text.
    if (event.type.startsWith("internal.")) {
      if (event.metadata.internalOnly === true) {
        action = score >= this.config.attention.rememberThreshold ? "OBSERVE" : "IGNORE";
      } else {
        // Non-internalOnly events are emitted only after the thought queue and
        // SocialInitiativeEngine approve them. Do not apply a second,
        // contradictory threshold here; retain only the interruption gate.
        action = event.metadata.suggestedAction === "ASK" ? "ASK" : "SPEAK";
      }
    }

    // Conversation turns already have a direct model response path. The
    // initiative layer observes them but must not create a second response.
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type)) {
      action = action === "IGNORE" ? "IGNORE" : "OBSERVE";
    }

    const shouldGenerateSpeech =
      this.config.proactiveSpeechEnabled &&
      !situation.autonomyPaused &&
      ["SPEAK", "ASK", "WARN"].includes(action) &&
      factors.interruptionCost < (factors.risk >= 0.85 ? 1 : 0.8);

    return {
      eventId: event.id,
      action,
      attentionScore: score,
      reason: {
        reason: reasonFor(event, assessment),
        urgency: factors.urgency,
        novelty: factors.novelty,
        confidence: factors.confidence,
        interruptionAllowed: shouldGenerateSpeech,
        suggestedTone: toneFor(event, factors.risk, factors.urgency),
      },
      shouldGenerateSpeech,
      createdAt: new Date().toISOString(),
    };
  }
}

function reasonFor(event: CognitiveEvent, assessment: AttentionAssessment): string {
  if (typeof event.metadata.reason === "string") return event.metadata.reason;
  if (/delete_requested/.test(event.type)) return "possible accidental deletion";
  if (/confirmation_required/.test(event.type)) return "a risky action needs explicit user confirmation";
  if (/failed|crashed|blocked/.test(event.type)) return "a relevant task or system operation failed";
  if (/completed|succeeded|finished/.test(event.type)) {
    return event.metadata.recoveredAfterFailures === true
      ? "a previously failing task has now succeeded"
      : "a relevant task completed";
  }
  return assessment.explanation[0] || "context changed in a potentially useful way";
}

function toneFor(event: CognitiveEvent, risk: number, urgency: number): string {
  if (risk >= 0.85) return "friendly-serious";
  if (/completed|succeeded|finished/.test(event.type)) return "warm-relieved";
  if (urgency >= 0.75) return "concise-alert";
  return "natural-casual";
}
