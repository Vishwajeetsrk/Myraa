import type { CriticVerdict, ToolExecutionResult } from "./types";

const TRANSIENT = /timeout|temporar|unavailable|connection|network|rate limit|busy|locked/i;

export class TaskCritic {
  verifyToolResult(result: ToolExecutionResult, expectedFields: string[] = []): CriticVerdict {
    if (!result.success) {
      const retryRecommended =
        result.status !== "denied" &&
        result.status !== "confirmation_required" &&
        TRANSIENT.test(result.error || "");
      return {
        passed: false,
        retryRecommended,
        reason: result.status === "confirmation_required"
          ? "Action is pending explicit user confirmation and has not executed."
          : result.error || `Tool ended with status '${result.status}'.`,
        missing: [],
      };
    }
    const output = result.result && typeof result.result === "object"
      ? result.result as Record<string, unknown>
      : {};
    const missing = expectedFields.filter((field) => !(field in output));
    return {
      passed: missing.length === 0,
      retryRecommended: false,
      reason: missing.length
        ? `Tool reported success but verification fields are missing: ${missing.join(", ")}.`
        : "Structured tool result confirms successful completion.",
      missing,
    };
  }
}
