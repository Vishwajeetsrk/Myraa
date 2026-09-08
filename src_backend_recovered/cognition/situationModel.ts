import type {
  CognitiveEvent,
  CognitiveState,
  RiskLevel,
  SituationEventSummary,
  SituationSnapshot,
} from "./types";

const now = () => new Date().toISOString();

export class SituationModel {
  private snapshot: SituationSnapshot;

  constructor(private readonly maxRecentEvents = 40, initial?: Partial<SituationSnapshot>) {
    this.snapshot = {
      state: "IDLE",
      currentActivity: null,
      activeApp: null,
      activeWindow: null,
      currentProject: null,
      conversationTopic: null,
      currentGoalId: null,
      currentTaskId: null,
      userActivity: "active",
      userSpeaking: false,
      myraaSpeaking: false,
      myraaWasInterrupted: false,
      silenceStartedAt: null,
      silenceSeconds: 0,
      openApplications: [],
      relevantFiles: [],
      recentImportantEvents: [],
      recentFailures: [],
      recentSuccesses: [],
      pendingRisk: null,
      autonomyPaused: false,
      updatedAt: now(),
      ...initial,
    };
  }

  apply(event: CognitiveEvent): SituationSnapshot {
    const meta = event.metadata;
    const state = stateForEvent(event.type, this.snapshot.state);
    this.snapshot.state = this.snapshot.autonomyPaused ? "PAUSED" : state;
    this.snapshot.updatedAt = event.timestamp;

    if (event.projectId) this.snapshot.currentProject = event.projectId;
    if (typeof meta.projectId === "string") this.snapshot.currentProject = meta.projectId;
    if (typeof meta.activity === "string") this.snapshot.currentActivity = meta.activity;
    if (typeof meta.topic === "string") this.snapshot.conversationTopic = meta.topic;
    if (typeof meta.goalId === "string") this.snapshot.currentGoalId = meta.goalId;
    if (typeof meta.taskId === "string") this.snapshot.currentTaskId = meta.taskId;
    if (typeof meta.activeApp === "string") this.snapshot.activeApp = meta.activeApp;
    if (typeof meta.activeWindow === "string") this.snapshot.activeWindow = meta.activeWindow;

    switch (event.type) {
      case "conversation.user_started_speaking":
        this.snapshot.userSpeaking = true;
        this.snapshot.silenceStartedAt = null;
        this.snapshot.silenceSeconds = 0;
        if (this.snapshot.myraaSpeaking) this.snapshot.myraaWasInterrupted = true;
        break;
      case "conversation.user_stopped_speaking":
        this.snapshot.userSpeaking = false;
        this.snapshot.silenceStartedAt = event.timestamp;
        break;
      case "conversation.myraa_started_speaking":
        this.snapshot.myraaSpeaking = true;
        this.snapshot.myraaWasInterrupted = false;
        break;
      case "conversation.myraa_stopped_speaking":
      case "conversation.turn_completed":
        this.snapshot.myraaSpeaking = false;
        break;
      case "conversation.user_interrupted_myraa":
        this.snapshot.myraaSpeaking = false;
        this.snapshot.myraaWasInterrupted = true;
        break;
      case "desktop.active_window_changed":
        if (typeof meta.title === "string") this.snapshot.activeWindow = meta.title;
        if (typeof meta.application === "string") this.snapshot.activeApp = meta.application;
        break;
      case "desktop.application_opened":
        if (typeof meta.application === "string") {
          this.snapshot.openApplications = uniqueBounded(
            [...this.snapshot.openApplications, meta.application],
            30,
          );
        }
        break;
      case "desktop.application_closed":
        if (typeof meta.application === "string") {
          this.snapshot.openApplications = this.snapshot.openApplications.filter(
            (item) => item !== meta.application,
          );
        }
        break;
      case "filesystem.file_created":
      case "filesystem.file_modified":
      case "filesystem.file_moved":
        if (typeof meta.path === "string") {
          this.snapshot.relevantFiles = uniqueBounded(
            [meta.path, ...this.snapshot.relevantFiles],
            20,
          );
        }
        break;
      case "safety.confirmation_required":
        this.snapshot.pendingRisk = {
          eventId: event.id,
          description: String(meta.description || "A risky action needs confirmation."),
          level: asRiskLevel(meta.riskLevel),
          confirmationId: typeof meta.confirmationId === "string" ? meta.confirmationId : undefined,
        };
        break;
      case "safety.confirmation_resolved":
      case "task.cancelled":
        this.snapshot.pendingRisk = null;
        break;
      case "system.user_idle":
        this.snapshot.userActivity = "idle";
        break;
      case "system.user_away":
        this.snapshot.userActivity = "away";
        break;
      case "system.user_active":
        this.snapshot.userActivity = "active";
        break;
    }

    const summary = summarize(event);
    if (event.importance >= 0.45) {
      this.snapshot.recentImportantEvents = boundedAppend(
        this.snapshot.recentImportantEvents,
        summary,
        this.maxRecentEvents,
      );
    }
    if (/failed|error|crashed|blocked/.test(event.type)) {
      this.snapshot.recentFailures = boundedAppend(this.snapshot.recentFailures, summary, 12);
    }
    if (/completed|succeeded|finished|recovered/.test(event.type)) {
      this.snapshot.recentSuccesses = boundedAppend(this.snapshot.recentSuccesses, summary, 12);
    }
    return this.getSnapshot();
  }

  setAutonomyPaused(paused: boolean): SituationSnapshot {
    this.snapshot.autonomyPaused = paused;
    this.snapshot.state = paused ? "PAUSED" : "OBSERVING";
    this.snapshot.updatedAt = now();
    return this.getSnapshot();
  }

  getSnapshot(at = Date.now()): SituationSnapshot {
    const silenceStarted = this.snapshot.silenceStartedAt
      ? new Date(this.snapshot.silenceStartedAt).getTime()
      : null;
    const silenceSeconds = silenceStarted
      ? Math.max(0, Math.floor((at - silenceStarted) / 1000))
      : 0;
    return structuredClone({ ...this.snapshot, silenceSeconds });
  }
}

function stateForEvent(type: string, fallback: CognitiveState): CognitiveState {
  if (type === "conversation.user_started_speaking") return "LISTENING";
  if (type === "conversation.user_interrupted_myraa") return "INTERRUPTED";
  if (type === "conversation.myraa_started_speaking") return "SPEAKING";
  if (type.startsWith("tool.") || type.startsWith("desktop.action_")) return "ACTING";
  if (type.startsWith("memory.")) return "LEARNING";
  if (type.startsWith("goal.plan")) return "PLANNING";
  if (type.startsWith("task.verify")) return "VERIFYING";
  if (type.startsWith("conversation.")) return "THINKING";
  if (type.startsWith("system.") || type.startsWith("desktop.") || type.startsWith("filesystem.")) {
    return "OBSERVING";
  }
  return fallback;
}

function summarize(event: CognitiveEvent): SituationEventSummary {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    importance: event.importance,
    source: event.source,
  };
}

function boundedAppend<T>(items: T[], item: T, limit: number): T[] {
  const next = [...items, item];
  return next.slice(-limit);
}

function uniqueBounded(items: string[], limit: number): string[] {
  return [...new Set(items)].slice(-limit);
}

function asRiskLevel(value: unknown): RiskLevel {
  const parsed = Math.max(0, Math.min(4, Number(value) || 0));
  return Math.round(parsed) as RiskLevel;
}
