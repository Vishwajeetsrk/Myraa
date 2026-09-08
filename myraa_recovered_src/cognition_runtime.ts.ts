import fs from "node:fs/promises";
import path from "node:path";
import { AttentionEngine } from "./attentionEngine";
import { AutonomousMind, type DeepThoughtGenerator } from "./autonomousMind";
import { loadCognitionConfig, type CognitionConfig } from "./config";
import { CognitiveEventBus } from "./eventBus";
import { GoalManager } from "./goalManager";
import { InitiativeEngine } from "./initiativeEngine";
import { SituationModel } from "./situationModel";
import { SkillManager } from "./skillManager";
import { StructuredMemoryStore, type LegacyMemoryLike } from "./structuredMemory";
import type {
  AttentionAssessment,
  CognitiveEvent,
  CognitiveEventInput,
  InitiativeDecision,
  StructuredMemory,
} from "./types";

export interface CognitionOutcome {
  event: CognitiveEvent;
  situation: ReturnType<SituationModel["getSnapshot"]>;
  relevantMemories: StructuredMemory[];
  attention: AttentionAssessment;
  decision: InitiativeDecision;
}

export interface CognitiveRuntimeOptions {
  dataDir: string;
  projectRoot?: string;
  config?: CognitionConfig;
  logger?: (entry: Record<string, unknown>) => void | Promise<void>;
  autoStartMind?: boolean;
  mind?: {
    tickMinMs?: number;
    tickMaxMs?: number;
    activeConversationWindowMs?: number;
    minimumFollowupDelayMs?: number;
    random?: () => number;
    now?: () => number;
  };
}

export class CognitiveRuntime {
  readonly config: CognitionConfig;
  readonly events: CognitiveEventBus;
  readonly situation: SituationModel;
  readonly memories: StructuredMemoryStore;
  readonly goals: GoalManager;
  readonly skills: SkillManager;
  readonly mind: AutonomousMind;
  private readonly attention: AttentionEngine;
  private readonly initiative: InitiativeEngine;
  private readonly decisionListeners = new Set<(outcome: CognitionOutcome) => void | Promise<void>>();
  private initialized = false;
  private sessionPersistTimer: NodeJS.Timeout | null = null;
  private housekeepingTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: CognitiveRuntimeOptions) {
    this.config = options.config || loadCognitionConfig();
    this.events = new CognitiveEventBus(this.config.limits.maxRecentEvents * 5);
    this.situation = new SituationModel(this.config.limits.maxRecentEvents, {
      currentProject: options.projectRoot ? path.basename(options.projectRoot) : null,
      autonomyPaused: this.config.autonomyPaused,
      state: this.config.autonomyPaused ? "PAUSED" : "IDLE",
    });
    const cognitionDir = path.join(options.dataDir, "cognition");
    this.memories = new StructuredMemoryStore(path.join(cognitionDir, "memories.v1.json"));
    this.goals = new GoalManager(path.join(cognitionDir, "goals.v1.json"));
    this.skills = new SkillManager(path.join(cognitionDir, "skills.v1.json"));
    this.attention = new AttentionEngine(this.config.attention.repetitionCooldownMs);
    this.initiative = new InitiativeEngine(this.config);
    this.mind = new AutonomousMind({
      situation: () => this.situation.getSnapshot(options.mind?.now?.()),
      retrieveMemories: (thread) => this.memories.retrieve({
        text: [
          thread.topic,
          thread.lastUserStatement || "",
          thread.lastMyraaStatement || "",
        ].filter(Boolean).join(" "),
        projectId: this.situation.getSnapshot().currentProject,
        limit: 6,
        minConfidence: 0.35,
      }),
      backgroundOpportunity: async () => {
        const situation = this.situation.getSnapshot(options.mind?.now?.());
        const activeGoal = this.goals.list()
          .filter((goal) => ["active", "blocked", "pending"].includes(goal.status))
          .sort((a, b) => b.priority - a.priority)[0];
        // A stale high-importance memory used to speak immediately whenever a
        // Live session opened, racing the screen-aware presence check. Memories
        // remain available inside relevant conversations; background initiative
        // is reserved for an actual active goal.
        if (!activeGoal) return null;
        const topic = activeGoal.objective;
        const timestamp = Date.now();
        const thread = {
          id: `goal:${activeGoal.id}`,
          topic,
          status: "OPEN_ENDED" as const,
          importance: activeGoal.priority,
          unresolvedPoints: activeGoal.blockers.length ? activeGoal.blockers : [],
          openQuestions: [],
          lastUserStatement: null,
          lastMyraaStatement: null,
          interruptedThoughts: [],
          possibleFollowups: [topic],
          lastUserAt: null,
          lastMyraaAt: null,
          activeUntil: timestamp + 180_000,
          autonomousTurnsSinceUser: 0,
        };
        return {
          reason: "goal_review" as const,
          thread,
          situation,
          relevantMemories: [],
          curiosity: null,
        };
      },
      emit: async (event) => { await this.process(event); },
      logger: options.logger,
      ...options.mind,
    });
  }

  async initialize(legacyMemories: LegacyMemoryLike[] = []): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      this.memories.initialize(legacyMemories),
      this.goals.initialize(),
      this.skills.initialize(),
    ]);
    this.initialized = true;
    this.housekeepingTimer = setInterval(() => {
      void this.memories.decay().catch(() => {});
    }, 30 * 60_000);
    this.housekeepingTimer.unref?.();
    await this.process({
      type: "system.cognition_started",
      source: "system",
      importance: 0.52,
      metadata: { activity: "cognitive runtime online" },
    });
    if (this.options.autoStartMind !== false) this.mind.start();
  }

  async process(input: CognitiveEventInput): Promise<CognitionOutcome> {
    if (!this.initialized && input.type !== "system.cognition_started") {
      throw new Error("CognitiveRuntime.initialize() must be called first.");
    }
    const event = this.events.normalize(input);
    await this.events.publish(event);
    const situation = this.situation.apply(event);
    this.mind.observe(event);

    let relevantMemories: StructuredMemory[] = [];
    const memoryText = typeof event.metadata.text === "string" ? event.metadata.text : undefined;
    if (memoryText || event.projectId || event.importance >= 0.72) {
      relevantMemories = await this.memories.retrieve({
        text: memoryText || event.type,
        projectId: event.projectId || situation.currentProject,
        limit: 6,
      });
    }

    const attention = this.attention.assess(event, situation);
    const decision = this.initiative.decide(event, attention, situation);
    this.attention.record(attention);

    if (event.type === "conversation.user_correction" && memoryText) {
      await this.memories.correct(
        typeof event.metadata.targetMemoryId === "string" ? event.metadata.targetMemoryId : null,
        memoryText,
        { projectId: event.projectId || situation.currentProject, source: "explicit-user-correction" },
      );
    } else if (shouldRememberEpisode(event, decision)) {
      await this.memories.add({
        kind: event.type.startsWith("goal.") ? "project" : "episodic",
        content: episodeSummary(event),
        projectId: event.projectId || situation.currentProject,
        entities: stringArray(event.metadata.entities),
        tags: [event.type, event.source],
        confidence: event.confidence,
        importance: event.importance,
        source: "cognitive-runtime",
        sourceId: event.id,
        expiresAt: event.importance < 0.55
          ? new Date(Date.now() + 14 * 86_400_000).toISOString()
          : null,
      });
    }

    const outcome: CognitionOutcome = { event, situation, relevantMemories, attention, decision };
    await this.log(outcome);
    this.scheduleSessionPersist();
    await Promise.allSettled(
      [...this.decisionListeners].map((listener) => Promise.resolve(listener(outcome))),
    );
    return outcome;
  }

  onDecision(listener: (outcome: CognitionOutcome) => void | Promise<void>): () => void {
    this.decisionListeners.add(listener);
    return () => this.decisionListeners.delete(listener);
  }

  async pauseAutonomy(reason = "user_requested"): Promise<void> {
    this.config.autonomyPaused = true;
    this.situation.setAutonomyPaused(true);
    this.mind.pause();
    await this.process({
      type: "system.autonomy_paused",
      source: "system",
      importance: 0.95,
      metadata: { reason },
    });
  }

  async resumeAutonomy(): Promise<void> {
    this.config.autonomyPaused = false;
    this.situation.setAutonomyPaused(false);
    this.mind.resume();
    await this.process({
      type: "system.autonomy_resumed",
      source: "system",
      importance: 0.65,
    });
  }

  status() {
    return {
      enabled: this.config.enabled,
      autonomyPaused: this.config.autonomyPaused,
      features: {
        initiative: this.config.initiativeEnabled,
        proactiveSpeech: this.config.proactiveSpeechEnabled,
        skillLearning: this.config.skillLearningEnabled,
        reflection: this.config.reflectionEnabled,
        screenAwareness: this.config.screenAwarenessEnabled,
        desktopAwareness: this.config.desktopAwarenessEnabled,
      },
      situation: this.situation.getSnapshot(),
      recentEvents: this.events.recent(20),
      goals: this.goals.list(),
      skills: this.skills.list(),
      autonomousMind: this.mind.status(),
    };
  }

  setDeepThoughtGenerator(generator: DeepThoughtGenerator): void {
    this.mind.setDeepThoughtGenerator(generator);
  }

  suppressCasualInitiative(durationMs?: number): void {
    this.mind.suppressCasualInitiative(durationMs);
  }

  restoreCasualInitiative(): void {
    this.mind.restoreCasualInitiative();
  }

  setSpeechAvailable(available: boolean): void {
    this.mind.setSpeechAvailable(available);
  }

  markAutonomousSpeechStarted(thoughtId?: string): void {
    this.mind.markAutonomousSpeechStarted(thoughtId);
  }

  markAutonomousSpeechCompleted(): void {
    this.mind.markAutonomousSpeechCompleted();
  }

  markAutonomousSpeechInterrupted(content?: string): void {
    this.mind.markAutonomousSpeechInterrupted(content);
  }

  async shutdown(): Promise<void> {
    if (this.housekeepingTimer) clearInterval(this.housekeepingTimer);
    if (this.sessionPersistTimer) clearTimeout(this.sessionPersistTimer);
    await this.mind.stop();
    await this.persistSession();
  }

  private scheduleSessionPersist(): void {
    if (this.sessionPersistTimer) return;
    this.sessionPersistTimer = setTimeout(() => {
      this.sessionPersistTimer = null;
      void this.persistSession();
    }, 2_000);
    this.sessionPersistTimer.unref?.();
  }

  private async persistSession(): Promise<void> {
    const cognitionDir = path.join(this.options.dataDir, "cognition");
    await fs.mkdir(cognitionDir, { recursive: true });
    const target = path.join(cognitionDir, "last-session.json");
    const temp = `${target}.${process.pid}.tmp`;
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      // Pending actions are intentionally not persisted or resumed.
      situation: { ...this.situation.getSnapshot(), pendingRisk: null },
      unfinishedGoals: this.goals.list().filter((goal) => ["active", "blocked", "pending"].includes(goal.status)),
    };
    await fs.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(temp, target);
  }

  private async log(outcome: CognitionOutcome): Promise<void> {
    await this.options.logger?.({
      timestamp: new Date().toISOString(),
      eventId: outcome.event.id,
      eventType: outcome.event.type,
      source: outcome.event.source,
      attentionScore: Number(outcome.attention.score.toFixed(4)),
      attentionFactors: outcome.attention.factors,
      initiativeDecision: outcome.decision.action,
      reason: outcome.decision.reason.reason,
      state: outcome.situation.state,
      recalledMemoryIds: outcome.relevantMemories.map((memory) => memory.id),
    });
  }
}

function shouldRememberEpisode(event: CognitiveEvent, decision: InitiativeDecision): boolean {
  if (event.type === "system.cognition_started") return false;
  if (/frame_received|active_window_changed|user_started_speaking|user_stopped_speaking/.test(event.type)) {
    return false;
  }
  return decision.action === "REMEMBER" && event.importance >= 0.5 ||
    /failed|crashed|blocked|completed|correction/.test(event.type) && event.importance >= 0.55;
}

function episodeSummary(event: CognitiveEvent): string {
  const text = typeof event.metadata.text === "string" ? event.metadata.text.trim() : "";
  const tool = typeof event.metadata.tool === "string" ? ` (${event.metadata.tool})` : "";
  return text || `${event.type.replace(/[._]/g, " ")}${tool} at ${event.timestamp}`;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
