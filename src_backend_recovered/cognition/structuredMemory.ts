import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { MemoryKind, MemoryQuery, StructuredMemory } from "./types";

interface MemoryFile {
  version: 1;
  memories: StructuredMemory[];
}

export interface AddMemoryInput {
  kind: MemoryKind;
  content: string;
  projectId?: string | null;
  entities?: string[];
  tags?: string[];
  confidence?: number;
  importance?: number;
  source: string;
  sourceId?: string;
  expiresAt?: string | null;
  supersedesId?: string;
}

export interface LegacyMemoryLike {
  id: string;
  category: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export class StructuredMemoryStore {
  private memories: StructuredMemory[] = [];
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async initialize(legacy: LegacyMemoryLike[] = []): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as MemoryFile;
      this.memories = Array.isArray(parsed.memories) ? parsed.memories : [];
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        const backup = `${this.filePath}.corrupt-${Date.now()}`;
        await fs.rename(this.filePath, backup).catch(() => {});
      }
      this.memories = [];
    }
    this.loaded = true;
    if (legacy.length) await this.importLegacy(legacy);
  }

  async importLegacy(legacy: LegacyMemoryLike[]): Promise<number> {
    this.assertLoaded();
    let count = 0;
    let changed = false;
    const incomingIds = new Set(legacy.map((item) => item.id));
    for (const memory of legacy) {
      const existing = this.memories.find(
        (item) => item.source === "legacy-memory" && item.sourceId === memory.id,
      );
      if (existing) {
        const nextKind = legacyKind(memory.category);
        const nextContent = memory.text.trim();
        if (existing.content !== nextContent || existing.kind !== nextKind || !existing.active) {
          existing.content = nextContent;
          existing.kind = nextKind;
          existing.projectId = memory.category === "project" ? inferProject(memory.text) : existing.projectId;
          existing.entities = extractEntities(memory.text);
          existing.updatedAt = memory.updatedAt;
          existing.active = true;
          changed = true;
        }
        continue;
      }
      this.memories.push({
        id: randomUUID(),
        kind: legacyKind(memory.category),
        content: memory.text.trim(),
        projectId: memory.category === "project" ? inferProject(memory.text) : null,
        entities: extractEntities(memory.text),
        tags: ["legacy", memory.category],
        confidence: memory.category === "behavior" ? 0.58 : 0.72,
        confirmations: 1,
        importance: ["goal", "project", "identity"].includes(memory.category) ? 0.72 : 0.58,
        source: "legacy-memory",
        sourceId: memory.id,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        lastAccessedAt: memory.updatedAt,
        accessCount: 0,
        expiresAt: null,
        active: true,
      });
      count += 1;
      changed = true;
    }
    for (const existing of this.memories) {
      if (existing.source === "legacy-memory" && existing.sourceId && !incomingIds.has(existing.sourceId) && existing.active) {
        existing.active = false;
        existing.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) await this.persist();
    return count;
  }

  async add(input: AddMemoryInput): Promise<StructuredMemory> {
    this.assertLoaded();
    const content = input.content.trim();
    if (!content) throw new Error("Memory content must not be empty.");
    const projectId = input.projectId ?? null;
    const duplicate = this.memories.find(
      (item) => item.active && item.kind === input.kind && item.projectId === projectId &&
        normalize(item.content) === normalize(content),
    );
    const timestamp = new Date().toISOString();
    if (duplicate) {
      duplicate.confirmations += 1;
      duplicate.confidence = clamp(Math.max(duplicate.confidence, input.confidence ?? 0.65) + 0.04);
      duplicate.importance = clamp(Math.max(duplicate.importance, input.importance ?? 0.5));
      duplicate.updatedAt = timestamp;
      duplicate.tags = unique([...duplicate.tags, ...(input.tags || [])]);
      duplicate.entities = unique([...duplicate.entities, ...(input.entities || [])]);
      await this.persist();
      return structuredClone(duplicate);
    }

    const memory: StructuredMemory = {
      id: randomUUID(),
      kind: input.kind,
      content,
      projectId,
      entities: unique(input.entities || extractEntities(content)),
      tags: unique(input.tags || []),
      confidence: clamp(input.confidence ?? 0.65),
      confirmations: 1,
      importance: clamp(input.importance ?? 0.5),
      source: input.source,
      sourceId: input.sourceId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
      accessCount: 0,
      expiresAt: input.expiresAt ?? null,
      supersedesId: input.supersedesId,
      active: true,
    };
    this.memories.push(memory);
    await this.persist();
    return structuredClone(memory);
  }

  async correct(
    targetId: string | null,
    correctedContent: string,
    context: { projectId?: string | null; source?: string } = {},
  ): Promise<StructuredMemory> {
    this.assertLoaded();
    const target = targetId ? this.memories.find((item) => item.id === targetId && item.active) : undefined;
    if (target) {
      target.active = false;
      target.updatedAt = new Date().toISOString();
      target.confidence = clamp(target.confidence * 0.35);
    }
    const correction = await this.add({
      kind: "correction",
      content: correctedContent,
      projectId: context.projectId ?? target?.projectId ?? null,
      entities: target?.entities,
      tags: ["explicit-user-correction"],
      confidence: 0.98,
      importance: 0.9,
      source: context.source || "user-correction",
      supersedesId: target?.id,
    });
    if (target) await this.persist();
    return correction;
  }

  async retrieve(query: MemoryQuery = {}): Promise<StructuredMemory[]> {
    this.assertLoaded();
    const current = Date.now();
    const queryTokens = tokenize(query.text || "");
    const entities = new Set((query.entities || []).map(normalize));
    const candidates = this.memories.filter((memory) => {
      if (!memory.active || memory.confidence < (query.minConfidence ?? 0.2)) return false;
      if (memory.expiresAt && new Date(memory.expiresAt).getTime() <= current) return false;
      if (query.kinds?.length && !query.kinds.includes(memory.kind)) return false;
      if (query.projectId && memory.projectId && memory.projectId !== query.projectId) return false;
      return true;
    });

    const ranked = candidates
      .map((memory) => ({ memory, score: scoreMemory(memory, queryTokens, entities, query.projectId, current) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(query.limit ?? 12, 50)));

    const accessedAt = new Date().toISOString();
    for (const item of ranked) {
      item.memory.lastAccessedAt = accessedAt;
      item.memory.accessCount += 1;
    }
    if (ranked.length) await this.persist();
    return ranked.map(({ memory }) => structuredClone(memory));
  }

  async decay(at = Date.now()): Promise<{ expired: number; decayed: number }> {
    this.assertLoaded();
    let expired = 0;
    let decayed = 0;
    for (const memory of this.memories) {
      if (!memory.active) continue;
      if (memory.expiresAt && new Date(memory.expiresAt).getTime() <= at) {
        memory.active = false;
        expired += 1;
        continue;
      }
      const ageDays = (at - new Date(memory.updatedAt).getTime()) / 86_400_000;
      if (ageDays > 30 && memory.importance < 0.55 && memory.confirmations < 2) {
        memory.confidence = clamp(memory.confidence * 0.97);
        memory.updatedAt = new Date(at).toISOString();
        decayed += 1;
      }
    }
    if (expired || decayed) await this.persist();
    return { expired, decayed };
  }

  list(): StructuredMemory[] {
    this.assertLoaded();
    return this.memories.map((item) => structuredClone(item));
  }

  private async persist(): Promise<void> {
    const payload: MemoryFile = { version: 1, memories: this.memories };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await fs.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("StructuredMemoryStore.initialize() must be called first.");
  }
}

function scoreMemory(
  memory: StructuredMemory,
  queryTokens: Set<string>,
  entities: Set<string>,
  projectId: string | null | undefined,
  at: number,
): number {
  const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`);
  const overlap = queryTokens.size
    ? [...queryTokens].filter((token) => memoryTokens.has(token)).length / queryTokens.size
    : 0.45;
  const entityMatch = entities.size
    ? [...entities].filter((entity) => memory.entities.some((item) => normalize(item) === entity)).length / entities.size
    : 0;
  const projectMatch = projectId && memory.projectId === projectId ? 1 : memory.projectId ? 0.15 : 0.5;
  const ageDays = Math.max(0, (at - new Date(memory.updatedAt).getTime()) / 86_400_000);
  const recency = Math.exp(-ageDays / 60);
  const correctionBoost = memory.kind === "correction" ? 0.12 : 0;
  return (
    overlap * 0.34 + entityMatch * 0.12 + projectMatch * 0.14 + recency * 0.12 +
    memory.importance * 0.14 + memory.confidence * 0.14 + correctionBoost
  );
}

function legacyKind(category: string): MemoryKind {
  if (category === "preference" || category === "behavior") return "preference";
  if (category === "project" || category === "goal") return "project";
  if (category === "emotional" || category === "relationship") return "episodic";
  return "semantic";
}

function inferProject(text: string): string | null {
  const match = text.match(/\b(MYRAA|ALTREX|NEXTRON)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function extractEntities(text: string): string[] {
  const matches = text.match(/\b[A-Z][A-Z0-9_-]{2,}\b/g) || [];
  return unique(matches).slice(0, 12);
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalize(text).split(/[^a-z0-9]+/).filter((token) => token.length > 2),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
