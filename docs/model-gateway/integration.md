# MYRAA Model Gateway (Phase 20) - Integration Notes

Source of patterns: dsh-our-free-model (github.com/Ebony-Vinyl/dsh-our-free-model, MIT) - the
lane/provider abstraction, real machine probes (never assumed availability), free-model support,
and OpenAI-compatible re-export are re-derived concepts. **Deliberately NOT provided:** dsh's
resold/commercial-channel subscriber lanes. MYRAA policy: owned keys (env-only), free tiers, and
local runtimes only.

## What was built

`dist/model_gateway.cjs` - 4 lanes, declarative:

| id | host | key | probing | notes |
|----|------|-----|---------|-------|
| openrouter_free | openrouter.ai | OPENROUTER_API_KEY (env) | GET /api/v1/models | free-tier models only (`:free` ids live in connector_market's openrouter_models) |
| ollama_local | 127.0.0.1:11434 | none | GET /api/tags (lists installed models) | offline lane; ollama chat style body |
| openai_owned | api.openai.com | OPENAI_API_KEY (env) | GET /v1/models | owned key only |
| groq_owned | api.groq.com | GROQ_API_KEY (env) | GET /openai/v1/models | owned key only |

Routing: fallback chains, deterministic.
- default chain: openrouter_free -> ollama_local -> openai_owned -> groq_owned
- offline-first: ollama_local -> openrouter_free -> openai_owned -> groq_owned
- lane override pin: pass `lane: '<id>'` for a single lane.
- every failed hop is recorded in `attempts[]` with a code; the final result only
  asserts what was actually observed (AUTH_REQUIRED / REMOTE_ERROR / WORKER_OFFLINE / OK).

## Honesty + safety rules

- HOST allowlist per lane (`validateLaneHost`) - lane misuse cannot hit arbitrary hosts.
- Keys from `process.env` only; never stored, never persisted, never logged.
- "Token saver" (dsh pattern): history capped to last 10 messages, 2000 chars each;
  reply text capped at 4000 chars.
- Health probes are REAL network/machine tests, cached 60 s (`clearProbeCache()` for tests);
  lanes report ONLINE / DEGRADED / OFFLINE / AUTH_REQUIRED.

## Mounts

- agi tool_execution_engine: `gateway_chat` + `gateway_probe` (risk LOW, category gateway).
- HTTP: `/api/model-gateway` (status), `/probe`, `POST /chat`.
- server.cjs boot block sits right after the Phase 19 connector mount.

## Voice phrases (Phase 20 intents, in coding_orchestrator)

- "model gateway status" / "is ollama running" / "which lanes can I chat on" -> gateway_status
- "via ollama what is the capital of France" -> gateway_chat (offline lane)
- "through openrouter write a haiku about rain" -> gateway_chat (free tier)
- (groq/openai held for the user's own keys.)

## Test

`node tests/test_model_gateway.cjs` - 34 checks, zero live network
(env keys stripped for the run; ollama/url validators, chain fallback, token-saver caps,
probe states, agi registration). Operator note: free-model discovery can join
connector_market's `openrouter_models` connector output into lane-aware selection later.
