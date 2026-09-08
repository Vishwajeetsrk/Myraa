import path from "node:path";
import { ApiAdapterRegistry } from "./adapterRegistry";
import { executeVerifiedAdapter } from "./adapterExecutor";
import { parsePublicApisMarkdown, PUBLIC_APIS_CATALOGUE_URL } from "./catalogueImporter";
import { checkProviderDocumentation } from "./healthChecker";
import { seedBuiltInAdapters } from "./builtInAdapters";
import { ApiCapabilityRegistry } from "./registry";

export interface ApiHubOptions {
  dataDir: string;
  sourceUrl?: string;
  fetcher?: typeof fetch;
  maximumAgeMs?: number;
  minimumProviderCount?: number;
  healthTimeoutMs?: number;
}

export class ApiHubService {
  readonly registry: ApiCapabilityRegistry;
  readonly adapters: ApiAdapterRegistry;
  readonly sourceUrl: string;
  private readonly fetcher: typeof fetch;
  private syncInFlight: Promise<ReturnType<ApiCapabilityRegistry["summary"]>> | null = null;

  constructor(private readonly options: ApiHubOptions) {
    this.sourceUrl = options.sourceUrl || PUBLIC_APIS_CATALOGUE_URL;
    this.fetcher = options.fetcher || fetch;
    const directory = path.join(options.dataDir, "api-hub");
    this.registry = new ApiCapabilityRegistry(path.join(directory, "providers.v1.json"), this.sourceUrl);
    this.adapters = new ApiAdapterRegistry(path.join(directory, "adapters.v1.json"));
  }

  async initialize(): Promise<void> {
    await Promise.all([this.registry.initialize(), this.adapters.initialize()]);
    await seedBuiltInAdapters(this.adapters);
  }

  async sync(force = false): Promise<ReturnType<ApiCapabilityRegistry["summary"]>> {
    if (!force && !this.isStale()) return this.registry.summary();
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.performSync();
    try {
      return await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
    }
  }

  isStale(): boolean {
    const syncedAt = this.registry.getMetadata().syncedAt;
    if (!syncedAt) return true;
    const age = Date.now() - new Date(syncedAt).getTime();
    return !Number.isFinite(age) || age >= clamp(this.options.maximumAgeMs ?? 86_400_000, 60_000, 30 * 86_400_000);
  }

  async checkProvider(id: string) {
    const provider = this.registry.get(id);
    if (!provider) throw new Error(`Unknown API provider: ${id}`);
    const result = await checkProviderDocumentation(provider, {
      timeoutMs: this.options.healthTimeoutMs,
      fetcher: this.fetcher,
    });
    return this.registry.recordHealth(id, { ...result });
  }

  async callAdapter(id: string, args: Record<string, unknown>, signal?: AbortSignal) {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown API adapter: ${id}`);
    return executeVerifiedAdapter(adapter, args, { fetcher: this.fetcher, signal });
  }

  status() {
    return {
      ...this.registry.summary(),
      metadata: this.registry.getMetadata(),
      stale: this.isStale(),
      verifiedAdapters: this.adapters.list().filter((adapter) => adapter.verified).length,
    };
  }

  private async performSync(): Promise<ReturnType<ApiCapabilityRegistry["summary"]>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), 30_000);
    timeout.unref?.();
    try {
      const metadata = this.registry.getMetadata();
      const headers: Record<string, string> = { "user-agent": "MYRAA-ApiHub/1.0" };
      if (metadata.sourceEtag) headers["if-none-match"] = metadata.sourceEtag;
      if (metadata.sourceLastModified) headers["if-modified-since"] = metadata.sourceLastModified;
      const response = await this.fetcher(this.sourceUrl, { signal: controller.signal, headers, redirect: "follow" });
      if (response.status === 304) return this.registry.summary();
      if (!response.ok) throw new Error(`Public API catalogue returned HTTP ${response.status}.`);
      const markdown = await response.text();
      const parsed = parsePublicApisMarkdown(markdown, this.sourceUrl);
      const minimum = clamp(this.options.minimumProviderCount ?? 100, 1, 10_000);
      if (parsed.providers.length < minimum) {
        throw new Error(`Catalogue validation failed: expected at least ${minimum} providers, parsed ${parsed.providers.length}.`);
      }
      return await this.registry.import(parsed, {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
