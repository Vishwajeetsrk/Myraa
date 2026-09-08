import net from "node:net";
import type { ApiProvider } from "./types";

export interface HealthCheckResult {
  state: "healthy" | "degraded" | "broken";
  checkedAt: string;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export async function checkProviderDocumentation(
  provider: ApiProvider,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<HealthCheckResult> {
  const checkedAt = new Date().toISOString();
  if (!isSafePublicUrl(provider.documentationUrl)) {
    return { state: "broken", checkedAt, statusCode: null, latencyMs: null, error: "Unsafe or unsupported documentation URL." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), clamp(options.timeoutMs ?? 8_000, 1_000, 30_000));
  timeout.unref?.();
  const started = Date.now();
  try {
    const response = await (options.fetcher || fetch)(provider.documentationUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "MYRAA-ApiHub/1.0" },
    });
    const latencyMs = Date.now() - started;
    const state = response.status >= 200 && response.status < 400
      ? "healthy"
      : response.status === 401 || response.status === 403 || response.status === 405 || response.status === 429
        ? "degraded"
        : "broken";
    return { state, checkedAt, statusCode: response.status, latencyMs, error: state === "broken" ? `HTTP ${response.status}` : null };
  } catch (error) {
    return {
      state: "broken",
      checkedAt,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: controller.signal.aborted ? "Health check timed out." : safeError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (net.isIP(host)) return !isPrivateIp(host);
    return true;
  } catch {
    return false;
  }
}

function isPrivateIp(host: string): boolean {
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
  }
  const [a, b] = host.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function safeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/https?:\/\/\S+/gi, "remote provider").slice(0, 240);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
