# MYRAA Connector Marketplace (Phase 19) - Integration Notes

Source of patterns: rakazo (github.com/elie222/rakazo) - **license unverified at adoption time:
PATTERN-LEVEL ONLY, ZERO CODE COPIED.** The connector catalog name-id-action-host-auth shape is a
re-derivation, not a port. If you audit rakazo's license later, keep it that way.

## What was built

`dist/connector_market.cjs` - 8 named connectors, declarative catalog:

| id | category | auth | actions | host |
|----|----------|------|---------|------|
| wikipedia | knowledge | none | search | en.wikipedia.org |
| hn_search | news | none | search | hn.algolia.com |
| dictionary_api | language | none | define | api.dictionaryapi.dev |
| exchange_rates | finance | none | rates | api.frankfurter.app |
| crypto_price | finance | none | price | api.coingecko.com |
| github_trending | developer | none | trending | api.github.com |
| openweather | weather | OPENWEATHER_API_KEY (env) | current | api.openweathermap.org |
| openrouter_models | models | none | list_free_models | openrouter.ai |

## Safety / honesty rules

- **HOST allowlist per connector**: the request URL host must be in the connector's allowlist or the
  call is refused (a connector cannot be driven to arbitrary hosts - no SSRF).
- **No secrets stored**: keyed connectors read `process.env` only and report `AUTH_REQUIRED` when
  absent. Never laminate, log, or persist the key material.
- **Action + required-params validation happens BEFORE any network I/O** (the "must not be called"
  fetch-stub test proves pre-network refusal).
- Offline or transport failure => `WORKER_OFFLINE` with reason; 5xx => `REMOTE_ERROR` with sliced body.
  Never assert an outcome that was not observed.
- Reply bodies bounded (`RES_BODY_CAP` = 2400 chars) and summarized per connector.

## Mounts

- **agi tool_execution_engine** (singleton at `dist/agi/tool_execution_engine.cjs`): every connector
  action registers as `connector_<id>_<action>` at risk LOW, category `connector`, timeout 12s, at
  boot from `server.cjs` (mounted right after the Phase 16 evidence routes block).
- **HTTP**: `/api/connector-market` (status), `/api/connector-market/list`, `/api/connector-market/search?q=<need>`.
- **Provider note**: `openrouter_models` is a declared input to the planned Phase 20 model gateway
  (free-model discovery), wired to the same gateway lane decision made for dsh: owned keys, free
  tiers, and local runtimes only - no resold-commercial-channel subscribers.

## Voice phrases (via coding_orchestrator Phase 19 intents)

- "what connectors do we have" / "which online sources do you have" -> connector_list
- "find a connector for weather" / "connector about crypto prices" -> connector_search_find
- "use the wikipedia connector to search Nikola Tesla" -> connector_invoke
- "fetch Nikola Tesla from wikipedia" | "define serendipity via dictionary connector" |
  "price of bitcoin" | "weather in Austin" -> connector_invoke

## Test

`node tests/test_connector_market.cjs` from the repo root: 26 checks, zero live network
(fetch is stubbed everywhere, including a doctored-allowlist refused test and an
AUTH_REQUIRED test with the env var deleted).

OpenCloud note for the future: add OpenAPI-exported connectors by writing a declarative entry +
`buildUrl` recipe + progressive `summarize` case - code, not downloads.
