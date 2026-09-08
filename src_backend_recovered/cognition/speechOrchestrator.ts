export type SpeechSource =
  | "critical_warning"
  | "user_response"
  | "task_result"
  | "conversation_continuation"
  | "casual_initiative";

interface SpeechRequest {
  id: string;
  source: SpeechSource;
  thoughtId?: string;
  deliver: () => void;
}

const PRIORITY: Record<SpeechSource, number> = {
  critical_warning: 5,
  user_response: 4,
  task_result: 3,
  conversation_continuation: 2,
  casual_initiative: 1,
};

export class SpeechOrchestrator {
  private active: SpeechRequest | null = null;
  private readonly queue: SpeechRequest[] = [];
  private userSpeaking = false;

  request(request: SpeechRequest): boolean {
    if (this.userSpeaking && request.source !== "critical_warning") return false;
    if (!this.active) {
      this.active = request;
      request.deliver();
      return true;
    }
    if (PRIORITY[request.source] > PRIORITY[this.active.source]) {
      this.queue.unshift(request);
    } else {
      this.queue.push(request);
    }
    this.queue.sort((a, b) => PRIORITY[b.source] - PRIORITY[a.source]);
    return true;
  }

  onUserSpeechStarted(): { interruptedThoughtId?: string } {
    this.userSpeaking = true;
    const interruptedThoughtId = this.active?.source === "conversation_continuation" || this.active?.source === "casual_initiative"
      ? this.active.thoughtId
      : undefined;
    this.queue.splice(0, this.queue.length, ...this.queue.filter((item) => item.source === "critical_warning"));
    return { interruptedThoughtId };
  }

  onUserSpeechStopped(): void {
    this.userSpeaking = false;
  }

  onTurnComplete(): SpeechRequest | null {
    const completed = this.active;
    this.active = null;
    this.deliverNext();
    return completed;
  }

  onInterrupted(): SpeechRequest | null {
    const interrupted = this.active;
    this.active = null;
    return interrupted;
  }

  observeUserResponse(): void {
    if (!this.active) {
      this.active = { id: "direct-user-turn", source: "user_response", deliver: () => {} };
    }
  }

  status() {
    return { active: this.active?.source || null, queued: this.queue.length, userSpeaking: this.userSpeaking };
  }

  private deliverNext(): void {
    if (this.userSpeaking || this.active) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active = next;
    next.deliver();
  }
}
