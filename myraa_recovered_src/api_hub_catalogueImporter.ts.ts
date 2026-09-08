import { createHash } from "node:crypto";
import type {
  ApiAuthType,
  ApiProviderStatus,
  ParsedCatalogue,
  TernarySupport,
} from "./types";

export const PUBLIC_APIS_CATALOGUE_URL =
  "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md";

// The upstream file is not completely uniform: the first table currently
// omits the closing pipe while later category tables include it.
const TABLE_HEADER = /^\s*API\s*\|\s*Description\s*\|\s*Auth\s*\|\s*HTTPS\s*\|\s*CORS\s*\|?\s*$/i;
const CATEGORY_HEADER = /^###\s+(.+?)\s*$/;
const LINK_CELL = /^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/i;

export function parsePublicApisMarkdown(markdown: string, source = PUBLIC_APIS_CATALOGUE_URL): ParsedCatalogue {
  const providers: ParsedCatalogue["providers"] = [];
  const seen = new Set<string>();
  let category = "";
  let inApiTable = false;
  let duplicates = 0;
  let rejected = 0;

  for (const rawLine of markdown.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const heading = rawLine.match(CATEGORY_HEADER);
    if (heading) {
      category = cleanText(heading[1]);
      inApiTable = false;
      continue;
    }
    if (TABLE_HEADER.test(rawLine.trim())) {
      inApiTable = Boolean(category);
      continue;
    }
    if (!inApiTable || !rawLine.trim().startsWith("|")) continue;
    if (/^\s*\|?\s*:?-{3}/.test(rawLine)) continue;

    const cells = splitMarkdownRow(rawLine);
    if (cells.length < 5) {
      rejected += 1;
      continue;
    }
    const link = cells[0].trim().match(LINK_CELL);
    if (!link) {
      rejected += 1;
      continue;
    }

    const name = cleanText(link[1]);
    const documentationUrl = normalizeUrl(link[2]);
    if (!name || !documentationUrl) {
      rejected += 1;
      continue;
    }
    const dedupeKey = documentationUrl.toLowerCase();
    if (seen.has(dedupeKey)) {
      duplicates += 1;
      continue;
    }
    seen.add(dedupeKey);

    const authRaw = cleanText(cells[2]);
    const auth = normalizeAuth(authRaw);
    const https = normalizeSupport(cells[3]);
    providers.push({
      id: providerId(documentationUrl),
      name,
      description: cleanText(cells[1]),
      category,
      documentationUrl,
      auth,
      authRaw,
      https,
      cors: normalizeSupport(cells[4]),
      status: initialStatus(auth, https),
      cataloguePresent: true,
      source,
    });
  }

  return { providers, duplicates, rejected };
}

export function normalizeAuth(value: string): ApiAuthType {
  const normalized = cleanText(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized || ["unknown", "?"].includes(normalized)) return "unknown";
  if (["no", "none", "false"].includes(normalized)) return "none";
  if (normalized.includes("oauth")) return "oauth";
  if (normalized.includes("apikey") || normalized.includes("key") || normalized.includes("token")) {
    return "apiKey";
  }
  return "custom";
}

export function normalizeSupport(value: string): TernarySupport {
  const normalized = cleanText(value).toLowerCase();
  if (["yes", "true"].includes(normalized)) return "yes";
  if (["no", "false"].includes(normalized)) return "no";
  return "unknown";
}

export function initialStatus(auth: ApiAuthType, https: TernarySupport): ApiProviderStatus {
  if (https === "no") return "UNSUPPORTED";
  if (auth === "none") return "READY_NO_AUTH";
  if (auth === "oauth") return "NEEDS_OAUTH";
  if (auth === "apiKey" || auth === "custom") return "NEEDS_API_KEY";
  return "UNKNOWN";
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of trimmed) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  while (cells.length > 5 && !cells.at(-1)) cells.pop();
  return cells;
}

function cleanText(value: string): string {
  return value
    .replace(/`/g, "")
    .replace(/\\\|/g, "|")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return "";
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function providerId(documentationUrl: string): string {
  return `public-apis:${createHash("sha256").update(documentationUrl.toLowerCase()).digest("hex").slice(0, 20)}`;
}
