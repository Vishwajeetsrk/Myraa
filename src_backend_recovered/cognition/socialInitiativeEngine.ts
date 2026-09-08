import type { SituationSnapshot, SocialOpportunity, ThoughtCandidate } from "./types";

export type SocialDecision = "DROP" | "REMEMBER" | "WAIT" | "SPEAK" | "ASK" | "SUGGEST" | "ACT" | "REVISIT_LATER";

export interface SocialEvaluation {
  decision: SocialDecision;
  opportunity: SocialOpportunity;
  semanticKey: string;
}

export class SocialInitiativeEngine {
  private initiativeEnergy = 1;
  private lastEnergyUpdateAt = Date.now();
  private quietUntil = 0;
  private readonly spoken = new Map<string, number>();

  constructor(
    private readonly speakThreshold = 0.68,
    private readonly repetitionCooldownMs = 300_000,
  ) {}

  evaluate(
    thought: ThoughtCandidate,
    situation: SituationSnapshot,
    at = Date.now(),
    context: { activeConversation?: boolean } = {},
  ): SocialEvaluation {
    this.recharge(at);
    const semanticKey = semanticKeyFor(thought);
    const previous = this.spoken.get(semanticKey);
    const repeated = previous !== undefined && at - previous < this.repetitionCooldownMs;
    const interruptionCost = inferInterruptionCost(situation);
    const userAvailability = Math.max(0, 1 - interruptionCost);
    const continuationValue = context.activeConversation ? 0.9
      : thought.origin === "unfinished_thread" ? 0.9
      : thought.origin === "curiosity" ? 0.78
      : 0.62;
    const score = clamp(
      userAvailability * 0.2 +
      thought.relevance * 0.24 +
      thought.novelty * 0.18 +
      thought.socialValue * 0.18 +
      continuationValue * 0.2,
    );
    const opportunity: SocialOpportunity = {
      score,
      reason: repeated ? "recently expressed" : `${thought.origin} with contextual value`,
      userAvailability,
      topicRelevance: thought.relevance,
      novelty: thought.novelty,
      interruptionCost,
      continuationValue,
    };

    if (repeated) return { decision: "DROP", opportunity, semanticKey };
    if (at < this.quietUntil && thought.urgency < 0.9) return { decision: "WAIT", opportunity, semanticKey };
    if (situation.userSpeaking || situation.myraaSpeaking || situation.userActivity === "away") {
      return { decision: "REVISIT_LATER", opportunity, semanticKey };
    }
    const effectiveSpeakThreshold = context.activeConversation
      ? Math.min(this.speakThreshold, 0.62)
      : this.speakThreshold;
    if (score < effectiveSpeakThreshold) {
      return { decision: score >= effectiveSpeakThreshold - 0.12 ? "REMEMBER" : "DROP", opportunity, semanticKey };
    }
    if (this.initiativeEnergy < 0.55 && thought.urgency < 0.8) {
      return { decision: "WAIT", opportunity, semanticKey };
    }
    const decision = thought.suggestedAction === "ASK" || thought.origin === "curiosity" ? "ASK" : "SPEAK";
    return { decision, opportunity, semanticKey };
  }

  recordSpeech(semanticKey: string, at = Date.now()): void {
    this.spoken.set(semanticKey, at);
    this.initiativeEnergy = Math.max(0, this.initiativeEnergy - 0.65);
    if (this.spoken.size > 200) {
      const oldest = [...this.spoken.entries()].sort((a, b) => a[1] - b[1]).slice(0, 40);
      for (const [key] of oldest) this.spoken.delete(key);
    }
  }

  restoreFromUserInteraction(): void {
    this.initiativeEnergy = Math.min(1, this.initiativeEnergy + 0.4);
  }

  suppressCasualInitiative(durationMs?: number, at = Date.now()): void {
    this.quietUntil = durationMs === undefined ? Number.POSITIVE_INFINITY : at + Math.max(0, durationMs);
  }

  restoreCasualInitiative(): void {
    this.quietUntil = 0;
    this.initiativeEnergy = Math.max(this.initiativeEnergy, 0.7);
  }

  status(at = Date.now()) {
    this.recharge(at);
    return { initiativeEnergy: this.initiativeEnergy, quietUntil: this.quietUntil };
  }

  private recharge(at: number): void {
    const elapsed = Math.max(0, at - this.lastEnergyUpdateAt);
    this.initiativeEnergy = Math.min(1, this.initiativeEnergy + elapsed / 600_000);
    this.lastEnergyUpdateAt = at;
  }
}

function semanticKeyFor(thought: ThoughtCandidate): string {
  return `${thought.origin}|${thought.relatedTopic || ""}|${thought.content}`
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 24)
    .join(" ");
}

function inferInterruptionCost(situation: SituationSnapshot): number {
  if (situation.userSpeaking) return 1;
  if (situation.myraaSpeaking) return 0.9;
  if (situation.userActivity === "away") return 0.95;
  const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
  if (/obs|premiere|resolve|game|youtube|netflix|meet|zoom|record|presentation/.test(app)) return 0.85;
  if (situation.userActivity === "idle") return 0.35;
  return 0.18;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
