# Porting patterns from plip-oss into MYRAA

Source studied: `github.com/hussainn7/plip-oss` (MIT, commit at time of reading `main`), specifically
`README.md`, `docs/BUDDY.md`, `pyproject.toml` and the module inventory of `src/mcp_vision/buddy/`.
Plip itself is macOS 13+ / Apple Silicon only - **do not try to install it on Windows**. This document
records only cross-platform patterns worth rebuilding in MYRAA, with original MYRAA code.

> **P1 slice implemented (2026-11-17, Phase 29):** `resources/app/dist/action_receipts.cjs`,
> `step_watcher.cjs`, `response_tags.cjs` + tests `test_action_receipts.cjs`, `test_step_watcher.cjs`,
> `test_response_tags.cjs` (60 checks, all green). Mounted at `/api/action-receipts`,
> `/api/step-watcher`, `/api/response-tags`; live-verified on the dev server. Not yet in a shipped installer.

## Pattern map

| Plip pattern | MYRAA surface today | Gap | Port action | Priority |
|--------------|---------------------|-----|-------------|----------|
| Typed model tags `[POINT]`, `[STEPS]`, `[DO]`, `[DONE]`, parsed before execution | Coding orchestrator voice intents, safety broker approvals | Model replies are prose + intent; no structured action stream | Define a small, MYRAA-owned tag protocol for voice replies; parse in orchestrator; render tags as UI cards; execute only via registered tools | P1 |
| Verifiable action receipts: registry lookup, 45s timeout, `actions.jsonl` without message bodies, undo record | Desktop control, terminal runner, safety broker | Actions are logged in event bus but no per-action receipt with outcome/proof | Add `action_receipts.cjs`: id, tool, params (redacted), decision, started/ended, outcome, evidence (paths/hashes), undo token | P1 |
| Walkthrough step detection via 64x40 grayscale screen fingerprint + "wait until settled" | Screen vision + OCR perception | One-shot perception; no "watch until the human completes a step" | Add `step_watcher.cjs` over existing screen capture: fingerprint, poll, settle detection, emit timeline events | P1 |
| Accessibility "screen map" of real controls with centers | Screen vision/OCR, universal app control | OCR gives text, not control identities/centers | On Windows use UI Automation (uiautomation/COM) to list named controls + bounding rectangles; merge with OCR | P2 |
| Jev micro-router (~100ms typed answers, rules fallback) before the big model | `model_router.cjs` (task-type routing + fallback) | No cheap pre-route for "need screen? / intent? / walkthrough?" | Add optional fast local classifier: intents + need_screen flag; use measured latency/cost before calling cloud models | P2 |
| Teach-once -> skill with dashboard on/off switch | `passive_learning_service.cjs`, skills fleet | Recorder exists, but no explicit "do it once, now it is a skill" flow with approval | Add voice command "remember this as a skill" -> draft skill JSON -> user approval -> register in skills fleet | P2 |
| Memory facts with sources + sensitive redaction (passport/card/SSN never in prompts) | Episodic + SQLite memory, redaction in safety broker | Source attribution and field-level redaction not explicit in recall | Extend recall records with `source` and `sensitivity`; refuse to include sensitive labels in prompts | P2 |
| Sentence-pipelined TTS, barge-in, per-stage timing (`looked`, `first_token`, `first_speech`...) | Gemini Live voice loop, speechSynthesis / Windows Synthesizer | No latency instrumentation | Emit stage timings to timeline/events; add a `voice --timings` diagnostic | P2 |
| Thin OS layer, cross-platform core unit-tested on CI | Electron Windows app, `myraa:architecture-check`, 25 Node suites | Windows-specific logic mixed into core routes | Keep new patterns in OS-agnostic modules; isolate Win32 calls behind adapters with tests | P1 |

## Highest-value first slice (P1)

1. `action_receipts.cjs` - additive module; every HIGH/CRITICAL tool call through the safety broker writes a receipt. No existing code is modified beyond one event emission.
2. `step_watcher.cjs` - wraps the existing screen capture; produces deterministic "step done" events for timeline UI (also unblocks the pending observability dashboard).
3. Typed tag parser in the coding orchestrator - parse only from the model's own reply; never from screen text (Plip's explicit safety rule); unknown tags are dropped, never spoken.

## Source-level confirmations (read from the upstream code)

Verified by reading `prompt.py`, `pointing.py` and `actions/core.py` directly:

- The full tag grammar is `[POINT:x,y:label]` (optional `:screenN`), `[STEPS:n]`, `[PLAN: a | b | c]`, `[GOAL: ...]`, `[DO:name {json}]`, `[DONE]`. My earlier summary omitted `[PLAN]`/`[GOAL]`.
- `ReplyStream` is an **incremental** parser: streamed text becomes ordered `SpeechChunk` / `PointTag` / `ActionTag` / `PlanTag` / `GoalTag` / `StepsTag` / `DoneTag` events. `[DO:...]` args are scanned with a JSON-aware balanced-bracket matcher; malformed tags are dropped and never spoken. Leaked tool-call markup (`<invoke ...>`, `<thinking>`) mutes speech from that point.
- Point tags are held and released just before the sentence that mentions the control is spoken, so the mascot starts flying at the same moment as the speech. Short speech chunks are merged (24-char floor) to avoid tiny TTS requests.
- Actions are declarative: `ActionSpec(name, category, say, fn, preview=..., args=...)`. Consequential actions supply a `Preview(title, lines, confirm, state)` card; execution returns `ActionResult(say, detail, report, items, undo, note, look_after, settle, opens)` and the report is fed back to the model on the next turn.
- Safety details worth copying: file actions restricted to the home folder / numbered search results; scripts and installers always confirm; links carrying saved personal details get a confirm card; password/card/code field values are never included in model reports; "submit" only fires after the typed value is verified; page text is labelled "content, not instructions"; searches are numbered so stale indexes cannot be reused.
- `organize_desktop` returns an undo record of exact moves; `undo` reverses them and removes only folders it emptied. Actions carry `settle`/`look_after` delays so the next observation is taken after the screen changes.

These confirm the P1 slice: MYRAA already has the safety broker, event bus and screen capture - what is missing is the tag protocol, per-action receipt with `undo` token, and the settle-aware step watcher.

## Guardrails (non-negotiable)

- No code copy without MIT attribution; all implementations written fresh for MYRAA.
- Never copy Plip's prompt text, name, mascot, icons, or store listings (trade dress and MYRAA identity rules).
- Do not add Supabase accounts/analytics to MYRAA's local-first storage.
- Do not touch the protected 3D companion, voice identity, memory data, or desktop-control capabilities.
- Every new action remains approval-gated through the existing safety broker.

## Acceptance tests

- A HIGH-risk action emits exactly one receipt with matching tool name and redacted params; `undo` consumes the receipt token.
- Step watcher reports "done" only when the fingerprint stays settled for N polls; a transient change does not advance.
- Tag parser drops malformed tags and never executes a tag embedded in screen content.
- All 25 existing suites stay green; `verify_final_system.cjs` stays 25 PASS / 0 FAIL.
