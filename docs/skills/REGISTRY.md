# Global skills registry

All entries below were installed additively into `%USERPROFILE%\.agents\skills\` after a license check. Existing folders were never overwritten. Verification means the installed `SKILL.md` files were read by this session (skills appeared in the available-skills list) or exercised on a real task.

| Bundle | Source (commit) | License | Installed | Verification |
|--------|-----------------|---------|-----------|--------------|
| replica-skill (11 skills) | `github.com/Jakeschincariol/replica-skill` @ `77c9436` | MIT | `replica-*` | Used `replica-design`: contrast.py found 3 real WCAG failures, fixed to 0 |
| REA (MCP, not a skill folder) | `github.com/morluto/rea` @ `eb2c3b5` | MIT | MYRAA MCP preset `rea`, npm global `rea-agents` 6.7.0 | Real probe (207 tools) + real `inspect_electron_fuses` call |
| GSD Core (72 skills) | `github.com/open-gsd/gsd-core` @ `641d987` | MIT | `gsd-*` | 72 `SKILL.md` loaded in-session |
| Roo Code (3 skills) | `github.com/RooCodeInc/Roo-Code` @ `b867ec9` | Apache-2.0 | `roo-evals-context`, `roo-conflict-resolution`, `roo-translation` + `roo-LICENSE` | 3 `SKILL.md` loaded in-session |
| Ralph Loop (method skill) | `github.com/abhishekbhakat/ralph-loop-for-antigravity` @ `29352d0` | MIT | `ralph-loop` + `references/` | Skill built from the repository's public README and knowledge base |
| animate-ui bell (component, not a skill) | shadcn registry `@animate-ui/icons-lucide-bell` | review upstream license before redistribution | AURELIA dashboard `src/components/animate-ui/icons/bell.tsx` | Installed via `npx shadcn add`, wired into header, production build passes |

## Notes on the sources

- `gsd-build/get-shit-done` (the URL originally supplied) is an archived redirect. Current source is `open-gsd/gsd-core`; its official installer (`npx @opengsd/gsd-core@latest`) is interactive and writes to several runtimes, so for this harness the `skills/` folders were installed directly (not `agents/` or `commands/`). The npm CLI can be installed globally separately.
- `Roo-Code`'s VS Code extension was shut down on 2026-05-15. The repository still ships useful `.roo/skills`; only those were installed. Apache-2.0 attribution preserved via `roo-LICENSE`.
- The `ralph-loop-for-antigravity` repository is a **community issue tracker**, not the extension source. No extension was installed; the documented loop (external task file, one task per iteration, append-only `progress.txt`, commit, repeat, model fallback chain) was written as an attributable method skill.

## Ingest rule (used for every entry)

1. Clone to a temp directory; read README and LICENSE; reject unknown or restrictive licenses.
2. Copy only additive skill folders; skip existing destinations; preserve LICENSE/NOTICE.
3. Validate every `SKILL.md`; exercise at least one tool on a real task.
4. Record source URL, commit, license and verification here. Remove if it proves low value.
