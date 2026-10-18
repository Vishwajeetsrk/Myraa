# MYRAA Agent Workspace (Phase 18)

Durable agent roster, threads, natural-language routines and approval cards.
Pattern-level adoption: OpenMausBot is Apache-2.0 and NO code was copied; its
documented durable-agent model (identity, memory, routines, approvals,
inspection) informed this original implementation. Attribution:
concepts referenced from milind-soni/OpenMausBot (Apache-2.0).

## Storage
- Env `MYRAA_WORKSPACE_DB` overrides the store path.
- Default: `%APPDATA%\MYRAA\workspace\agent_workspace.json` (atomic writes).

## Roster
- `createAgent({name (one word), role, skills[]})` - cap 50, unique names.
- Status: active | paused | retired. Jobs list per agent for later phases.

## Threads
- Workspaces: general | coding | research | business | course_studio | projects.
- Each thread keeps its own bounded message tail (200/approvals 5), so a
  thread's context stays small enough to reuse without dumping history.

## Routines (natural language -> store-only for now)
- Voice: "every weekday at 8:30 check my project status and summarize blockers"
- Kinds: daily | weekdays | weekly <weekday>. (Weekly defaults to monday when
  only "every week" is said - stated in docs, never guessed silently.)
- Statuses: active | paused | done. "dueRoutines(now, executor)" is the ONLY
  firing gate: without an executor it honestly reports "no executor wired"
  and rests; nothing runs silently. Server-tick wiring is the next drop.
- Voice: "my routines", "pause routine <name>", "resume routine <name>".

## Approval cards
- Scopes: READ | PLAN | PREPARE | EXECUTE (OpenMausBot's inspection model).
- Created by flows that need user ok (server flows wire these next); pending
  cards expire after 24h and are reported honestly as expired.
- Voice: "pending approvals" lists; "approve it" / "deny it" decide (the
  summary is always named in the reply so you know what you decided).

## Honesty rules
- Routines never fire on their own in this drop.
- Approvals never auto-execute actions; they only record decisions.
- All lists bounded; store corrupt/missing degrades to fresh store.

## Next phases
- Wire a server tick to dueRoutines() and add report-thread routing.
- Connector approvals for skills_mcp_engine tool calls (Phase 19 tie-in).
