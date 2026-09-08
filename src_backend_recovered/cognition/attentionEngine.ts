import type {
  AttentionAssessment,
  AttentionFactors,
  CognitiveEvent,
  SituationSnapshot,
} from "./types";

interface SeenEvent {
  lastSeenAt: number;
  count: number;
  highestUrgency: number;
}

export class AttentionEngine {
  private readonly seen = new Map<string, SeenEvent>();

  constructor(private readonly repetitionCooldownMs = 180_000) {}

  assess(event: CognitiveEvent, situation: SituationSnapshot, at = Date.now()): AttentionAssessment {
    const semanticKey = event.dedupeKey || deriveSemanticKey(event);
    const previous = this.seen.get(semanticKey);
    const defaults = defaultSignals(event);
    const urgency = signal(event, "urgency", defaults.urgency);
    const risk = signal(event, "risk", defaults.risk);
    const relevance = signal(event, "relevance", defaults.relevance);
    const userImpact = signal(event, "userImpact", defaults.userImpact);
    const taskRelevance = signal(
      event,
      "taskRelevance",
      event.projectId && event.projectId === situation.currentProject ? 0.9 : defaults.taskRelevance,
    );
    const interruptionCost = signal(event, "interruptionCost", inferInterruptionCost(situation));

    const withinCooldown = previous && at - previous.lastSeenAt < this.repetitionCooldownMs;
    const urgencyEscalated = previous && urgency > previous.highestUrgency + 0.15;
    const repetitionPenalty = withinCooldown && !urgencyEscalated
      ? Math.min(1, 0.48 + previous.count * 0.12)
      : 0;
    const inferredNovelty = previous
      ? (withinCooldown ? (urgencyEscalated ? 0.72 : 0.15) : 0.62)
      : lowSignalObservation(event.type) ? 0.28 : 1;
    const novelty = signal(
      event,
      "novelty",
      inferredNovelty,
    );

    const factors: AttentionFactors = {
      relevance,
      novelty,
      urgency,
      risk,
      userImpact,
      taskRelevance,
      confidence: event.confidence,
      repetitionPenalty,
      interruptionCost,
    };

    const weighted =
      relevance * 0.16 +
      novelty * 0.14 +
      urgency * 0.18 +
      risk * 0.2 +
      userImpact * 0.12 +
      taskRelevance * 0.1 +
      event.confidence * 0.1 -
      repetitionPenalty * 0.2 -
      interruptionCost * 0.12;
    const score = clamp(weighted * 0.82 + event.importance * 0.18);

    return {
      eventId: event.id,
      score,
      factors,
      semanticKey,
      explanation: explain(factors, withinCooldown === true, urgencyEscalated === true),
    };
  }

  record(assessment: AttentionAssessment, at = Date.now()): void {
    const previous = this.seen.get(assessment.semanticKey);
    this.seen.set(assessment.semanticKey, {
      lastSeenAt: at,
      count: (previous?.count || 0) + 1,
      highestUrgency: Math.max(previous?.highestUrgency || 0, assessment.factors.urgency),
    });
    if (this.seen.size > 1_000) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
      for (const [key] of oldest.slice(0, 200)) this.seen.delete(key);
    }
  }
}

function defaultSignals(event: CognitiveEvent) {
  const type = event.type;
  if (/delete_requested|disk_space_critical|security|data_loss/.test(type)) {
    return { urgency: 0.95, risk: 0.98, relevance: 0.95, userImpact: 0.98, taskRelevance: 0.85 };
  }
  if (/crashed|failed|blocked|confirmation_required/.test(type)) {
    return { urgency: 0.78, risk: 0.72, relevance: 0.86, userImpact: 0.84, taskRelevance: 0.82 };
  }
  if (/completed|succeeded|download_completed|build_finished/.test(type)) {
    const recovered = event.metadata.recoveredAfterFailures === true;
    return {
      urgency: recovered ? 0.62 : 0.36,
      risk: 0.08,
      relevance: recovered ? 0.88 : 0.62,
      userImpact: recovered ? 0.82 : 0.56,
      taskRelevance: 0.8,
    };
  }
  if (/user_interrupted|correction/.test(type)) {
    return { urgency: 0.66, risk: 0.2, relevance: 0.92, userImpact: 0.74, taskRelevance: 0.82 };
  }
  if (/active_window_changed|clipboard_changed|frame_received/.test(type)) {
    return { urgency: 0.08, risk: 0.05, relevance: 0.24, userImpact: 0.12, taskRelevance: 0.32 };
  }
  return { urgency: 0.25, risk: 0.15, relevance: 0.5, userImpact: 0.4, taskRelevance: 0.45 };
}

function inferInterruptionCost(situation: SituationSnapshot): number {
  if (situation.pendingRisk?.level && situation.pendingRisk.level >= 3) return 0.05;
  if (situation.userSpeaking) return 0.98;
  if (situation.myraaSpeaking) return 0.75;
  if (situation.userActivity === "away") return 0.85;
  const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
  if (/obs|premiere|resolve|game|youtube|netflix|meet|zoom|presentation/.test(app)) return 0.78;
  return 0.25;
}

function signal(event: CognitiveEvent, key: string, fallback: number): number {
  const value = event.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : clamp(fallback);
}

function deriveSemanticKey(event: CognitiveEvent): string {
  const focus = [
    event.type,
    event.projectId,
    event.metadata.path,
    event.metadata.tool,
    event.metadata.application,
    event.metadata.goalId,
    event.metadata.reason,
  ]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 300);
  return focus || event.type;
}

function lowSignalObservation(type: string): boolean {
  return /active_window_changed|clipboard_changed|frame_received|silence_duration_changed/.test(type);
}

function explain(factors: AttentionFactors, repeated: boolean, escalated: boolean): string[] {
  const reasons: string[] = [];
  if (factors.risk >= 0.7) reasons.push("high risk");
  if (factors.urgency >= 0.7) reasons.push("time-sensitive");
  if (factors.taskRelevance >= 0.75) reasons.push("relevant to the current task");
  if (factors.userImpact >= 0.75) reasons.push("high user impact");
  if (repeated && !escalated) reasons.push("recently handled; repetition suppressed");
  if (escalated) reasons.push("urgency increased since the previous event");
  if (factors.interruptionCost >= 0.7) reasons.push("user interruption cost is high");
  return reasons.length ? reasons : ["routine observation"];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
