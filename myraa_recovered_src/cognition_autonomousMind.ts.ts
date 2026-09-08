import { randomUUID } from "node:crypto";
import { ConversationContinuationEngine, type ContinuationOpportunity } from "./conversationContinuationEngine";
import { CuriosityEngine } from "./curiosityEngine";
import { SocialInitiativeEngine } from "./socialInitiativeEngine";
import type {
  CognitionCounters,
  CognitiveEvent,
  CognitiveEventInput,
  ConversationThread,
  SituationSnapshot,
  StructuredMemory,
  ThoughtCandidate,
  ThoughtOrigin,
} from "./types";

export interface InternalThoughtContext {
  reason: ContinuationOpportunity["reason"] | "goal_review" | "memory_resurfaced" | "delayed_reflection";
  thread: ConversationThread;
  situation: SituationSnapshot;
  relevantMemories: StructuredMemory[];
  curiosity: ReturnType<CuriosityEngine["detect"]>;
}

export type DeepThoughtGenerator = (context: InternalThoughtContext) => Promise<ThoughtCandidate | null>;

export interface AutonomousMindOptions {
  situation: () => SituationSnapshot;
  retrieveMemories: (thread: ConversationThread) => Promise<StructuredMemory[]>;
  backgroundOpportunity?: (at: number) => Promise<InternalThoughtContext | null>;
  emit: (event: CognitiveEventInput) => Promise<void>;
  logger?: (entry: Record<string, unknown>) => void | Promise<void>;
  deepThoughtGenerator?: DeepThoughtGenerator;
  tickMinMs?: number;
  tickMaxMs?: number;
  activeConversationWindowMs?: number;
  minimumFollowupDelayMs?: number;
  random?: () => number;
  now?: () => number;
}

export class AutonomousMind {
  readonly continuation: ConversationContinuationEngine;
  readonly curiosity = new CuriosityEngine();
  readonly social = new SocialInitiativeEngine();
  private readonly queue: ThoughtCandidate[] = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private paused = false;
  private deepThoughtGenerator?: DeepThoughtGenerator;
  private tickInFlight = false;
  private speechAvailable = false;
  private activeSpeechKey: string | null = null;
  private lastDeepOpportunityKey = "";
  private lastDeepOpportunityAt = 0;
  private readonly counters: CognitionCounters = {
    cognitiveTicks: 0,
    deepCognitiveMoments: 0,
    internalThoughtsGenerated: 0,
    internalThoughtsDropped: 0,
    autonomousSpeechAttempts: 0,
    autonomousSpeechCompleted: 0,
    autonomousSpeechInterrupted: 0,
    repetitionSuppressed: 0,
  };

  constructor(private readonly options: AutonomousMindOptions) {
    this.deepThoughtGenerator = options.deepThoughtGenerator;
    this.continuation = new ConversationContinuationEngine(
      options.activeConversationWindowMs,
      options.minimumFollowupDelayMs,
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.scheduleNextTick();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    if (this.running && !this.timer) this.scheduleNextTick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.tickInFlight) await new Promise((resolve) => setTimeout(resolve, 1));
  }

  setDeepThoughtGenerator(generator: DeepThoughtGenerator): void {
    this.deepThoughtGenerator = generator;
  }

  observe(event: CognitiveEvent): void {
    this.continuation.observe(event);
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type)) {
      this.social.restoreFromUserInteraction();
    }
  }

  async tick(at = this.now()): Promise<void> {
    if (this.paused || this.tickInFlight) return;
    this.tickInFlight = true;
    this.counters.cognitiveTicks += 1;
    await this.debug("Cognition", { action: "tick", cognitiveTicks: this.counters.cognitiveTicks });
    try {
      this.pruneQueue(at);
      const situation = this.options.situation();
      const opportunity = this.continuation.opportunity(situation, at);
      const background = !opportunity && !this.continuation.hasActiveConversation(at) && this.speechAvailable
        ? await this.options.backgroundOpportunity?.(at) || null
        : null;
      const thoughtContext = opportunity
        ? {
            reason: opportunity.reason,
            thread: opportunity.thread,
            situation,
            relevantMemories: await this.options.retrieveMemories(opportunity.thread),
            curiosity: this.curiosity.detect(opportunity.thread),
          }
        : background;
      const opportunityKey = thoughtContext
        ? `${thoughtContext.thread.id}:${thoughtContext.thread.lastUserAt || 0}:${thoughtContext.thread.lastMyraaAt || 0}:${thoughtContext.reason}`
        : "";
      const deepMomentDue = opportunityKey !== this.lastDeepOpportunityKey
        || at - this.lastDeepOpportunityAt >= 60_000;
      if (thoughtContext && this.deepThoughtGenerator && deepMomentDue) {
        this.counters.deepCognitiveMoments += 1;
        let thought: ThoughtCandidate | null;
        try {
          thought = await this.deepThoughtGenerator(thoughtContext);
          this.lastDeepOpportunityKey = opportunityKey;
          this.lastDeepOpportunityAt = at;
        } catch (error) {
          // Transient provider failures should not kill endogenous cognition.
          // Retry this opportunity after roughly ten seconds, not every tick.
          this.lastDeepOpportunityKey = opportunityKey;
          this.lastDeepOpportunityAt = at - 50_000;
          throw error;
        }
        if (thought) {
          this.enqueue(normalizeThought(thought, at, {
            reason: thoughtContext.reason === "goal_review" || thoughtContext.reason === "memory_resurfaced" || thoughtContext.reason === "delayed_reflection"
              ? "unfinished_conversation"
              : thoughtContext.reason,
            thread: thoughtContext.thread,
            silenceType: "THINKING_SILENCE",
          }));
          this.counters.internalThoughtsGenerated += 1;
          await this.debug("InternalMind", {
            action: "candidate_generated",
            origin: thought.origin,
            thoughtId: thought.id,
          });
          await this.options.emit({
            type: "internal.thought_generated",
            source: "internal",
            importance: 0.35,
            confidence: thought.confidence,
            dedupeKey: `thought-generated:${thought.id}`,
            metadata: {
              internalOnly: true,
              thoughtId: thought.id,
              origin: thought.origin,
              topic: thought.relatedTopic,
            },
          });
        }
      }
      if (this.speechAvailable) await this.evaluateQueue(situation, at);
    } catch (error) {
      await this.debug("InternalMind", {
        action: "tick_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.tickInFlight = false;
    }
  }

  suppressCasualInitiative(durationMs?: number): void {
    this.social.suppressCasualInitiative(durationMs, this.now());
  }

  restoreCasualInitiative(): void {
    this.social.restoreCasualInitiative();
  }

  setSpeechAvailable(available: boolean): void {
    this.speechAvailable = available;
  }

  markAutonomousSpeechStarted(thoughtId?: string): void {
    this.counters.autonomousSpeechAttempts += 1;
    if (thoughtId) this.activeSpeechKey = thoughtId;
    void this.debug("Speech", { action: "autonomous_speech_started", thoughtId });
  }

  markAutonomousSpeechCompleted(): void {
    if (!this.activeSpeechKey) return;
    this.counters.autonomousSpeechCompleted += 1;
    this.activeSpeechKey = null;
    void this.debug("Speech", { action: "autonomous_speech_completed" });
  }

  markAutonomousSpeechInterrupted(content?: string): void {
    if (!this.activeSpeechKey) return;
    this.counters.autonomousSpeechInterrupted += 1;
    this.activeSpeechKey = null;
    if (content?.trim()) {
      this.enqueue({
        id: randomUUID(),
        createdAt: this.now(),
        origin: "unfinished_thread",
        content: content.trim(),
        relevance: 0.78,
        novelty: 0.65,
        urgency: 0.25,
        socialValue: 0.72,
        confidence: 0.7,
        expiresAt: this.now() + 180_000,
        suggestedAction: "REVISIT_LATER",
      });
    }
    void this.debug("Speech", { action: "autonomous_speech_interrupted" });
  }

  status() {
    return {
      running: this.running,
      paused: this.paused,
      queueLength: this.queue.length,
      speechAvailable: this.speechAvailable,
      counters: { ...this.counters },
      conversation: this.continuation.getThread(),
      social: this.social.status(this.now()),
    };
  }

  private enqueue(thought: ThoughtCandidate): void {
    this.queue.push(thought);
    this.queue.sort((a, b) => thoughtPriority(b) - thoughtPriority(a));
    if (this.queue.length > 30) {
      const removed = this.queue.splice(30);
      this.counters.internalThoughtsDropped += removed.length;
    }
  }

  private async evaluateQueue(situation: SituationSnapshot, at: number): Promise<void> {
    const thought = this.queue[0];
    if (!thought) return;
    const thread = this.continuation.getThread();
    const activeConversation = Boolean(
      thread?.lastUserAt &&
      at - thread.lastUserAt < 180_000 &&
      thread.autonomousTurnsSinceUser < 1,
    );
    const effectiveSituation = activeConversation && situation.userActivity === "away"
      ? { ...situation, userActivity: "active" as const }
      : situation;
    const evaluation = this.social.evaluate(thought, effectiveSituation, at, { activeConversation });
    await this.debug("Initiative", {
      action: evaluation.decision,
      speakScore: evaluation.opportunity.score,
      threshold: activeConversation ? 0.62 : 0.68,
      reason: evaluation.opportunity.reason,
      thoughtId: thought.id,
    });
    if (evaluation.decision === "DROP") {
      this.queue.shift();
      this.counters.internalThoughtsDropped += 1;
      if (evaluation.opportunity.reason === "recently expressed") {
        this.counters.repetitionSuppressed += 1;
      }
      return;
    }
    if (!["SPEAK", "ASK", "SUGGEST"].includes(evaluation.decision)) return;

    this.queue.shift();
    this.social.recordSpeech(evaluation.semanticKey, at);
    const eventType = eventTypeFor(thought.origin);
    await this.options.emit({
      type: eventType,
      source: "internal",
      importance: Math.max(0.72, evaluation.opportunity.score),
      confidence: thought.confidence,
      dedupeKey: evaluation.semanticKey,
      metadata: {
        reason: reasonForOrigin(thought.origin),
        thoughtId: thought.id,
        thought: thought.content,
        origin: thought.origin,
        topic: thought.relatedTopic,
        relatedMemoryIds: thought.relatedMemoryIds || [],
        suggestedAction: evaluation.decision,
        relevance: thought.relevance,
        novelty: thought.novelty,
        urgency: thought.urgency,
        userImpact: thought.socialValue,
        taskRelevance: thought.relevance,
        interruptionCost: evaluation.opportunity.interruptionCost,
        socialOpportunityScore: evaluation.opportunity.score,
        continuationValue: evaluation.opportunity.continuationValue,
      },
    });
  }

  private pruneQueue(at: number): void {
    const before = this.queue.length;
    const kept = this.queue.filter((thought) => !thought.expiresAt || thought.expiresAt > at);
    this.queue.splice(0, this.queue.length, ...kept);
    this.counters.internalThoughtsDropped += before - kept.length;
  }

  private scheduleNextTick(): void {
    if (!this.running || this.paused || this.timer) return;
    const min = this.options.tickMinMs ?? 2_000;
    const max = Math.max(min, this.options.tickMaxMs ?? 5_000);
    const delay = min + Math.floor(this.random() * (max - min + 1));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick().finally(() => this.scheduleNextTick());
    }, delay);
    this.timer.unref?.();
  }

  private random(): number {
    return this.options.random?.() ?? Math.random();
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private async debug(component: string, fields: Record<string, unknown>): Promise<void> {
    await this.options.logger?.({
      timestamp: new Date(this.now()).toISOString(),
      component,
      ...fields,
    });
  }
}

function normalizeThought(
  thought: ThoughtCandidate,
  at: number,
  opportunity: ContinuationOpportunity,
): ThoughtCandidate {
  return {
    ...thought,
    id: thought.id || randomUUID(),
    createdAt: thought.createdAt || at,
    origin: thought.origin || (opportunity.reason === "interrupted_thought" ? "unfinished_thread" : "reflection"),
    content: thought.content.trim(),
    relevance: clamp(thought.relevance),
    novelty: clamp(thought.novelty),
    urgency: clamp(thought.urgency),
    socialValue: clamp(thought.socialValue),
    confidence: clamp(thought.confidence),
    relatedTopic: thought.relatedTopic || opportunity.thread.topic,
    expiresAt: thought.expiresAt || at + 180_000,
  };
}

function thoughtPriority(thought: ThoughtCandidate): number {
  return thought.relevance * 0.3 + thought.novelty * 0.2 + thought.urgency * 0.2 + thought.socialValue * 0.3;
}

function eventTypeFor(origin: ThoughtOrigin): string {
  if (origin === "curiosity") return "internal.curiosity_detected";
  if (origin === "memory") return "internal.memory_resurfaced";
  if (origin === "unfinished_thread") return "internal.unfinished_topic";
  if (origin === "goal") return "internal.goal_requires_attention";
  if (origin === "reflection") return "internal.reflection_complete";
  return "internal.social_opportunity";
}

function reasonForOrigin(origin: ThoughtOrigin): string {
  if (origin === "curiosity") return "a relevant unresolved question emerged";
  if (origin === "memory") return "a relevant memory resurfaced";
  if (origin === "unfinished_thread") return "conversation continuation";
  if (origin === "goal") return "an active goal needs attention";
  if (origin === "reflection") return "a useful delayed reflection emerged";
  return "a meaningful social opportunity emerged";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
