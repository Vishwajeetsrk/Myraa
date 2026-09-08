import fs from "node:fs/promises";
import path from "node:path";
import type {
  ApiCatalogueMetadata,
  ApiCatalogueSummary,
  ApiProvider,
  ApiProviderHealth,
  ApiProviderStatus,
  ApiRegistryFile,
  ApiSearchResult,
  ParsedCatalogue,
} from "./types";

const EMPTY_HEALTH: ApiProviderHealth = {
  state: "unchecked",
  checkedAt: null,
  statusCode: null,
  latencyMs: null,
  consecutiveFailures: 0,
  error: null,
};

const STATUS_ORDER: Record<ApiProviderStatus, number> = {
  READY_NO_AUTH: 6,
  NEEDS_API_KEY: 4,
  NEEDS_OAUTH: 3,
  UNKNOWN: 2,
  UNSUPPORTED: 1,
  BROKEN: 0,
};

const TERM_ALIASES: Record<string, string[]> = {
  weather: ["forecast", "climate", "rain", "temperature"],
  rocket: ["space", "launch", "nasa", "spaceflight"],
  ip: ["geolocation", "network", "address", "location"],
  country: ["nation", "geography", "location"],
  currency: ["exchange", "forex", "money", "rate"],
  news: ["headlines", "media", "articles"],
  music: ["audio", "songs", "spotify"],
  image: ["photo", "pictures", "visual"],
};

export class ApiCapabilityRegistry {
  private providers = new Map<string, ApiProvider>();
  private metadata: ApiCatalogueMetadata;
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly source: string) {
    this.metadata = emptyMetadata(source);
  }

  async initialize(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as ApiRegistryFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.providers)) throw new Error("Unsupported API registry format.");
      this.metadata = { ...emptyMetadata(this.source), ...parsed.metadata, source: this.source };
      for (const provider of parsed.providers) this.providers.set(provider.id, provider);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await fs.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => undefined);
      }
    }
    this.loaded = true;
  }

  async import(
    parsed: ParsedCatalogue,
    sourceMetadata: { etag?: string | null; lastModified?: string | null } = {},
  ): Promise<ApiCatalogueSummary> {
    this.assertLoaded();
    const timestamp = new Date().toISOString();
    for (const current of this.providers.values()) current.cataloguePresent = false;

    for (const incoming of parsed.providers) {
      const existing = this.providers.get(incoming.id);
      this.providers.set(incoming.id, {
        ...incoming,
        firstSeenAt: existing?.firstSeenAt || timestamp,
        updatedAt: timestamp,
        health: existing?.health || { ...EMPTY_HEALTH },
        status: existing?.health.state === "broken" ? "BROKEN" : incoming.status,
      });
    }
    this.metadata = {
      source: this.source,
      syncedAt: timestamp,
      sourceEtag: sourceMetadata.etag ?? null,
      sourceLastModified: sourceMetadata.lastModified ?? null,
      imported: parsed.providers.length,
      duplicates: parsed.duplicates,
      rejected: parsed.rejected,
    };
    await this.persist();
    return this.summary();
  }

  get(id: string): ApiProvider | null {
    this.assertLoaded();
    const provider = this.providers.get(id);
    return provider ? structuredClone(provider) : null;
  }

  search(query: string, options: { limit?: number; readyOnly?: boolean } = {}): ApiSearchResult[] {
    this.assertLoaded();
    const terms = expandTerms(tokenize(query));
    if (!terms.length) return [];
    const results: ApiSearchResult[] = [];
    for (const provider of this.providers.values()) {
      if (!provider.cataloguePresent) continue;
      if (options.readyOnly && provider.status !== "READY_NO_AUTH") continue;
      const name = normalize(provider.name);
      const category = normalize(provider.category);
      const description = normalize(provider.description);
      const host = normalize(safeHost(provider.documentationUrl));
      const matched = new Set<string>();
      let score = 0;
      for (const term of terms) {
        if (name.includes(term)) { score += 7; matched.add(term); }
        if (category.includes(term)) { score += 5; matched.add(term); }
        if (description.includes(term)) { score += 3; matched.add(term); }
        if (host.includes(term)) { score += 1; matched.add(term); }
      }
      if (!score) continue;
      score += STATUS_ORDER[provider.status] * 0.35;
      if (provider.https === "yes") score += 0.5;
      if (provider.health.state === "healthy") score += 2;
      if (provider.health.state === "degraded") score -= 1;
      results.push({ provider: structuredClone(provider), score, matchedTerms: [...matched] });
    }
    return results
      .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name))
      .slice(0, clamp(options.limit ?? 8, 1, 30));
  }

  list(options: { category?: string; status?: ApiProviderStatus; limit?: number } = {}): ApiProvider[] {
    this.assertLoaded();
    return [...this.providers.values()]
      .filter((provider) => provider.cataloguePresent)
      .filter((provider) => !options.category || normalize(provider.category) === normalize(options.category))
      .filter((provider) => !options.status || provider.status === options.status)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
      .slice(0, clamp(options.limit ?? 100, 1, 500))
      .map((provider) => structuredClone(provider));
  }

  async recordHealth(id: string, health: Omit<ApiProviderHealth, "consecutiveFailures">): Promise<ApiProvider> {
    this.assertLoaded();
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown API provider: ${id}`);
    const failed = health.state === "broken";
    provider.health = {
      ...health,
      consecutiveFailures: failed ? provider.health.consecutiveFailures + 1 : 0,
    };
    if (failed && provider.health.consecutiveFailures >= 2) provider.status = "BROKEN";
    if (!failed && provider.status === "BROKEN") {
      provider.status = provider.https === "no"
        ? "UNSUPPORTED"
        : provider.auth === "none"
          ? "READY_NO_AUTH"
          : provider.auth === "oauth"
            ? "NEEDS_OAUTH"
            : "NEEDS_API_KEY";
    }
    provider.updatedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(provider);
  }

  summary(): ApiCatalogueSummary {
    this.assertLoaded();
    const active = [...this.providers.values()].filter((provider) => provider.cataloguePresent);
    const statuses = counter<ApiProviderStatus>([
      "READY_NO_AUTH", "NEEDS_API_KEY", "NEEDS_OAUTH", "BROKEN", "UNSUPPORTED", "UNKNOWN",
    ]);
    const health = counter<ApiProviderHealth["state"]>(["unchecked", "healthy", "degraded", "broken"]);
    for (const provider of active) {
      statuses[provider.status] += 1;
      health[provider.health.state] += 1;
    }
    return {
      source: this.metadata.source,
      syncedAt: this.metadata.syncedAt,
      providerCount: active.length,
      categories: new Set(active.map((provider) => provider.category)).size,
      statuses,
      health,
    };
  }

  getMetadata(): ApiCatalogueMetadata {
    this.assertLoaded();
    return structuredClone(this.metadata);
  }

  private persist(): Promise<void> {
    const payload: ApiRegistryFile = {
      version: 1,
      metadata: this.metadata,
      providers: [...this.providers.values()],
    };
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.filePath}.tmp-${process.pid}`;
      await fs.writeFile(temporary, JSON.stringify(payload, null, 2), "utf-8");
      await fs.rename(temporary, this.filePath);
    });
    return this.writeQueue;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("API capability registry has not been initialized.");
  }
}

function emptyMetadata(source: string): ApiCatalogueMetadata {
  return {
    source,
    syncedAt: null,
    sourceEtag: null,
    sourceLastModified: null,
    imported: 0,
    duplicates: 0,
    rejected: 0,
  };
}

function tokenize(value: string): string[] {
  return normalize(value).split(" ").filter((item) => item.length >= 2);
}

function expandTerms(terms: string[]): string[] {
  const expanded = new Set(terms);
  for (const term of terms) for (const alias of TERM_ALIASES[term] || []) expanded.add(alias);
  return [...expanded];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function safeHost(value: string): string {
  try { return new URL(value).hostname; } catch { return ""; }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function counter<T extends string>(keys: T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}
