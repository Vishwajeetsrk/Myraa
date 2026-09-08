import type { ConversationThread } from "./types";

export interface CuriosityGap {
  known: string;
  unknown: string;
  importance: number;
}

export class CuriosityEngine {
  detect(thread: ConversationThread | null): CuriosityGap | null {
    const statement = thread?.lastUserStatement;
    if (!thread || !statement) return null;
    const explicitlyUncertain = /\b(later|maybe|perhaps|not sure|decide|either|or|should|want|learn|remember|automatic|confirm)\b/i.test(statement);
    const hasOpenQuestion = thread.openQuestions.length > 0;
    if (!explicitlyUncertain && !hasOpenQuestion) return null;
    return {
      known: statement,
      unknown: "One relevant user preference, constraint, or design assumption is still unclear.",
      importance: Math.min(0.9, thread.importance + 0.12),
    };
  }
}
