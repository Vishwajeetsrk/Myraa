// MYRAA AI OS — Universal Connector Interface (§8)
// Every integration conforms to this. UI / planner NEVER call fetch() directly.

export type ConnectorHealthState =
  | 'connected' | 'healthy' | 'degraded' | 'rate_limited'
  | 'unauthorized' | 'unavailable' | 'not_configured';

export interface ConnectorHealth {
  state: ConnectorHealthState;
  latencyMs?: number;
  lastSuccess?: string;
  reason?: string;
}

export interface ConnectorResource { id: string; kind: string; name: string; uri?: string }
export interface ConnectorCapability { id: string; description: string; tools: string[] }
export interface MyraaExecutionContext {
  userId?: string;
  sessionId?: string;
  confirmed?: boolean;      // permission engine already approved high-risk?
  privacyMode?: 'local_only' | 'hybrid' | 'cloud' | 'strict_private';
  budget?: { maxSteps?: number; maxCost?: number; maxMs?: number };
}

export interface MyraaConnector {
  id: string;
  name: string;
  category: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<ConnectorHealth>;
  listResources(): Promise<ConnectorResource[]>;
  getCapabilities(): ConnectorCapability[];
  execute(action: string, input: unknown, context: MyraaExecutionContext): Promise<unknown>;
}

// Base class with health bookkeeping. Adapters extend this — no raw fetch in UI.
export abstract class BaseConnector implements MyraaConnector {
  abstract id: string; abstract name: string; abstract category: string;
  protected lastSuccess: string | null = null;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract listResources(): Promise<ConnectorResource[]>;
  abstract getCapabilities(): ConnectorCapability[];
  abstract execute(action: string, input: unknown, context: MyraaExecutionContext): Promise<unknown>;
  async healthCheck(): Promise<ConnectorHealth> {
    try {
      const t0 = Date.now();
      await this.ping();
      this.lastSuccess = new Date().toISOString();
      return { state: 'healthy', latencyMs: Date.now() - t0, lastSuccess: this.lastSuccess };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/401|unauthor/i.test(msg)) return { state: 'unauthorized', reason: msg };
      if (/429|rate/i.test(msg)) return { state: 'rate_limited', reason: msg };
      if (/not configured|no token|missing/i.test(msg)) return { state: 'not_configured', reason: msg };
      return { state: 'unavailable', reason: msg };
    }
  }
  protected abstract ping(): Promise<void>;
}
