import fs from "node:fs/promises";
import path from "node:path";
import type { DeclarativeApiAdapter } from "./types";
import { isSafePublicUrl } from "./healthChecker";

interface AdapterFile { version: 1; adapters: DeclarativeApiAdapter[] }

export class ApiAdapterRegistry {
  private adapters = new Map<string, DeclarativeApiAdapter>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    if (this.loaded) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as AdapterFile;
      if (parsed.version !== 1 || !Array.isArray(parsed.adapters)) throw new Error("Unsupported adapter registry format.");
      for (const adapter of parsed.adapters) this.adapters.set(adapter.id, adapter);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await fs.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => undefined);
      }
    }
    this.loaded = true;
  }

  list(capability?: string): DeclarativeApiAdapter[] {
    this.assertLoaded();
    const terms = capability?.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 2) || [];
    return [...this.adapters.values()]
      .filter((adapter) => !terms.length || terms.some((term) => adapter.capability.toLowerCase().includes(term)))
      .map((adapter) => structuredClone(adapter));
  }

  get(id: string): DeclarativeApiAdapter | null {
    this.assertLoaded();
    const adapter = this.adapters.get(id);
    return adapter ? structuredClone(adapter) : null;
  }

  async save(candidate: DeclarativeApiAdapter): Promise<DeclarativeApiAdapter> {
    this.assertLoaded();
    validateAdapter(candidate);
    if (!candidate.verified || !candidate.verifiedAt) {
      throw new Error("Only adapters verified against a controlled fixture may be registered.");
    }
    const timestamp = new Date().toISOString();
    const previous = this.adapters.get(candidate.id);
    const adapter = {
      ...candidate,
      createdAt: previous?.createdAt || candidate.createdAt || timestamp,
      updatedAt: timestamp,
    };
    this.adapters.set(adapter.id, adapter);
    await this.persist();
    return structuredClone(adapter);
  }

  private async persist(): Promise<void> {
    const temporary = `${this.filePath}.tmp-${process.pid}`;
    const payload: AdapterFile = { version: 1, adapters: [...this.adapters.values()] };
    await fs.writeFile(temporary, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(temporary, this.filePath);
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("API adapter registry has not been initialized.");
  }
}

export function validateAdapter(adapter: DeclarativeApiAdapter): void {
  if (!/^[a-z0-9][a-z0-9._:-]{2,100}$/i.test(adapter.id)) throw new Error("Adapter ID is invalid.");
  if (!adapter.providerId.trim() || !adapter.capability.trim()) throw new Error("Adapter provider and capability are required.");
  if (!['GET', 'POST'].includes(adapter.method)) throw new Error("Only GET and POST declarative adapters are supported.");
  const probeUrl = adapter.urlTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "sample");
  if (!isSafePublicUrl(probeUrl)) throw new Error("Adapter URL must be a safe public HTTP(S) URL.");
  if (adapter.credentialEnv && !/^[A-Z][A-Z0-9_]{2,100}$/.test(adapter.credentialEnv)) {
    throw new Error("Credential references must be environment-variable names, never literal secrets.");
  }
  const names = new Set<string>();
  for (const parameter of adapter.parameters) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(parameter.name)) throw new Error("Adapter parameter name is invalid.");
    if (names.has(parameter.name)) throw new Error(`Duplicate adapter parameter: ${parameter.name}`);
    names.add(parameter.name);
  }
  for (const [field, jsonPath] of Object.entries(adapter.output)) {
    if (!field.trim() || !/^\$?(?:\.[a-zA-Z0-9_-]+|\[[0-9]+\])*$/.test(jsonPath)) {
      throw new Error("Adapter output mappings must use restricted JSON paths.");
    }
  }
}
