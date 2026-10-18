# MYRAA Evidence Engine (Phase 16)

Universal investigation record shared by reverse-engineering, debugging,
web research and screen understanding. Everything is a bounded, hash-backed
record - never prose-only claims.

## License posture
Inspired by the REA project's *concept* (evidence-based reverse engineering).
REA's license is UNVERIFIED, so NO code or assets were copied. This module
is an original implementation; REA remains a design reference only.

## Honesty rules (validated by tests)
- `kind=observed` findings require at least one evidence record.
- `kind=inferred` findings require a confidence number in [0,1].
- Evidence is always hashed (SHA-256); raw values are truncated at 400 chars.
- All list endpoints are capped. `analyze_artifact` never executes the target;
  target content is treated as untrusted data.
- Store persists to one JSON file (atomic rename); corrupt/missing store
  degrades to a fresh store - never a crash.

## Storage
- Env `MYRAA_EVIDENCE_DB` overrides the store path.
- Default: `%APPDATA%\MYRAA\evidence\evidence_store.json`
  (or `$MYRAA_DATA_DIR/evidence/...` if set).

## HTTP endpoints (all bounded)
- `POST /api/evidence/session` `{label, subject}`
- `GET  /api/evidence/sessions[?limit=]`
- `POST /api/evidence/finding` `{sessionId, kind, inference, confidence?, sourceTool, evidence?[]}`
- `GET  /api/evidence/findings?session=<id>[&limit=]`
- `POST /api/evidence/evidence` `{findingId, kind, value, provenance}`
- `GET  /api/evidence/evidence?finding=<id>`
- `POST /api/evidence/unknowns` `{sessionId, question, attemptedTools[]}`
- `POST /api/evidence/unknowns/resolve` `{resolution}`
- `GET  /api/evidence/unknowns?session=<id>&open=1`
- `POST /api/evidence/compare` `{a, b}`
- `GET  /api/evidence/status`

## Voice intents (Phase 16)
- "analyze the c:\\path\\app.exe" -> opens an investigation session, seeds the
  standard unknowns, returns a tool plan by file type (PE/ASAR/APK/generic).
- "compare the two builds" -> diffs the last two investigation sessions
  (shared / new / disappeared findings).
- "what have we learned" -> store counts and last session.

## Next phases (not in this drop)
- Phase 17 investigation skills on top: investigate_feature, compare_versions,
  trace_crash, verify_reconstruction + real local decoders (strings/imports/
  ASAR catalog) wired into evidence recording.
- Kaggle-compute path for heavy pseudocode extraction stays OFF unless the
  compute gate is explicitly enabled.
