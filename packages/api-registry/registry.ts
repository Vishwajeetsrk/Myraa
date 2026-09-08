// MYRAA AI OS — Canonical API Registry
// Additive foundation. Does NOT replace existing plugins / Tauri commands / dist routes.
// Discovery source: public-apis/public-apis (catalog only, never runtime dependency).
// Every external capability must go: Myraa -> Tool Registry -> Connector -> API Adapter -> Permission Check -> External API.

export type ApiAuthKind = 'none' | 'apiKey' | 'oauth' | 'bearer' | 'basic' | 'service_account' | 'varies';
export type PrivacyLevel = 'public' | 'low' | 'medium' | 'high' | 'strict';
export type RegistryStatus = 'available' | 'candidate' | 'connected' | 'degraded' | 'rate_limited' | 'unauthorized' | 'unavailable' | 'not_configured' | 'rejected';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'REJECT';

export interface ApiProviderEntry {
  id: string;               // e.g. "open-meteo", "frankfurter", "github"
  name: string;
  provider: string;
  category: string;         // Development | Productivity | Knowledge | Finance | News | Weather | Travel | Communication | Creative | Data | Security
  description: string;
  baseUrl: string;
  authentication: ApiAuthKind;
  requiredScopes?: string[];
  freeTier: string;         // NEVER claim "free" unless verified. Use "Verify" by default.
  rateLimits: string;
  privacyLevel: PrivacyLevel;
  dataTypes: string[];
  tools: string[];          // tool ids in packages/api-registry/tools/registry.ts
  webhooks?: string[];
  healthCheck: string;      // how to ping health (endpoint or command)
  status: RegistryStatus;
  priority: Priority;
  priorityScore?: number;   // 0-100 per §5 weighting
  myraaUse: string;         // concrete Myraa use-case, capability language not API jargon
  notes?: string;
}

// §5 weighting: Capability 25 / Usefulness 20 / Reliability 15 / Security 15 / Privacy 10 / Free 10 / Complexity 5
export function scoreApi(s: { capability: number; usefulness: number; reliability: number; security: number; privacy: number; free: number; complexity: number }): { score: number; priority: Priority } {
  const score = Math.round(
    s.capability * 0.25 + s.usefulness * 0.2 + s.reliability * 0.15 +
    s.security * 0.15 + s.privacy * 0.1 + s.free * 0.1 + s.complexity * 0.05
  );
  const priority: Priority = score >= 85 ? 'P0' : score >= 70 ? 'P1' : score >= 50 ? 'P2' : score >= 30 ? 'P3' : 'REJECT';
  return { score, priority };
}

// Canonical registry — curated, NOT auto-imported from public-apis.
// Existing MYRAA reality mapped first; new candidates are P1-P3 until verified.
export const API_REGISTRY: ApiProviderEntry[] = [
  {
    id: 'github-rest', name: 'GitHub REST', provider: 'GitHub', category: 'Development',
    description: 'Repos, issues, PRs, code search. Existing MYRAA plugin tile is infra REAL / API MOCK — needs real REST.',
    baseUrl: 'https://api.github.com', authentication: 'oauth', requiredScopes: ['repo (scoped, repo-level allow-list)'],
    freeTier: 'Verify — rate limits vary by auth', rateLimits: '5000 req/hr authed (verify)', privacyLevel: 'medium',
    dataTypes: ['repo metadata', 'code', 'issues', 'prs'], tools: ['myraa.github.repo_list', 'myraa.github.search_code', 'myraa.github.create_branch', 'myraa.github.create_pr'],
    webhooks: ['github.push', 'github.pull_request', 'github.issue'], healthCheck: 'GET /rate_limit with github_token from vault',
    status: 'connected', priority: 'P0', myraaUse: 'GitHub Development: analyze repo, review PR, create branch/PR with confirmation',
    notes: 'Verified 2026-09-08 via myraa_github_connector.cjs (unauthenticated public read OK; token from SecureVault, server-only). Read tools live; writes gated on allow-list + confirmation.',
  },
  {
    id: 'open-meteo', name: 'Open-Meteo', provider: 'Open-Meteo', category: 'Weather',
    description: 'No-key weather forecast, CORS-enabled. Best P0 weather candidate (verify ToS before prod).',
    baseUrl: 'https://api.open-meteo.com', authentication: 'none',
    freeTier: 'Verify — no key required for non-commercial (check ToS)', rateLimits: 'Verify', privacyLevel: 'low',
    dataTypes: ['forecast', 'current weather'], tools: ['myraa.weather.get'],
    healthCheck: 'GET /v1/forecast?latitude=28.6&longitude=77.2&current_weather=true',
    status: 'connected', priority: 'P0', myraaUse: 'Weather Intelligence voice: "Myraa, what is the weather?"',
    notes: 'Verified live 2026-09-08 via resources/app/dist/myraa_weather_connector.cjs (Delhi 33°C, 1096ms, cache 10min). Adapter wraps weather_service.cjs; never invents data.',
  },
  {
    id: 'frankfurter', name: 'Frankfurter', provider: 'Frankfurter', category: 'Finance',
    description: 'No-key FX rates (ECB-backed). Best P1 currency candidate. No transactions.',
    baseUrl: 'https://api.frankfurter.app', authentication: 'none',
    freeTier: 'Verify — no key (check ToS)', rateLimits: 'Verify', privacyLevel: 'low',
    dataTypes: ['fx rates'], tools: ['myraa.currency.convert'],
    healthCheck: 'GET /v1/latest?from=USD',
    status: 'connected', priority: 'P1', myraaUse: 'Currency conversion voice + finance info (read-only, disclaimer)',
    notes: 'Verified 2026-09-08 via myraa_currency_connector.cjs. Host moved to api.frankfurter.dev/v1; connector follows redirects. Read-only, no transactions.',
  },
  {
    id: 'nager-date', name: 'Nager.Date', provider: 'Nager.Date', category: 'Productivity',
    description: 'Public holidays 90+ countries, no key. For daily briefing / calendar.',
    baseUrl: 'https://date.nager.at', authentication: 'none',
    freeTier: 'Verify — no key', rateLimits: 'Verify', privacyLevel: 'low',
    dataTypes: ['public holidays'], tools: ['myraa.calendar.get_holidays'],
    healthCheck: 'GET /api/v3/PublicHolidays/2026/IN',
    status: 'connected', priority: 'P1', myraaUse: 'Daily briefing + planning (holidays)',
    notes: 'Verified 2026-09-08 via myraa_holidays_connector.cjs. Note: Nager.Date has no India data (204) — honest unsupported-country message returned.',
  },
  {
    id: 'openlibrary', name: 'Open Library', provider: 'Internet Archive', category: 'Knowledge',
    description: 'Books, covers, metadata. No key.',
    baseUrl: 'https://openlibrary.org', authentication: 'none',
    freeTier: 'Verify — no key', rateLimits: 'Verify', privacyLevel: 'low',
    dataTypes: ['books', 'covers'], tools: ['myraa.knowledge.book_lookup'],
    healthCheck: 'GET /search.json?q=test',
    status: 'candidate', priority: 'P2', myraaUse: 'Study Mode + knowledge lookup',
  },
  {
    id: 'wikipedia-rest', name: 'Wikipedia REST', provider: 'Wikimedia', category: 'Knowledge',
    description: 'Already used by MYRAA deep research (DuckDuckGo + Wikipedia). Canonicalize here.',
    baseUrl: 'https://en.wikipedia.org/api/rest_v1', authentication: 'none',
    freeTier: 'Verify — no key (respect UA policy)', rateLimits: 'Verify', privacyLevel: 'low',
    dataTypes: ['encyclopedia'], tools: ['myraa.web.search', 'myraa.knowledge.summarize'],
    healthCheck: 'GET /page/summary/India',
    status: 'available', priority: 'P0', myraaUse: 'Deep research synthesis (existing, keep)',
    notes: 'Existing: apex deep research already calls Wikipedia + DuckDuckGo. Do not duplicate.',
  },
  {
    id: 'gmail-api', name: 'Gmail API', provider: 'Google', category: 'Productivity',
    description: 'Existing MYRAA plugin tile infra REAL / API MOCK. Needs OAuth2 + reqwest.',
    baseUrl: 'https://gmail.googleapis.com', authentication: 'oauth', requiredScopes: ['gmail.readonly', 'gmail.send (only with confirm)'],
    freeTier: '— (user OAuth quota)', rateLimits: 'Per-user quota (verify)', privacyLevel: 'high',
    dataTypes: ['emails'], tools: ['myraa.gmail.search', 'myraa.gmail.send'],
    webhooks: ['gmail.message'], healthCheck: 'vault has gmail_token + GET profile',
    status: 'candidate', priority: 'P0', myraaUse: 'Find resume / compose email with confirmation',
  },
  {
    id: 'google-calendar', name: 'Google Calendar', provider: 'Google', category: 'Productivity',
    description: 'Planned reminders/calendar/briefing. Needs OAuth.',
    baseUrl: 'https://www.googleapis.com/calendar/v3', authentication: 'oauth',
    freeTier: '—', rateLimits: 'Per-user quota', privacyLevel: 'high',
    dataTypes: ['events'], tools: ['myraa.calendar.get_events', 'myraa.calendar.create_event'],
    webhooks: ['calendar.event'], healthCheck: 'vault has google_token + GET calendarList',
    status: 'candidate', priority: 'P0', myraaUse: '"Myraa, check my calendar" + daily briefing',
  },
  {
    id: 'google-drive', name: 'Google Drive', provider: 'Google', category: 'Productivity',
    description: 'File search for "find everything related to X" universal search.',
    baseUrl: 'https://www.googleapis.com/drive/v3', authentication: 'oauth',
    freeTier: '—', rateLimits: 'Per-user quota', privacyLevel: 'high',
    dataTypes: ['files'], tools: ['myraa.drive.search'],
    healthCheck: 'vault has google_token + GET about',
    status: 'candidate', priority: 'P1', myraaUse: 'Universal search across Drive + local files',
  },
  {
    id: 'rss-generic', name: 'Generic RSS / Atom', provider: 'Open web', category: 'News',
    description: 'No-key news via publisher RSS. Avoid news-API key sprawl until needed.',
    baseUrl: 'varies (publisher feed URL)', authentication: 'none',
    freeTier: 'Verify per publisher', rateLimits: 'Polite polling + cache', privacyLevel: 'low',
    dataTypes: ['news items'], tools: ['myraa.news.search'],
    healthCheck: 'Fetch + parse feed, honor ETag/Last-Modified',
    status: 'connected', priority: 'P1', myraaUse: '"Search today tech news" without API key',
    notes: 'Verified 2026-09-08 via myraa_news_connector.cjs. Curated feeds: BBC, Ars, Verge, NPR, Wired, TechCrunch, Hindu. Reuters feed DNS-dead, removed. STT=no-key.',
  },
];

export function getProvider(id: string): ApiProviderEntry | undefined {
  return API_REGISTRY.find((p) => p.id === id);
}
