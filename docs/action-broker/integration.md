# Action Safety Broker (Phase 21)

High-risk tool calls now route through approval cards before anything runs.

## Model

The `agi/tool_execution_engine.cjs` risk gate already refuses HIGH/CRITICAL
tools unless called with `{ confirm: true }`. The safety broker makes that
confirmation REAL and user-visible:

1. `requestApproval({ tool, params, reason, risk })` creates a binding and a
   workspace approval card (scope EXECUTE, 24h expiry enforced by Phase 18
   workspace).
2. The user sees the card via the existing approvals voice/UI surface.
3. `syncWithWorkspace()` mirrors card decisions onto bindings
   (waiting -> approved / denied / expired).
4. `executeBinding(id)` runs the tool exactly once through the tool engine
   with `{ confirm: true, context: { brokerBinding } }` - only when approved.
5. `executeApproved()` syncs then sweeps every approved binding (used by the
   "sync the broker" voice intent and the auto-hook after "approve ...").

## Safety rules

- Nothing executes without an approve decision; deny and expiry close the
  binding with zero executions.
- Execution failures keep the binding in `approved` state (retryable) with
  `lastError` recorded and one bounded attempt counted per try.
- Params are only ever shown as a clamped summary; secret-ish keys
  (key|token|secret|password|credential|apikey) render as `[redacted]`.
- Journal per binding is bounded (12 entries); store is capped (100 bindings,
  terminal entries pruned first) and garbage-collects after 7 days.

## Voice commands

- "safety broker status" / "show pending actions" -> bindings + counts.
- "approve ..." / "deny ..." -> decides the matching card, and the broker
  auto-executes on approve.
- "sync the broker" / "refresh approvals" -> sync + run approved actions.

## HTTP

None. Phase 21 is orchestrator-level only; the workspace router and the
approvals surface already expose the cards.

## Env

- `MYRAA_BROKER_DB` - override store path (default
  `%APPDATA%\MYRAA\agent_broker\broker_state.json`).

## Attribution

Pattern-level adoption of OpenMausBot's permission-broker concept
(Apache-2.0). No third-party code was copied; only the documented model
(request -> human decision -> bounded execution) informed this design.

## Files

- `resources/app/dist/safety_broker.cjs`
- `tests/test_safety_broker.cjs`
- patched `resources/app/dist/coding_orchestrator.cjs` (intents, cases,
  handlers, approvals_decide hook, `_requireModule` helper fix)

## Rollback

Copy `coding_orchestrator.cjs.bak_phase21_*` back, delete
`resources/app/dist/safety_broker.cjs`, `tests/test_safety_broker.cjs` and
`docs/action-broker/`.
