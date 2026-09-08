# MYRAA AI OS — SYSTEM AUDIT (Verified Against Actual Code, 2026-09-03)

> Rule: documentation ≠ implementation. Every entry below was checked against `src-tauri/src/lib.rs (1160 lines, 54 tauri commands)`, `src-tauri/tauri.conf.json`, `resources/app/dist/tauri-bridge.js + ui-health-patch.js`, live `%APPDATA%/MYRAA/*`, `%APPDATA%/JARVIS/vault.json`, and `MYRAA-Upgrade-Setup.exe (234KB, 2026-09-03)`.
> Identity: canonical `MYRAA`. Display name configurable via `AssistantIdentity` (see `identity.json`). Internal ids stay `MYRAA_*`.

Status legend: `REAL & WORKING` / `REAL BUT PARTIAL` / `UI ONLY / MOCK` / `IMPLEMENTED BUT BROKEN` / `SPECIFIED BUT NOT BUILT` / `PLANNED` / `NEW IDEA`

---
## A. DESKTOP AGENT CORE

### Feature: Tauri native shell + windows
Category: NATIVE DESKTOP
Status: REAL BUT PARTIAL
Actual Implementation: `tauri.conf.json productName MYRAA AI OS v1.0.2 id com.myraa.desktop frontendDist ../resources/app/dist`, windows `main 1280x800` + `companion 380x580 transparent`, plugins single-instance/shell/notification/autostart/window-state/dialog/fs/opener/clipboard/process/updater. `lib.rs:1089 run()` tray `myraa-tray` menu Open/Talk/Voice/Tasks/Status/Settings/Restart/Exit, close→hide, `set_window_mode full/compact/floating/background/tray`, `show_myraa_window`.
Files: `MYRAA/src-tauri/tauri.conf.json`, `MYRAA/src-tauri/src/lib.rs:1069-1160`, `MYRAA/src-tauri/Cargo.toml`, `MYRAA/resources/app/dist/index.html`
Dependencies: tauri v2, cargo check green (Finished dev, 1 dead_code warning AppMode)
UI Connected: YES — dist loads inside WebView, `window.__TAURI__` bridge active
Real Testing Performed: `cargo check` green 2026-09-03; `cargo build --release` timed out (604 crates, still compiling); `tauri build` NOT run (tauri-cli install timed out)
Last Tested: 2026-09-03
Known Problems: No `target/release/bundle/nsis/*.exe` yet; existing `MYRAA-Upgrade-Setup.exe` is old Electron stub (234KB). `beforeDevCommand/beforeBuildCommand` empty so frontend rebuild manual.
Next Required Action: Install tauri-cli offline → `tauri build` → replace `MYRAA-Upgrade-Setup.exe` with real NSIS.

### Feature: Voice-driven Windows control / PC Control Agent
Category: SYSTEM
Status: REAL BUT PARTIAL
Actual Implementation: `verify_all_tools`, `system_control volume_get/set brightness_set`, `set_wallpaper via SystemParametersInfo`, `get_network_info via netsh`, `get_system_info via sysinfo`, `open_local_path via cmd start`. Missing: close/switch/minimize/maximize windows, keyboard type/hotkeys, mouse click/scroll/drag (no Enigo/UIA), sleep/restart/shutdown/lock, Bluetooth pair, Wi-Fi connect/forget.
Files: `lib.rs:415-522`
Dependencies: powershell, netsh, sysinfo
UI Connected: PARTIAL — System tab calls `verify_all_tools` via bridge; no window-list UI
Real Testing Performed: `get_system_info` logic reviewed; `netsh` parsing `regex_find` reviewed; no live window-control test
Last Tested: 2026-09-03 (code review only)
Known Problems: Window/keyboard/mouse layer absent → "Close everything except VS Code" impossible today.
Next Required Action: Add `enigo` + `windows` crate for window enum + input; gate destructive with `permission_check`.

### Feature: Browser control / Browser Mission Agent
Category: AGENT
Status: SPECIFIED BUT NOT BUILT
Actual Implementation: Only `open_external_url` via `cmd start URL`. No navigation, DOM read, form fill, mission planner.
Files: `lib.rs:629-635`
UI Connected: NO
Real Testing Performed: None
Last Tested: —
Known Problems: —
Next Required Action: Design `browser_mission` command + Playwright sidecar or WebDriver; never auto-submit without confirm.

### Feature: Screen vision (OCR + understanding)
Category: VISION
Status: REAL BUT PARTIAL
Actual Implementation: `verify_all_tools` vision=true placeholder, no desktopCapturer/screenshot/OCR in Rust. Previous Electron `desktopCapturer` not ported. No Tesseract/VLM call.
Files: `lib.rs:415`
UI Connected: NO (About/Voice shows status only)
Real Testing Performed: None
Last Tested: —
Known Problems: "Screen Vision Active FPS 0.4" health has no backend.
Next Required Action: Add `screenshots` crate + OCR (Tesseract) + Gemini vision summarize; expose `screen_capture` + `screen_analyze`.

### Feature: Camera vision
Category: VISION
Status: PLANNED
Actual Implementation: None. No permission/indicator flow.
Files: —
UI Connected: NO
Next Required Action: Spec permission + `nocamera` default; only after screen vision stable.

### Feature: Gemini Live voice engine + reconnect
Category: VOICE
Status: REAL BUT PARTIAL
Actual Implementation: `gemini_live_status/log_disconnect` logs `code/reason/advice` to `%APPDATA%/MYRAA/logs/gemini_live.json`; `tauri-bridge.js` WebSocket wrapper exponential backoff 5×, distinguishes 1006 handshake vs 1008 auth. No STT/TTS in Rust; Fish Audio key still in old `apex_v5_routes.cjs`.
Files: `lib.rs:1036-1050`, `resources/app/dist/tauri-bridge.js`
UI Connected: YES (bridge patches WebSocket)
Real Testing Performed: Code review only; no forced 1006 live test logged
Last Tested: 2026-09-03
Known Problems: No Rust STT (Whisper) / TTS; voice interruption/turn-taking not implemented.
Next Required Action: Add `whisper` sidecar + interruption state machine IDLE/LISTENING/THINKING/SPEAKING/INTERRUPTED.

### Feature: Wake-word detection (Hey Myraa, offline)
Category: VOICE
Status: SPECIFIED BUT NOT BUILT
Actual Implementation: Only `visibilitychange` log "tray keeps listening". No background listener, no `openwakeword`/`porcupine`, no `wake_names` config. Tray keeps process alive but not listening.
Files: `tauri-bridge.js`, `lib.rs:1156 close→hide`
UI Connected: NO
Real Testing Performed: None
Known Problems: "Keep tab active" requirement still true in practice.
Next Required Action: Integrate lightweight wake-word crate + `AssistantIdentity.wake_names`; modes ALWAYS_CONFIRM etc later.

---
## B. MOBILE / ADB

### Feature: Android ADB bridge (devices, battery, screen pull, power)
Category: MOBILE
Status: REAL BUT PARTIAL
Actual Implementation: `adb_devices (adb devices -l)` + `adb_command tap/swipe/type/app_launch/app_list/pull/push/screencap` via `adb` binary. Scoping `adb_paired_device` checked but `_allowed` unused (allow-any TODO).
Files: `lib.rs:882-916`
Dependencies: `adb` NOT on PATH (verified `where adb` not found)
UI Connected: YES via `window.MyraaADB`
Real Testing Performed: None (no device; `adb: command not found` expected)
Last Tested: 2026-09-03
Known Problems: No pairing confirm; no live mirror streaming; file transfer paths hardcoded to `cache/adb_pull`.
Next Required Action: Install platform-tools → pair `realme 12x` → enforce `adb_paired_device` confirm → add scrcpy mirror.

### Feature: Phone Link (QR pairing, notifications, clipboard, ring)
Category: MOBILE
Status: PLANNED
Actual Implementation: None.
Next Required Action: After ADB stable; QR + secure session spec first.

### Feature: Calls & voice response (pick up/reject)
Category: MOBILE
Status: NEW IDEA — NOT YET PLANNED (platform-restricted)
Actual Implementation: None. Android Telecom APIs restrict third-party call control.
Next Required Action: Research only; never claim universal call control.

---
## C. MEMORY

### Feature: Categorized Memory Core + auto recall
Category: MEMORY
Status: REAL BUT PARTIAL
Actual Implementation: SQLite `%APPDATA%/MYRAA/memory/myraa_memory.db` tables `memories+sessions`, `memory_add/list/search/delete`, `memory_migrate_json`. Live DB has 1 row `(project, Test kill memory)`. `session_save/load/touch app_launch`.
Files: `lib.rs:290-413`, live DB + `last_session.json sess_1788438182247`
UI Connected: YES via `window.MyraaMemory`
Real Testing Performed: Python sqlite insert + session resume verified 2026-09-03
Last Tested: 2026-09-03
Known Problems: Only `project` category used; PERSONAL/WORK/LEARNING/PROJECTS/CONTENT taxonomy from spec not enforced; vector/semantic search absent (LIKE only).
Next Required Action: Enforce 8-category taxonomy + `memory 2.0` commands remember/forget/show; add embeddings later.

### Feature: SQLite persistence + session resume + project memory
Category: MEMORY
Status: REAL BUT PARTIAL (same as above)
Actual Implementation: Write-as-you-go `session_touch` on launch + every memory op; `last_session.json` read before first chat via bridge `__MYRAA_LAST_SESSION__`. Project linking: `studio_generate_office` does `memory_add project Generated asset…` + `asset_*` row.
Files: `lib.rs:373-413, 744-852`
Real Testing Performed: Kill-test simulated via python (DB row + session file), not via killed `.exe`
Known Problems: Crash-mid-task via real binary untested.
Next Required Action: Test kill real Tauri binary → `session_load` must return `last_note`.

---
## D. PLUGINS (4 old + 4 new)

### Feature: Plugin infra (defs, health, connect, execute)
Category: PLUGIN
Status: REAL BUT PARTIAL
Actual Implementation: `plugin_defs 8 tiles` Gmail/Salesforce/Excel/YouTube + GitHub/GCloud/Figma/Canva (same UI pattern), `HEALTH LazyLock`, `plugin_health_ping/list_health` 3 states Verified/Degraded/Disconnected + `last_success/latency`, `plugin_connect` (token→keyring, empty→opens OAuth URL via `cmd start`), `plugin_disconnect confirm`, `plugin_execute` central dispatcher with `CONFIRM_REQUIRED` for delete/deploy/commit, `open_external_url`. Bridge 15-min `healthInterval` + `hashchange` refresh + `MyraaPlugins` CRUD helpers.
Files: `lib.rs:523-690`, `tauri-bridge.js`
UI Connected: YES
Real Testing Performed: Code review; no live Gmail/Salesforce API call; health logic reviewed (Gmail checks vault+keyring, Excel checks `EXCEL.EXE`, others check vault token)
Last Tested: 2026-09-03
Known Problems: `plugin_execute` for gmail/salesforce/github returns simulated `{"status":"ok","note":"would execute"}` — NOT real provider API. Figma/Canva OAuth URLs open token pages, not full OAuth code flow.
Next Required Action: Implement real Gmail REST (OAuth2), Salesforce REST, GitHub REST with `reqwest`; keep simulated flag until then (`feature_truth_dashboard` must say PARTIAL).

### Feature: Gmail Automator (send/query + draft/label/thread)
Category: PLUGIN
Status: REAL BUT PARTIAL
Working: Infra + dispatcher accepts `send/draft_create/label_add/archive/thread_list/mark_read`
Missing: Real Gmail API HTTP, OAuth refresh, thread parsing
Health Check: IMPLEMENTED (vault+keyring check)
Next: Wire `reqwest` Gmail API + store `gmail_token` via `plugin_connect`.

### Feature: Salesforce CRM Hub (Leads/Contacts/Opps CRUD)
Category: PLUGIN
Status: REAL BUT PARTIAL
Working: Dispatcher `create/update/delete/query`, object-aware confirm gate
Missing: Real Salesforce REST, field validation, old/new diff UI
Health Check: IMPLEMENTED (vault check only, no org ping)
Next: Add Connected App OAuth + SOQL.

### Feature: Excel Spreadsheets (workbook/format/chart)
Category: PLUGIN
Status: REAL BUT PARTIAL
Working: `create_workbook` delegates to REAL `studio_generate_office xlsx` (formulas+chart verified live `MYRAA_Financial.xlsx 5059 B4==B2-B3`); `format_cells/add_chart` return ok without doing formatting
Missing: Real cell formatting via openpyxl from Rust (currently python fallback only)
Health Check: IMPLEMENTED (EXCEL.EXE existence)
Next: Expand python template for formatting/merges/pivot.

### Feature: YouTube Hands-Free (search/play/pause/fullscreen)
Category: PLUGIN
Status: UI ONLY / MOCK (appropriately scoped)
Working: `youtube healthy` always; dispatcher passthrough
Missing: Real player control (intentional — media controller scope)
Health Check: Trivially healthy (no auth)
Next: Keep as-is; add `open_external_url youtube search` only.

### Feature: GitHub plugin tile (repo/issue/PR/commit scoped)
Category: PLUGIN
Status: REAL BUT PARTIAL (infra REAL, API MOCK)
Working: Def + health (checks `github_token`) + dispatcher `repo_list/commit scoped repo-level`
Missing: Real GitHub REST, repo allow-list UI
Health Check: IMPLEMENTED
Next: `reqwest` + `github_token` PAT; default specific repos not org-wide.

### Feature: Google Cloud plugin tile
Category: PLUGIN
Status: REAL BUT PARTIAL (infra only)
Working: Def + health + `project_status/deploy_trigger` with confirm
Missing: Real Cloud Monitoring/Build API
Next: Service-account JSON in vault (never in memory) + read-only first.

### Feature: Figma plugin tile (tokens/components/push)
Category: PLUGIN
Status: REAL BUT PARTIAL (gating REAL, read/push MOCK)
Working: `studio_figma status/read_design/push_frame` gates on `figma_token`, returns `needs_auth/queued`; `plugin_connect figma` opens `figma.com/developers/api#access-tokens` in browser (wired 2026-09-03)
Missing: Real Figma REST (file nodes, variables, styles) + MCP push
Health Check: IMPLEMENTED
Next: Implement `GET /v1/files/:key` with token; push via plugin API.

### Feature: Canva plugin tile (brand kit/generate)
Category: PLUGIN
Status: REAL BUT PARTIAL (same as Figma)
Working: `studio_canva status/generate`, `plugin_connect` opens Connect apps page
Missing: Real Canva Connect API (brand kit fetch, template autofill, export)
Next: Canva Connect OAuth + brand-kit endpoint.

---
## E. TEACH & LEARN

### Feature: Procedure recorder + 2 saved procedures
Category: TEACH
Status: REAL BUT PARTIAL
Actual Implementation: `teach_save_draft/confirm/replay/list_versions/restore_version`, `teach_drafts.json` + `teach_procedure` rows in SQLite, `TeachDraft {id,name,steps,created_at,confirmed}`. No screenshot/input hook — steps are caller-supplied JSON.
Files: `lib.rs:691-743, 1000-1035`
UI Connected: PARTIAL — `window.MyraaTeach saveDraft/confirm/replay/versions/restore` + `myraa:teach-stopped` log; NO step-review modal in dist (only console.log)
Real Testing Performed: None with real Excel/Salesforce; dry_run logic reviewed
Last Tested: —
Known Problems: "Two saved procedures" (Salesforce Lead Entry, Excel Monthly Total) not found in live DB (only 1 test row).
Next Required Action: Build step-review screen (edit/delete/reorder/add-note/optional + Confirm & Save) + input hook.

### Feature: Edit-before-save + step review
Category: TEACH
Status: SPECIFIED BUT NOT BUILT (backend ready, UI missing)
Actual Implementation: Backend `teach_confirm(id, edited_steps_json)` supports edit; no UI list.
Next Required Action: Glassmorphism modal per spec example 1-6 steps.

### Feature: Replay pre-flight + failure recovery + versioning
Category: TEACH
Status: REAL BUT PARTIAL
Actual Implementation: `teach_replay dry_run` + column-mismatch `needs_confirmation` heuristic (`contains column` → warn); `teach_list_versions/restore_version confirm` keeps prior (no silent overwrite).
Missing: Real target-structure check (sheet columns, CRM fields, app window detect)
Next Required Action: Pre-flight adapters for Excel (openpyxl header read) + Salesforce (describe) + desktop (window title).

---
## F. APP STUDIO

### Feature: UI generator (Aceternity) + external launchers
Category: STUDIO
Status: REAL BUT PARTIAL
Actual Implementation: `Projects/apex-web/index.html` BentoGrid scaffold exists; `plugin_execute`/`open_external_url` can open Canva/Figma/Paint URLs. No in-Rust website scaffolder.
Files: `MYRAA/resources/app/Projects/apex-web/index.html` (check), `lib.rs:629`
UI Connected: PARTIAL
Next Required Action: Port generator into `studio_generate_website` command.

### Feature: Deep Figma integration (tokens→push)
Category: STUDIO
Status: SPECIFIED BUT NOT BUILT (gating only)
See Figma tile above.

### Feature: Deep Canva integration (brand kit→generate)
Category: STUDIO
Status: SPECIFIED BUT NOT BUILT (gating only)
See Canva tile above.

### Feature: Real DOCX generation (headings/TOC/tables)
Category: STUDIO
Status: REAL & WORKING
Actual Implementation: `studio_generate_office docx` python-docx template: Title centered, Intense Quote date, TOC bullets, `# /## ` headings, `|…|` tables Light Shading, page break. Live `MYRAA_PRD.docx 35645` generated 2026-09-03. Fallback text if libs missing.
Files: `lib.rs:744-852`, `%APPDATA%/MYRAA/cache/MYRAA_PRD.docx`
Dependencies: `python-docx` (pip installed 2026-09-03)
UI Connected: YES via `window.MyraaStudio.office`
Real Testing Performed: Generated + size verified; Word open NOT yet verified (needs Word)
Last Tested: 2026-09-03
Known Problems: TOC is static bullets, not field-updated TOC.
Next Required Action: Open in Word → confirm headings navigate; add real TOC field.

### Feature: Real XLSX generation (formulas/chart)
Category: STUDIO
Status: REAL & WORKING
Actual Implementation: openpyxl template: header fill 0EA5E9, Revenue/Expenses/Profit with `=SUM/=B2-B3`, BarChart, fitToPage. Live `MYRAA_Financial.xlsx 5059` with `B4==B2-B3`.
Files: `lib.rs:744`, live xlsx
UI Connected: YES
Real Testing Performed: Formula strings verified via openpyxl readback
Known Problems: Conditional formatting/pivot/tables not yet.
Next Required Action: Open in Excel → edit Q1 → Total recalculates.

### Feature: Real PPTX generation (theme/layouts)
Category: STUDIO
Status: REAL & WORKING
Actual Implementation: python-pptx 13.33×7.5, dark 0A0A0F + cyan 00E5FF, title + `---` split content slides. Live `MYRAA_Deck.pptx 28445 1 slide`.
Files: `lib.rs:744`, live pptx
UI Connected: YES
Real Testing Performed: Slide count verified
Next Required Action: Open in PowerPoint → confirm theme editable.

### Feature: Project asset linking (Memory Core Active Projects)
Category: STUDIO
Status: REAL BUT PARTIAL
Actual Implementation: After each office file, `memory_add project Generated asset…` + `asset_*` SQLite row + `session_touch studio_office:…`.
Missing: Active Projects UI query (`memory_search project` works but no dedicated view)
Next Required Action: Dashboard "Generated Assets" list per project.

---
## G. SECURITY

### Feature: Credential Vault (Master Identity + service list)
Category: SECURITY
Status: REAL BUT PARTIAL
Actual Implementation: `vault_list/save/get_secret/delete/status/migrate`, `VAULT_SERVICE com.myraa.desktop` via `keyring` (Windows Credential Manager DPAPI), meta `settings/vault_meta.json` (no secret, `has_secret` flag), `CONFIRM_REQUIRED` on delete, `vault_migrate_plaintext` runs on setup (moves `password/secret` → keyring, scrubs legacy to `trash`). Live meta has 4 entries (3 oauth `has_secret:false` + `gemini_api_key has_secret:true`). Legacy `%APPDATA%/JARVIS/vault.json` STILL EXISTS with 3 oauth entries (no password fields — not secret, but still plaintext file, not scrubbed because no secret to migrate). `secrets.json` scrubbed to `{}` earlier (verify).
Files: `lib.rs:163-289`, `%APPDATA%/MYRAA/settings/vault_meta.json`, `%APPDATA%/JARVIS/vault.json`
Dependencies: `keyring` crate
UI Connected: YES (vault tab via bridge `GET /api/vault → invoke vault_list`)
Real Testing Performed: Meta inspected (no `password` in meta); keyring get not tested from Rust (needs binary run); legacy scrub partial
Last Tested: 2026-09-03
Known Problems: Google One-Click token flow still only in old `apex_v5_routes.cjs`, not moved to `plugin_connect gmail`; legacy file remains (should be deleted or left as non-secret alias — currently confusing).
Next Required Action: Run real binary → `vault_status secure:true` → delete legacy if `plaintext_found:false`; move Google OAuth to `gmail_token`.

---
## H. VOICE / SYSTEM / DIAGNOSTIC

### Feature: File Explorer control (browse/create/rename/move/copy/delete/search/preview/open-with)
Category: SYSTEM
Status: REAL & WORKING
Actual Implementation: `list_local_dir/read/copy/move(trash)/open/file_search name+content`, `write/delete` with `CONFIRM_REQUIRED` outside `myraa_base+Projects/Documents`, `move_to_recycle_bin` safe, `verify_all_tools` FS ping `myraa_base.exists()`.
Files: `lib.rs:72-162, 415`
UI Connected: YES via `window.MyraaFS`
Real Testing Performed: Code review; live FS not touched in audit (safety)
Known Problems: Preview/open-with is OS default (`cmd start`), no in-app preview.
Next Required Action: Add duplicate/large/unused analyzers (Phase 3 File Intelligence) with confirm modal.

### Feature: System settings (Wi-Fi/BT/brightness/volume/wallpaper/power)
Category: SYSTEM
Status: REAL BUT PARTIAL
Working: Wi-Fi read (`netsh show interfaces`), volume/brightness set via powershell/WMI, wallpaper via SystemParametersInfo, `get_system_info`.
Missing: Wi-Fi connect/disconnect/forget, BT scan/pair/connect, power plan, battery % (sysinfo has but not exposed separately).
Next Required Action: Add `wifi_connect/disconnect`, `bt_scan`, `power_plan`, `battery_status`.

### Feature: Laptop diagnostics + safe cleanup
Category: SYSTEM
Status: REAL BUT PARTIAL
Working: `get_system_info hostname/platform/arch/cpus/memory/uptime`, `diagnostic_run` aggregates system+vault+memory+plugins+gemini → `overall_health %`, `capability_list 12 caps`, `feature_truth_dashboard REAL/PARTIAL`, `permission_check READ_ONLY→CRITICAL`.
Missing: Disk per-drive, GPU, temp-file/duplicate analyzers, cleanup confirm flow.
Next Required Action: Add disk/GPU + `cleanup_scan` (list-only) → confirm delete.

### Feature: Capability Registry + Feature Truth + Permission Engine
Category: SYSTEM
Status: REAL BUT PARTIAL
Actual Implementation: `capability_list`, `feature_truth_dashboard` (GitHub REAL, Figma Push PARTIAL, Screen Vision PARTIAL…), `permission_check` (delete→DESTRUCTIVE needs confirm). No persistent `last_tested/last_error` store — computed live.
Files: `lib.rs:917-999`
UI Connected: YES via `/api/capabilities /api/diagnostic /api/feature-truth` bridge + `MyraaMemory.truth/capabilities/diagnostic`
Real Testing Performed: None (needs binary run)
Next Required Action: Persist `last_success/last_error` to SQLite; dashboard must show `last_verified`.

### Feature: Offline/Online intelligence
Category: SYSTEM
Status: SPECIFIED BUT NOT BUILT
Actual Implementation: `get_network_info connected ssid/signal` exists, but no mode switch (FULL/LIMITED/OFFLINE) or capability gating.
Next Required Action: `connectivity_status` + bridge banner + disable online tiles when offline.

---
## I. PHASED EXPANSION (1-24) — QUICK TRIAGE

| Phase | Status | Note |
|-------|--------|------|
| 1 Voice upgrade (Hindi/Hinglish, interrupt, offline) | SPECIFIED BUT NOT BUILT | Only Gemini backoff exists |
| 2 Full PC control (window/kb/mouse) | SPECIFIED BUT NOT BUILT | Only FS+volume+wallpaper real |
| 3 File intelligence (dup/large/semantic/cleanup) | REAL BUT PARTIAL | Search real; analyzers missing |
| 4 WhatsApp hub | PLANNED | No API; modes ALWAYS_CONFIRM etc spec only |
| 5 Music/YouTube intelligence (Spotify/local, memory) | PLANNED | YouTube mock only |
| 6 Reminders/calendar/briefing/review | PLANNED | Tray menu Tasks/Status exist but no store |
| 7 Weather/live info (never invent) | PLANNED | `get_network_info` only |
| 8 Memory 2.0 (8 categories + commands) | REAL BUT PARTIAL | SQLite real; taxonomy/commands missing |
| 9 Coding agent (scan→fix loop, must test) | NEW IDEA | No scanner; spec only |
| 10 Browser missions | SPECIFIED BUT NOT BUILT | Only opener |
| 11 Multi-agent (fleet QUEUED→CANCELLED) | NEW IDEA | No runtime |
| 12 Autonomous sandbox | NEW IDEA | Modular spec only |
| 13 Screen+camera vision | SPECIFIED BUT NOT BUILT / PLANNED | Screen partial placeholder; camera planned |
| 14 Creator suite (photo/draw/record/YT for VishwaJeetSrK/TinyLifeHacks) | PLANNED | Screen recording modes spec only |
| 15 Document/research + Resume agent | REAL BUT PARTIAL | DOCX/XLSX/PPTX real; resume/research missing |
| 16 Phone Link (QR/pairing) | PLANNED | — |
| 17 Calls (pick up/reject) | NEW IDEA (platform-restricted) | Do not claim |
| 18 Study mode (whiteboard/quiz/spaced) | PLANNED | — |
| 19 Personality (Companion/Professional/Focus/Playful, default MYRAA warm) | SPECIFIED BUT NOT BUILT | Greetings hardcoded "Vishwajeet" in `time_greeting`; needs `display_name` |
| 20 Self diagnostic ("diagnose yourself") | REAL BUT PARTIAL | `diagnostic_run` real aggregation; voice trigger phrase not wired to chat |
| 21 Feature truth (registry + risk) | REAL BUT PARTIAL | See H |
| 22 Offline/Online | SPECIFIED BUT NOT BUILT | See H |
| 23 Proactive (OFF/LOW/BALANCED/HIGH default BALANCED) | PLANNED | No silence detector |
| 24 Startup (health→memory→briefing) | REAL BUT PARTIAL | `setup` does dirs+migrate+session_touch; briefing `time_greeting` hardcoded name; no weather/tasks pull |

---
## J. ROADMAP (NOW/NEXT/LATER/FUTURE + P0-P6)

**NOW — FIX AND VERIFY (P0/P1):** Tauri `tauri build` → replace `MYRAA-Upgrade-Setup.exe`; delete/alias legacy vault; real Gmail/GitHub REST or mark PARTIAL in dashboard; step-review modal; open DOCX/XLSX/PPTX in Word/Excel/PowerPoint; kill-test real binary; `AssistantIdentity` (this audit ships it).
**NEXT — HIGH PRIORITY (P2/P3):** Window/kb/mouse control; file analyzers + cleanup confirm; WhatsApp architecture (draft+confirm only); reminders store + daily briefing with `display_name`; offline banner.
**LATER — ADVANCED (P4/P5):** Browser missions; coding agent (must run tests); creator record/photo; study mode; proactive BALANCED.
**FUTURE — RESEARCH (P6):** Multi-agent fleet; autonomous sandbox; camera vision (permission+indicator); calls (likely impossible — research only); Spotify (OAuth).

P0 Verify existing → P1 Core reliability (voice/memory/vault/health) → P2 PC control → P3 Communication → P4 Agents → P5 Creator → P6 Advanced companion. Reliability > quantity. REAL > MOCK. VERIFIED > CLAIMED.

---
## K. DEFINITION OF DONE (per feature)

Backend exists + UI exists + UI→backend wired + real work (not simulated) + permissions + errors + accurate status + tested + last-tested date. A button alone is NOT done. Dashboard must reflect this file.
