import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Goal, GoalTask } from "./types";

interface GoalFile {
  version: 1;
  goals: Goal[];
}

export interface CreateGoalInput {
  objective: string;
  constraints?: string[];
  successCriteria?: string[];
  priority?: number;
  projectId?: string | null;
  tasks?: Array<Pick<GoalTask, "title"> & Partial<Omit<GoalTask, "title" | "createdAt" | "updatedAt">>>;
}

export class GoalManager {
  private goals: Goal[] = [];
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly maxTasks = 50) {}

  async initialize(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as GoalFile;
      this.goals = Array.isArray(parsed.goals) ? parsed.goals : [];
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        await fs.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {});
      }
      this.goals = [];
    }
    this.loaded = true;
    // Never silently resume state-changing work after restart.
    let changed = false;
    for (const goal of this.goals) {
      for (const task of goal.tasks) {
        if (task.status === "running") {
          task.status = "blocked";
          task.error = "Interrupted by restart; user verification is required before resuming.";
          task.updatedAt = new Date().toISOString();
          goal.status = "blocked";
          if (!goal.blockers.includes("restart-verification")) goal.blockers.push("restart-verification");
          changed = true;
        }
      }
    }
    if (changed) await this.persist();
  }

  async create(input: CreateGoalInput): Promise<Goal> {
    this.assertLoaded();
    const objective = input.objective.trim();
    if (!objective) throw new Error("Goal objective must not be empty.");
    const timestamp = new Date().toISOString();
    const rawTasks = (input.tasks || []).slice(0, this.maxTasks);
    const tasks: GoalTask[] = rawTasks.map((task) => ({
      id: task.id?.trim() || randomUUID(),
      title: task.title.trim(),
      status: task.status || "pending",
      priority: clamp(task.priority ?? 0.5),
      dependsOn: [...(task.dependsOn || [])],
      attempts: task.attempts || 0,
      maxRetries: Math.max(0, Math.min(5, task.maxRetries ?? 2)),
      timeoutMs: Math.max(1_000, Math.min(3_600_000, task.timeoutMs ?? 300_000)),
      progress: clamp(task.progress ?? 0),
      error: task.error || null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    validateTaskGraph(tasks);
    const goal: Goal = {
      id: randomUUID(),
      objective,
      constraints: unique(input.constraints || []),
      successCriteria: unique(input.successCriteria || []),
      priority: clamp(input.priority ?? 0.5),
      status: tasks.length ? "active" : "pending",
      projectId: input.projectId ?? null,
      tasks,
      blockers: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.goals.push(goal);
    await this.persist();
    return structuredClone(goal);
  }

  async updateTask(
    goalId: string,
    taskId: string,
    patch: Partial<Pick<GoalTask, "status" | "progress" | "error" | "attempts">>,
  ): Promise<Goal> {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    const task = goal.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (patch.status) task.status = patch.status;
    if (patch.progress !== undefined) task.progress = clamp(patch.progress);
    if (patch.error !== undefined) task.error = patch.error;
    if (patch.attempts !== undefined) task.attempts = Math.max(0, patch.attempts);
    task.updatedAt = new Date().toISOString();
    goal.updatedAt = task.updatedAt;
    goal.status = deriveGoalStatus(goal);
    await this.persist();
    return structuredClone(goal);
  }

  async setPlan(goalId: string, plannedTasks: CreateGoalInput["tasks"]): Promise<Goal> {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    if (["completed", "cancelled"].includes(goal.status)) {
      throw new Error(`Cannot replace the plan for a ${goal.status} goal.`);
    }
    const timestamp = new Date().toISOString();
    const rawTasks = (plannedTasks || []).slice(0, this.maxTasks);
    if (!rawTasks.length) throw new Error("A goal plan must contain at least one task.");
    const tasks: GoalTask[] = rawTasks.map((task) => ({
      id: task.id?.trim() || randomUUID(),
      title: task.title.trim(),
      status: "pending",
      priority: clamp(task.priority ?? 0.5),
      dependsOn: [...(task.dependsOn || [])],
      attempts: 0,
      maxRetries: Math.max(0, Math.min(5, task.maxRetries ?? 2)),
      timeoutMs: Math.max(1_000, Math.min(3_600_000, task.timeoutMs ?? 300_000)),
      progress: 0,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
    validateTaskGraph(tasks);
    goal.tasks = tasks;
    goal.status = "active";
    goal.blockers = goal.blockers.filter((item) => item !== "planning");
    goal.updatedAt = timestamp;
    await this.persist();
    return structuredClone(goal);
  }

  async cancel(goalId: string, reason = "Cancelled by user."): Promise<Goal> {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    goal.status = "cancelled";
    goal.updatedAt = new Date().toISOString();
    for (const task of goal.tasks) {
      if (["pending", "running", "blocked"].includes(task.status)) {
        task.status = "cancelled";
        task.error = reason;
        task.updatedAt = goal.updatedAt;
      }
    }
    await this.persist();
    return structuredClone(goal);
  }

  nextRunnableTask(goalId: string): GoalTask | null {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    const completed = new Set(goal.tasks.filter((task) => task.status === "completed").map((task) => task.id));
    const next = goal.tasks
      .filter((task) => task.status === "pending" && task.dependsOn.every((id) => completed.has(id)))
      .sort((a, b) => b.priority - a.priority)[0];
    return next ? structuredClone(next) : null;
  }

  get(id: string): Goal | null {
    this.assertLoaded();
    const goal = this.goals.find((item) => item.id === id);
    return goal ? structuredClone(goal) : null;
  }

  list(): Goal[] {
    this.assertLoaded();
    return this.goals.map((goal) => structuredClone(goal));
  }

  private requireGoal(id: string): Goal {
    const goal = this.goals.find((item) => item.id === id);
    if (!goal) throw new Error(`Unknown goal: ${id}`);
    return goal;
  }

  private async persist(): Promise<void> {
    const payload: GoalFile = { version: 1, goals: this.goals };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await fs.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("GoalManager.initialize() must be called first.");
  }
}

function deriveGoalStatus(goal: Goal): Goal["status"] {
  if (goal.tasks.length > 0 && goal.tasks.every((task) => task.status === "completed")) return "completed";
  if (goal.tasks.some((task) => task.status === "running")) return "active";
  if (goal.tasks.some((task) => task.status === "blocked")) return "blocked";
  if (goal.tasks.some((task) => task.status === "failed" && task.attempts > task.maxRetries)) return "failed";
  if (goal.tasks.every((task) => task.status === "cancelled")) return "cancelled";
  return "active";
}

function validateTaskGraph(tasks: GoalTask[]): void {
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    throw new Error("Goal task IDs must be unique.");
  }
  const taskIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    const unknownDependency = task.dependsOn.find((dependency) => !taskIds.has(dependency));
    if (unknownDependency) throw new Error(`Task '${task.id}' depends on unknown task '${unknownDependency}'.`);
    if (task.dependsOn.includes(task.id)) throw new Error(`Task '${task.id}' cannot depend on itself.`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`Goal plan contains a dependency cycle at '${id}'.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
