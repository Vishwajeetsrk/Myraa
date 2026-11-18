# Phase 2 design — one real capability registry (extend, do not duplicate)

Decision: extend the existing `resources/app/dist/agi/capability_registry.cjs` (already exported via
`agi/index.cjs` and persisted to `capability_registry.json`) instead of introducing a second registry.

## Current state (verified by code inspection)

- `agi/capability_registry.cjs`: engine descriptors with `id/name/category/version/description/capabilities/dependencies/entryPoint/healthCheck/riskLevel/enabled/lastHealth`; APIs `register`, `registerAll`, `get`, `listAll`, `listByCategory`, `search`, `checkDependencies`, `checkEngineHealth`, `healthSummary`, `createRouter`, `load/saveRegistry`.
- `agi/index.cjs:38,67-77,108` loads it, registers only one engine (`autonomous_decision_engine`), mounts it at `/api/agi/capabilities`, but `agi/index.cjs` itself is **never mounted** by `server.cjs`.
- `apex_v5_routes.cjs:2478` `GET /api/capabilities` returns a **hardcoded 20+ record list** with `last_tested: now` and `last_success: now` on every row — fake provenance; must be replaced by registry-derived records.
- `myraa_v6_real_routes.cjs:2544` `/api/capabilities/status` mixes real probes with `ACTIVE`/`NOT_CONFIGURED` labels; keep its real probes, remove decorative flags.
- `myraa_v6_real_routes.cjs:1077-1089` `/api/agent-health` is always `online:true` and shadows the real probe at `server.cjs:5977` — must be removed or corrected.

## Extension shape (additive fields on each descriptor)

```
authenticated: boolean | null   // null = not applicable / not tested
available: boolean
healthy: boolean
local: boolean
requiresNetwork: boolean
requiresPermission: boolean
permissions: string[]
tools: string[]
skills: string[]
providers: string[]
actions: string[]
lastChecked: string | null      // real timestamp from a real check
lastUsed: string | null
error: string | null
status: UNAVAILABLE|NOT_CONFIGURED|DISCONNECTED|AUTH_REQUIRED|CONNECTING|
        CONNECTED|DEGRADED|ERROR|READY|RUNNING|PAUSED|DISABLED
statusSource: oauth|health_check|runtime|model_probe|websocket|database|local_process
latencyMs: number | null        // null when no request was actually timed
```

Rules:
- No field may be inferred from a constant; if a check was not run, `lastChecked = null`, `latencyMs = null`, `status = NOT_CONFIGURED` or `UNAVAILABLE`.
- Counts shown in UI (`skills`, `connectors`, `providers`, `MCP servers`) must be computed from live registries, never hardcoded.
- Real health checks only: bound each with a timeout, record actual duration, record real errors.
- Never store or expose API keys in descriptors or responses — only `Configured / •••• / last verified` style metadata.

## Wiring plan

1. Extend descriptor shape + `publicView()` in `agi/capability_registry.cjs` (backwards compatible).
2. Add a bootstrap that registers real subsystems found in Phase 1 (backend, memory, MCP, connectors, skills, plugins, voice, screen, desktop, browser, providers) with honest initial states, then refresh via real checks.
3. Replace the hardcoded `/api/capabilities` handler with registry-derived data; keep a compatibility alias if needed.
4. Remove/fix the always-online `/api/agent-health` duplicate.
5. Add a single `/api/capabilities/summary` endpoint that returns counts derived from registry records.
6. Tests: registry fields, status enum, no fake latency, source-bounded counts, health-check timeout behaviour.

Avatar, voice identity, existing tools, and all working capabilities stay untouched.
