import { randomUUID } from "node:crypto";
import type { CognitiveEvent, CognitiveEventInput } from "./types";

export type EventListener = (event: CognitiveEvent) => void | Promise<void>;

export class CognitiveEventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly history: CognitiveEvent[] = [];

  constructor(private readonly maxHistory = 200) {}

  normalize(input: CognitiveEventInput): CognitiveEvent {
    return Object.freeze({
      ...input,
      id: randomUUID(),
      timestamp: input.timestamp || new Date().toISOString(),
      importance: clamp(input.importance ?? 0.35),
      confidence: clamp(input.confidence ?? 0.8),
      metadata: Object.freeze({ ...(input.metadata || {}) }),
    });
  }

  async publish(input: CognitiveEventInput | CognitiveEvent): Promise<CognitiveEvent> {
    const event = "id" in input ? input : this.normalize(input);
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }

    const listeners = [
      ...(this.listeners.get(event.type) || []),
      ...(this.listeners.get("*") || []),
    ];
    await Promise.allSettled(listeners.map((listener) => Promise.resolve(listener(event))));
    return event;
  }

  subscribe(type: string, listener: EventListener): () => void {
    const set = this.listeners.get(type) || new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(type);
    };
  }

  recent(limit = 25): CognitiveEvent[] {
    return this.history.slice(-Math.max(0, limit));
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
