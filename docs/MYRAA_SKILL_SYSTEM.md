# MYRAA Skill System (runner + registry)

Status: **partial** — bounded execution implemented, lifecycle not.

- Registry: `resources/app/dist/skill_registry.cjs` → `/api/skills-v2` (717 catalogued / 715 verified SKILL.md; live 695 ingested).
- Runner: `resources/app/dist/skill_runner.cjs` → `/api/skills-runner` (this slice).
- Tests: `tests/test_skill_runner.cjs` (17 checks, real script execution + real approval decision).

## Truth contract

A manifest's hardcoded `"status": "ACTIVE"` is **never trusted**. The runner recomputes status from:
1. SKILL.md present on disk
2. Valid manifest (name, version, description)
3. Real runnable script in `scripts/`
4. Tool bindings available on this host
5. Recomputed risk from `tools_required`

`VALIDATION_FAILED` / `PARTIAL` / `AVAILABLE` replace the fake label.

## What is executable

Skills with a runnable script in `scripts/` (`.py`, `.js`, `.cjs`, `.mjs`, `.ps1`, `.sh`). Live: 44 skills have `scripts/`, 108 runnable files exist. Instruction-only skills return `NOT_EXECUTABLE` (`NOT_IMPLEMENTED`) — MYRAA does not pretend a prompt is a program.

## Sandbox rules

- Allowlisted interpreters only: `node` (process.execPath), `python`/`python3`, `powershell`/`pwsh`, `bash`/`sh`.
- `spawnSync` with argument arrays — **no shell**, so user args cannot inject commands.
- Environment sanitised: every variable matching token/key/secret/password/credential/auth is removed.
- cwd is the skill directory; script path must remain inside it (path traversal rejected).
- Timeout default 30 s, hard cap 300 s; output capped at 8 KB.
- stdout/stderr redacted for `api_key=...`, `token=...`, `password=...` etc.
- Append-only receipt JSON under `<MYRAA_DATA_DIR>/skill-runner/receipts/`.

## Approval gate

Tools mapped to HIGH risk (`terminal`, `shell`, `execute`, filesystem write/delete, `network`, `browser`, `git:push`, `publish`, `email`) cannot run directly:
1. First `execute` creates a real binding via `approval_manager.request` and returns `APPROVAL_REQUIRED` + `bindingId`.
2. The binding must be approved through the existing `/api/approvals/decide` flow.
3. Re-run `execute` with `approvalBindingId` — the runner verifies binding status is `approved`/`executed` before running.

MEDIUM/LOW tools run without a gate. This reuses the real broker, not a fake flag.

## Routes

| Route | Purpose |
|---|---|
| `GET /api/skills-runner/status` | discovery/executable/receipt counts, risk policy, guarantees |
| `GET /api/skills-runner/catalog?executable=true` | real executable skill list |
| `POST /api/skills-runner/validate` | `{skillId}` or `{skillPath}` → recomputed status, risk, tools |
| `POST /api/skills-runner/execute` | `{skillId|skillPath, script, args, timeoutMs, approvalBindingId}` |
| `POST /api/skills-runner/rollback` | runs `scripts/rollback.*` only when declared; else `NOT_IMPLEMENTED` |
| `GET /api/skills-runner/receipts` | receipt index |

## Remaining gaps (NOT_IMPLEMENTED, with dependencies)

- install / update / remove lifecycle (needs signature verification + dependency resolver)
- per-skill declarative self-test (needs manifest schema extension)
- execution for instruction-only skills (needs an explicit model-backed adapter contract)
- rollback for skills without a rollback script
- skill receipts wired into Activity Center UI
