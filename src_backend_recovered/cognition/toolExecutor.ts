import type { CognitionConfig } from "./config";
import { ConfirmationStore, SafetyPolicy } from "./safety";
import { ToolRegistry } from "./toolRegistry";
import type {
  CognitiveEventInput,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types";

export type ToolHandler = (
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<{ ok: boolean; result?: unknown; error?: string }>;

export interface ToolExecutorOptions {
  config: CognitionConfig;
  registry: ToolRegistry;
  handler: ToolHandler;
  confirmations?: ConfirmationStore;
  emit?: (event: CognitiveEventInput) => void | Promise<void>;
}

export class ToolExecutor {
  readonly confirmations: ConfirmationStore;
  private readonly safety: SafetyPolicy;
  private readonly active = new Map<string, AbortController>();
  private readonly failures = new Map<string, number>();

  constructor(private readonly options: ToolExecutorOptions) {
    this.safety = new SafetyPolicy(options.config);
    this.confirmations = options.confirmations || new ConfirmationStore();
  }

  async execute(
    tool: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = {},
  ): Promise<ToolExecutionResult> {
    const started = Date.now();
    const descriptor = this.options.registry.get(tool);
    if (!descriptor) {
      return result(false, "denied", tool, null, `Unknown or unregistered tool: ${tool}`, 2, started, 0);
    }

    const riskLevel = this.options.registry.assessRisk(tool, args, context.projectRoot);
    const assessment = this.safety.assess(descriptor.permission, riskLevel, context.confirmed === true);
    if (!assessment.allowed) {
      await this.emit("tool.denied", tool, riskLevel, context, { reason: assessment.reason });
      return result(false, "denied", tool, null, assessment.reason, riskLevel, started, 0);
    }

    if (assessment.requiresConfirmation) {
      const pending = this.confirmations.create({
        tool,
        args,
        riskLevel,
        reason: assessment.reason,
        correlationId: context.correlationId,
      });
      await this.emit("safety.confirmation_required", tool, riskLevel, context, {
        confirmationId: pending.id,
        description: `${tool} requires confirmation: ${assessment.reason}`,
        reason: assessment.reason,
      });
      return {
        ...result(false, "confirmation_required", tool, null, assessment.reason, riskLevel, started, 0),
        confirmationId: pending.id,
      };
    }

    const operationId = context.correlationId || `${tool}:${started}`;
    const controller = new AbortController();
    this.active.set(operationId, controller);
    await this.emit("tool.started", tool, riskLevel, context, { operationId });

    let attempts = 0;
    try {
      const allowedAttempts = Math.min(
        descriptor.maxRetries,
        this.options.config.limits.maxRetries,
      ) + 1;
      let lastError = "Tool failed.";
      while (attempts < allowedAttempts) {
        attempts += 1;
        try {
          const response = await withTimeout(
            this.options.handler(tool, args, controller.signal),
            descriptor.timeoutMs,
            controller,
          );
          if (controller.signal.aborted) {
            await this.emit("tool.cancelled", tool, riskLevel, context, { operationId, attempts });
            return result(false, "cancelled", tool, null, "Tool was cancelled.", riskLevel, started, attempts);
          }
          if (response.ok) {
            const previousFailures = this.failures.get(tool) || 0;
            this.failures.set(tool, 0);
            await this.emit("tool.succeeded", tool, riskLevel, context, {
              operationId,
              attempts,
              recoveredAfterFailures: previousFailures > 0,
            });
            return result(true, "succeeded", tool, response.result ?? null, null, riskLevel, started, attempts);
          }
          lastError = response.error || lastError;
        } catch (error) {
          if (controller.signal.aborted) {
            const timedOut = error instanceof Error && error.message === "TOOL_TIMEOUT";
            const status = timedOut ? "timed_out" : "cancelled";
            await this.emit(`tool.${status}`, tool, riskLevel, context, { operationId, attempts });
            return result(false, status, tool, null, timedOut ? "Tool timed out." : "Tool was cancelled.", riskLevel, started, attempts);
          }
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      this.failures.set(tool, (this.failures.get(tool) || 0) + 1);
      await this.emit("tool.failed", tool, riskLevel, context, { operationId, attempts, error: lastError });
      return result(false, "failed", tool, null, lastError, riskLevel, started, attempts);
    } finally {
      this.active.delete(operationId);
    }
  }

  async confirm(confirmationId: string): Promise<ToolExecutionResult> {
    const pending = this.confirmations.consume(confirmationId);
    if (!pending) {
      return result(false, "denied", "unknown", null, "Confirmation is invalid or expired.", 3, Date.now(), 0);
    }
    await this.emit("safety.confirmation_resolved", pending.tool, pending.riskLevel, {
      correlationId: pending.correlationId,
      confirmed: true,
    }, { confirmationId });
    return this.execute(pending.tool, pending.args, {
      correlationId: pending.correlationId,
      confirmed: true,
    });
  }

  cancel(correlationId: string): boolean {
    const controller = this.active.get(correlationId);
    if (!controller) return false;
    controller.abort("user_cancelled");
    return true;
  }

  cancelAll(): number {
    const count = this.active.size;
    for (const controller of this.active.values()) controller.abort("user_cancelled");
    this.confirmations.cancelAll();
    return count;
  }

  private async emit(
    type: string,
    tool: string,
    riskLevel: number,
    context: ToolExecutionContext,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.options.emit?.({
      type,
      source: type.startsWith("safety.") ? "system" : "tool",
      correlationId: context.correlationId,
      importance: type.includes("failed") ? 0.78 : type.includes("confirmation") ? 0.9 : 0.52,
      metadata: { tool, riskLevel, ...metadata },
    });
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort("timeout");
      reject(new Error("TOOL_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function result(
  success: boolean,
  status: ToolExecutionResult["status"],
  tool: string,
  value: unknown,
  error: string | null,
  riskLevel: ToolExecutionResult["riskLevel"],
  started: number,
  attempts: number,
): ToolExecutionResult {
  return {
    success,
    status,
    tool,
    result: value,
    error,
    riskLevel,
    durationMs: Math.max(0, Date.now() - started),
    attempts,
  };
}
