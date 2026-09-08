import { randomUUID } from "node:crypto";
import type { CognitionConfig } from "./config";
import type { PermissionName, RiskLevel } from "./types";

export interface SafetyAssessment {
  allowed: boolean;
  permission: PermissionName;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  reason: string;
}

export interface PendingConfirmation {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  riskLevel: RiskLevel;
  reason: string;
  correlationId?: string;
  createdAt: string;
  expiresAt: string;
}

export class SafetyPolicy {
  constructor(private readonly config: CognitionConfig) {}

  assess(permission: PermissionName, riskLevel: RiskLevel, alreadyConfirmed = false): SafetyAssessment {
    if (!this.config.permissions[permission]) {
      return {
        allowed: false,
        permission,
        riskLevel,
        requiresConfirmation: false,
        reason: `Permission '${permission}' is disabled.`,
      };
    }
    if (this.config.autonomyPaused) {
      return {
        allowed: false,
        permission,
        riskLevel,
        requiresConfirmation: false,
        reason: "Autonomous actions are paused.",
      };
    }
    return {
      allowed: true,
      permission,
      riskLevel,
      requiresConfirmation: riskLevel >= 3 && !alreadyConfirmed,
      reason: riskLevel >= 3
        ? "This action can cause significant or irreversible changes."
        : "Action is within the configured permission and risk boundary.",
    };
  }
}

export class ConfirmationStore {
  private readonly pending = new Map<string, PendingConfirmation>();

  constructor(private readonly ttlMs = 120_000) {}

  create(input: Omit<PendingConfirmation, "id" | "createdAt" | "expiresAt">): PendingConfirmation {
    this.purgeExpired();
    const created = Date.now();
    const confirmation: PendingConfirmation = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + this.ttlMs).toISOString(),
    };
    this.pending.set(confirmation.id, confirmation);
    return structuredClone(confirmation);
  }

  consume(id: string): PendingConfirmation | null {
    this.purgeExpired();
    const value = this.pending.get(id);
    if (!value) return null;
    this.pending.delete(id);
    return structuredClone(value);
  }

  cancel(id: string): boolean {
    return this.pending.delete(id);
  }

  cancelAll(): number {
    const count = this.pending.size;
    this.pending.clear();
    return count;
  }

  list(): PendingConfirmation[] {
    this.purgeExpired();
    return [...this.pending.values()].map((item) => structuredClone(item));
  }

  private purgeExpired(): void {
    const current = Date.now();
    for (const [id, value] of this.pending) {
      if (new Date(value.expiresAt).getTime() <= current) this.pending.delete(id);
    }
  }
}
