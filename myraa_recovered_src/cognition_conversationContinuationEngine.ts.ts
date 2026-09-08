import { randomUUID } from "node:crypto";
import type {
  CognitiveEvent,
  ConversationThread,
  SituationSnapshot,
  SocialSilenceType,
} from "./types";

export interface ContinuationOpportunity {
  reason: "unfinished_conversation" | "interrupted_thought" | "open_question";
  thread: ConversationThread;
  silenceType: SocialSilenceType;
}

export class ConversationContinuationEngine {
  private thread: ConversationThread | null = null;

  constructor(
    private readonly activeWindowMs = 180_000,
    private readonly minimumFollowupDelayMs = 4_000,
  ) {}

  observe(event: CognitiveEvent): void {
    const text = typeof event.metadata.text === "string" ? event.metadata.text.trim() : "";
    const at = new Date(event.timestamp).getTime();
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type) && text) {
      const existing = this.thread;
      this.thread = {
        id: existing?.id || randomUUID(),
        topic: inferTopic(text, existing?.topic),
        status: "ACTIVE",
        importance: Math.max(existing?.importance || 0.5, event.importance),
        unresolvedPoints: boundedUnique([...(existing?.unresolvedPoints || []), text], 6),
        openQuestions: boundedUnique([
          ...(existing?.openQuestions || []),
          ...(looksOpenEnded(text) ? [text] : []),
        ], 5),
        lastUserStatement: text,
        lastMyraaStatement: existing?.lastMyraaStatement || null,
        interruptedThoughts: existing?.interruptedThoughts || [],
        possibleFollowups: boundedUnique([
          ...(existing?.possibleFollowups || []),
          `Find one useful continuation or unresolved assumption about: ${text}`,
        ], 6),
        lastUserAt: at,
        lastMyraaAt: existing?.lastMyraaAt || null,
        activeUntil: at + this.activeWindowMs,
        autonomousTurnsSinceUser: 0,
      };
      return;
    }

    if (event.type === "conversation.turn_completed" && text && this.thread) {
      this.thread.lastMyraaStatement = text;
      this.thread.lastMyraaAt = at;
      this.thread.status = "OPEN_ENDED";
      this.thread.activeUntil = at + this.activeWindowMs;
      return;
    }

    if (event.type === "conversation.user_interrupted_myraa" && this.thread) {
      const interrupted = typeof event.metadata.interruptedThought === "string"
        ? event.metadata.interruptedThought.trim()
        : "";
      this.thread.status = "INTERRUPTED";
      if (interrupted) {
        this.thread.interruptedThoughts = boundedUnique(
          [...this.thread.interruptedThoughts, interrupted],
          4,
        );
      }
      return;
    }

    if (event.type === "internal.autonomous_speech_completed" && this.thread) {
      this.thread.autonomousTurnsSinceUser += 1;
      this.thread.status = "WAITING_FOR_USER";
    }
  }

  opportunity(situation: SituationSnapshot, at = Date.now()): ContinuationOpportunity | null {
    const thread = this.thread;
    if (!thread || !thread.lastUserStatement || !thread.lastMyraaStatement) return null;
    if (situation.autonomyPaused || situation.userSpeaking || situation.myraaSpeaking) return null;
    if (thread.autonomousTurnsSinceUser >= 1 || at > thread.activeUntil) return null;
    const lastTurnAt = thread.lastMyraaAt || thread.lastUserAt || at;
    if (at - lastTurnAt < this.minimumFollowupDelayMs) return null;
    const silenceType = this.classifySilence(situation, at);
    if (silenceType === "USER_AWAY" || silenceType === "WORKING_SILENCE" || silenceType === "NATURAL_END") {
      return null;
    }
    if (thread.interruptedThoughts.length > 0) {
      return { reason: "interrupted_thought", thread: structuredClone(thread), silenceType };
    }
    if (thread.openQuestions.length > 0) {
      return { reason: "open_question", thread: structuredClone(thread), silenceType };
    }
    return { reason: "unfinished_conversation", thread: structuredClone(thread), silenceType };
  }

  classifySilence(situation: SituationSnapshot, at = Date.now()): SocialSilenceType {
    const recentConversation = this.thread?.lastUserAt
      ? at - this.thread.lastUserAt < this.activeWindowMs
      : false;
    if (situation.userActivity === "away" && !recentConversation) return "USER_AWAY";
    const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
    if (/obs|premiere|resolve|game|meet|zoom|record|presentation/.test(app)) return "WORKING_SILENCE";
    if (!this.thread || at > this.thread.activeUntil) return "NATURAL_END";
    if (this.thread.status === "INTERRUPTED") return "AWKWARD_UNRESOLVED_SILENCE";
    if (this.thread.status === "ACTIVE" || this.thread.status === "OPEN_ENDED") {
      return "CONVERSATIONAL_PAUSE";
    }
    return "THINKING_SILENCE";
  }

  getThread(): ConversationThread | null {
    return this.thread ? structuredClone(this.thread) : null;
  }

  hasActiveConversation(at = Date.now()): boolean {
    return Boolean(
      this.thread?.lastUserStatement &&
      this.thread.autonomousTurnsSinceUser < 1 &&
      at <= this.thread.activeUntil,
    );
  }
}

function inferTopic(text: string, previous?: string): string {
  const compact = text.replace(/\s+/g, " ").slice(0, 140);
  if (compact.length >= 12) return compact;
  return previous || compact || "current conversation";
}

function looksOpenEnded(text: string): boolean {
  return /\?|\b(later|maybe|perhaps|not sure|decide|figure out|confused|samajh|pata nahi|soch)\b/i.test(text);
}

function boundedUnique(items: string[], limit: number): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(-limit);
}
