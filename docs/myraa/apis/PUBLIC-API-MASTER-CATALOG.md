# MYRAA — Public API Master Catalog (Discovery Only)

> Source: `public-apis/public-apis` (community catalog, ~40 categories).
> Rule: catalog → discovery → review → connector. NEVER auto-install, NEVER runtime dependency.
> NEVER claim "free" unless verified. Default `freeTier: "Verify"`.

## How to use this file
1. Find category → candidate API.
2. Run pipeline: category → capability → auth → terms/license → rate limit → privacy → reliability → free-tier → security → Myraa use-case → priority score (§5).
3. Only P0/P1 with PASS security review become connector candidates in `packages/api-registry/registry.ts`.

## Curated candidates (v1 — safe, no-key first)

| API | Category | Myraa Use | Auth | Free | Priority | Connector |
|-----|----------|-----------|------|------|----------|-----------|
| Open-Meteo | Weather | Voice weather + forecast | none | Verify | P0 | weather |
| Frankfurter | Finance | FX conversion (read-only) | none | Verify | P1 | currency |
| Nager.Date | Productivity | Holidays for briefing | none | Verify | P1 | calendar-holidays |
| Wikipedia REST | Knowledge | Deep research (existing) | none | Verify | P0 | web-research |
| Open Library | Knowledge | Study mode book lookup | none | Verify | P2 | knowledge-books |
| Generic RSS | News | Tech news without key | none | Verify/publisher | P1 | news-rss |
| GitHub REST | Dev | Repo control (scoped) | OAuth/PAT | — | P0 | github |
| Gmail API | Productivity | Search/send (confirm) | OAuth | — | P0 | gmail |
| Google Calendar | Productivity | Events + briefing | OAuth | — | P0 | google-calendar |
| Google Drive | Productivity | Universal search | OAuth | — | P1 | google-drive |

## Explicitly deferred (need deeper review)
- Market/finance trading, payments, transactions → REQUIRE explicit permission + compliance review. Read-only info first.
- Security intel (VirusTotal, AbuseIPDB, URLScan) → useful for link safety, but treat as security-sensitive; P2 until abuse/privacy review.
- Flight/aviation, maps/geocoding → P1/P2 after ToS + quota review (no key sprawl).
- Social (Slack/Discord/Trello/Jira/Notion/Linear) → OAuth per user; P1/P2 phased after Gmail/Calendar/Drive are REAL.

## Update process (§62)
Public repo → periodic review → security+license+availability → approved candidates → connector dev. Do NOT import entire repo.
