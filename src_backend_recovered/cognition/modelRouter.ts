import { createHash } from "node:crypto";
import type { ModelCallResult, ModelCapability } from "./types";

export interface ModelProvider {
  generate(input: { model: string; prompt: string; signal?: AbortSignal }): Promise<string>;
}

export interface ModelRouterOptions {
  provider: ModelProvider;
  routes?: Partial<Record<ModelCapability, string[]>>;
  maxCallsPerMinute?: number;
  maxInputCharacters?: number;
  cacheTtlMs?: number;
  onCall?: (entry: Record<string, unknown>) => void | Promise<void>;
}

interface CacheEntry {
  text: string;
  model: string;
  expiresAt: number;
}

export class ModelRouter {
  private readonly routes: Record<ModelCapability, string[]>;
  private readonly recentCalls: number[] = [];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ModelCallResult>>();

  constructor(private readonly options: ModelRouterOptions) {
    this.routes = { ...loadModelRoutes(), ...(options.routes || {}) };
  }

  async generate(input: {
    capability: ModelCapability;
    prompt: string;
    cacheKey?: string;
    signal?: AbortSignal;
  }): Promise<ModelCallResult> {
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error("Model prompt must not be empty.");
    if (prompt.length > (this.options.maxInputCharacters || 30_000)) {
      throw new Error("Model prompt exceeds the configured input budget.");
    }
    this.enforceRateLimit();

    const models = this.routes[input.capability].filter(Boolean);
    if (!models.length) throw new Error(`No model configured for capability '${input.capability}'.`);
    const key = input.cacheKey || createHash("sha256")
      .update(`${input.capability}\0${prompt}`)
      .digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        text: cached.text,
        model: cached.model,
        capability: input.capability,
        durationMs: 0,
        cached: true,
        attempts: 0,
      };
    }

    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const promise = this.execute(input.capability, prompt, models, key, input.signal)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private async execute(
    capability: ModelCapability,
    prompt: string,
    models: string[],
    cacheKey: string,
    signal?: AbortSignal,
  ): Promise<ModelCallResult> {
    const started = Date.now();
    let lastError = "Model call failed.";
    let attempts = 0;
    for (const model of models.slice(0, 2)) {
      attempts += 1;
      if (signal?.aborted) throw new Error("Model call cancelled.");
      this.recentCalls.push(Date.now());
      try {
        const text = (await this.options.provider.generate({ model, prompt, signal })).trim();
        if (!text) throw new Error("Model returned an empty response.");
        const durationMs = Date.now() - started;
        this.cache.set(cacheKey, {
          text,
          model,
          expiresAt: Date.now() + (this.options.cacheTtlMs || 300_000),
        });
        await this.options.onCall?.({
          timestamp: new Date().toISOString(), capability, model, durationMs,
          attempts, success: true, promptCharacters: prompt.length,
        });
        return { text, model, capability, durationMs, cached: false, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    await this.options.onCall?.({
      timestamp: new Date().toISOString(), capability, models, durationMs: Date.now() - started,
      attempts, success: false, error: lastError, promptCharacters: prompt.length,
    });
    throw new Error(lastError);
  }

  private enforceRateLimit(): void {
    const cutoff = Date.now() - 60_000;
    while (this.recentCalls.length && this.recentCalls[0] < cutoff) this.recentCalls.shift();
    if (this.recentCalls.length >= (this.options.maxCallsPerMinute || 20)) {
      throw new Error("Model call rate limit reached; wait before retrying.");
    }
  }
}

export function loadModelRoutes(env: NodeJS.ProcessEnv = process.env): Record<ModelCapability, string[]> {
  const split = (value: string | undefined, fallback: string) =>
    (value || fallback).split(",").map((item) => item.trim()).filter(Boolean);
  return {
    fast: split(env.MYRAA_FAST_MODEL, "gemini-3.5-flash"),
    reasoning: split(env.MYRAA_REASONING_MODEL, "gemini-3.5-flash"),
    coding: split(env.MYRAA_CODE_MODEL, "gemini-3.5-flash"),
    vision: split(env.MYRAA_VISION_MODEL, "gemini-3.1-flash-live-preview"),
    research: split(env.MYRAA_RESEARCH_MODEL, "gemini-3.5-flash"),
    embedding: split(env.MYRAA_EMBEDDING_MODEL, "gemini-embedding-001"),
    speech: split(env.MYRAA_SPEECH_MODEL, "gemini-3.1-flash-live-preview"),
  };
}
