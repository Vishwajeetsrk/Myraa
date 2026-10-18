# MYRAA Investigation Skills (Phase 17)

Voice-driven feature investigation on top of the Phase 16 Evidence Engine.
No code copied from REA (license unverified) - original implementation of the
same capability shape: evidence-based answers instead of prose guesses.

## Skills (SKILL_CATALOG)
- investigate_feature - find where a feature is implemented in a local source
  tree (text scan of source files; skips node_modules/.git; bounded at 400
  files, 40 hits) and record line-level evidence.
- compare_versions - diff two artifact investigation sessions
  (Phase 16 compareSessions; inference + evidence-hash keyed).
- trace_crash - strings-scan crash dumps/logs for stack-like signatures;
  records what was observed and records what needs a debugger as unknowns.
- verify_reconstruction - compare original vs rebuilt artifact via SHA-256
  identity + printable-string set overlap (Jaccard) with confidence tiers.

## Voice phrases
- "where is login implemented"
- "find where token refresh is implemented"
- "how does myraa implement autoplay"
- "analyze the crash dump at c:\\path\\app.1.5.0.dmp"
- "does my rewrite c:\\new\\app.js match c:\\old\\app.js"

## Honesty rules
- Targets are NEVER executed: only hashed (streaming, capped 64MB) and
  string-scanned.
- Every observed finding carries file:line evidence with provenance.
- Crash scan explicitly reports that call stacks need a debugger/minidump
  provider; it records that as an unknown instead of guessing.
- All outputs are bounded; big archives/errors degrade to clean failures.

## Decoders included (local, no external daemons)
- PE header peek (machine, sections, link timestamp, optional-header magic)
- ASAR catalog read (Electron archives, bounded 2000 entries)
- ZIP/APK central-directory listing (bounded 500 entries)
- SQLite header peek (page size, journal versions, text encoding)
- Printable-string extraction (ASCII runs >= 4)

## Next phases
- Provider router for real decoders if/when Ghidra/Rizin/objdump are installed
  (declared as unknowns until then - never faked).
- Phase 18: agent roster + routines + approval cards (OpenMausBot patterns,
  Apache-2.0 attribution).
