import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { LearnedSkill } from "./types";

interface SkillFile {
  version: 1;
  skills: LearnedSkill[];
}

export interface LearnSkillInput {
  name: string;
  description: string;
  preconditions?: string[];
  steps: LearnedSkill["steps"];
  expectedOutcome: string;
  projectId?: string | null;
  confidence?: number;
  verified: boolean;
}

export class SkillManager {
  private skills: LearnedSkill[] = [];
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as SkillFile;
      this.skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        await fs.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {});
      }
      this.skills = [];
    }
    this.loaded = true;
  }

  async learn(input: LearnSkillInput): Promise<LearnedSkill> {
    this.assertLoaded();
    if (!input.verified) throw new Error("A demonstrated workflow must be verified before becoming a reusable skill.");
    const name = normalizeName(input.name);
    if (!name) throw new Error("Skill name is required.");
    if (!input.description.trim()) throw new Error("Skill description is required.");
    if (!input.expectedOutcome.trim()) throw new Error("Skill expectedOutcome is required.");
    if (!input.steps.length) throw new Error("A skill needs at least one verified step.");
    if (input.steps.length > 50) throw new Error("A skill cannot contain more than 50 steps.");

    const timestamp = new Date().toISOString();
    const existing = this.skills.find((skill) => skill.name === name && skill.projectId === (input.projectId ?? null));
    if (existing) {
      existing.description = input.description.trim();
      existing.preconditions = unique(input.preconditions || []);
      existing.steps = sanitizeSteps(input.steps);
      existing.expectedOutcome = input.expectedOutcome.trim();
      existing.confidence = clamp(Math.max(existing.confidence, input.confidence ?? 0.7));
      existing.verified = true;
      existing.updatedAt = timestamp;
      await this.persist();
      return structuredClone(existing);
    }

    const skill: LearnedSkill = {
      id: randomUUID(),
      name,
      description: input.description.trim(),
      preconditions: unique(input.preconditions || []),
      steps: sanitizeSteps(input.steps),
      expectedOutcome: input.expectedOutcome.trim(),
      projectId: input.projectId ?? null,
      confidence: clamp(input.confidence ?? 0.7),
      uses: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      verified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: null,
    };
    this.skills.push(skill);
    await this.persist();
    return structuredClone(skill);
  }

  async recordOutcome(id: string, succeeded: boolean): Promise<LearnedSkill> {
    this.assertLoaded();
    const skill = this.skills.find((item) => item.id === id);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    skill.uses += 1;
    if (succeeded) skill.successes += 1;
    else skill.failures += 1;
    skill.successRate = skill.uses ? skill.successes / skill.uses : 0;
    skill.confidence = clamp(skill.confidence + (succeeded ? 0.035 : -0.09));
    skill.lastUsedAt = new Date().toISOString();
    skill.updatedAt = skill.lastUsedAt;
    await this.persist();
    return structuredClone(skill);
  }

  find(name: string, projectId?: string | null): LearnedSkill | null {
    this.assertLoaded();
    const normalized = normalizeName(name);
    const candidates = this.skills.filter(
      (skill) => skill.name === normalized && (!projectId || !skill.projectId || skill.projectId === projectId),
    );
    candidates.sort((a, b) => b.confidence - a.confidence || b.successRate - a.successRate);
    return candidates[0] ? structuredClone(candidates[0]) : null;
  }

  list(projectId?: string | null): LearnedSkill[] {
    this.assertLoaded();
    return this.skills
      .filter((skill) => !projectId || !skill.projectId || skill.projectId === projectId)
      .map((skill) => structuredClone(skill));
  }

  private async persist(): Promise<void> {
    const payload: SkillFile = { version: 1, skills: this.skills };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await fs.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("SkillManager.initialize() must be called first.");
  }
}

function sanitizeSteps(steps: LearnedSkill["steps"]): LearnedSkill["steps"] {
  return steps.map((step, index) => {
    if (!step.action?.trim()) throw new Error(`Skill step ${index + 1} needs an action.`);
    return {
      id: step.id?.trim() || `step-${index + 1}`,
      action: step.action.trim(),
      tool: step.tool?.trim() || undefined,
      arguments: step.arguments ? structuredClone(step.arguments) : undefined,
    };
  });
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
