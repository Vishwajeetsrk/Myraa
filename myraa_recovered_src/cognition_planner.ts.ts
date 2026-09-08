import type { Goal, GoalTask } from "./types";
import type { ModelRouter } from "./modelRouter";

export interface PlannedTask {
  id: string;
  title: string;
  priority: number;
  dependsOn: string[];
  maxRetries: number;
  timeoutMs: number;
}

export class GoalPlanner {
  constructor(private readonly router: ModelRouter, private readonly maxTasks = 20) {}

  async plan(goal: Goal, signal?: AbortSignal): Promise<PlannedTask[]> {
    const prompt = [
      "Create a concise executable plan for MYRAA. Return JSON only.",
      `Objective: ${goal.objective}`,
      `Constraints: ${goal.constraints.join("; ") || "none"}`,
      `Success criteria: ${goal.successCriteria.join("; ") || "none specified"}`,
      "Schema: {\"tasks\":[{\"id\":\"short_stable_id\",\"title\":\"specific action\",\"priority\":0.0,\"dependsOn\":[\"id\"],\"maxRetries\":0,\"timeoutMs\":300000}]}",
      `Rules: maximum ${this.maxTasks} tasks; dependencies must reference earlier task IDs; no circular dependencies; do not execute anything; risky actions must be explicit steps that mention confirmation.`,
    ].join("\n");
    const response = await this.router.generate({ capability: "reasoning", prompt, signal });
    const parsed = parseJson(response.text) as { tasks?: unknown };
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error("Planner returned no tasks.");
    }
    if (parsed.tasks.length > this.maxTasks) throw new Error("Planner exceeded the task budget.");

    const tasks = parsed.tasks.map((raw, index) => validateTask(raw, index));
    const ids = new Set<string>();
    for (const task of tasks) {
      if (ids.has(task.id)) throw new Error(`Planner returned duplicate task ID '${task.id}'.`);
      for (const dependency of task.dependsOn) {
        if (!ids.has(dependency)) {
          throw new Error(`Task '${task.id}' has an unknown or forward dependency '${dependency}'.`);
        }
      }
      ids.add(task.id);
    }
    return tasks;
  }
}

export function plannedTasksToGoalTasks(tasks: PlannedTask[]): Array<Partial<GoalTask> & Pick<GoalTask, "id" | "title">> {
  return tasks.map((task) => ({ ...task, status: "pending", attempts: 0, progress: 0, error: null }));
}

function validateTask(value: unknown, index: number): PlannedTask {
  if (!value || typeof value !== "object") throw new Error(`Planner task ${index + 1} is invalid.`);
  const raw = value as Record<string, unknown>;
  const id = String(raw.id || `task_${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const title = String(raw.title || "").trim();
  if (!id || !title) throw new Error(`Planner task ${index + 1} needs id and title.`);
  return {
    id,
    title,
    priority: clamp(Number(raw.priority ?? 0.5)),
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
    maxRetries: Math.max(0, Math.min(3, Number(raw.maxRetries ?? 1))),
    timeoutMs: Math.max(1_000, Math.min(3_600_000, Number(raw.timeoutMs ?? 300_000))),
  };
}

function parseJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}
