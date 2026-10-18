# Global Rules — MYRAA AI OS

These rules apply to ALL code, UI, responses, and operations within this project.

## 1. NEVER USE EMOJIS

- No emoji characters (Unicode U+1F000+) in any UI, HTML, JS, CSS, or output
- No emoji in toast messages, alerts, console logs shown to users
- Replace ALL emojis with inline SVG icons or ASCII symbols
- Approved SVG icon set: checkmark, close/X, warning, lightning, gear, target, folder, lock, refresh, shield, microphone, camera, speaker, brain, robot, bulb
- Approved ASCII fallbacks: `[OK]`, `[X]`, `[!]`, `[*]`, `[-]`, `[>]`, `[+]`

## 2. NEVER DELETE USER DATA

- NEVER delete, overwrite, or modify user files, folders, code, passwords, memory, or conversation history
- NEVER run destructive file operations (rm, rmdir, del) on user directories
- NEVER overwrite existing user-created files without explicit confirmation
- NEVER clear browser storage, cookies, or local storage without user consent
- NEVER remove or reset conversation transcripts or recall data
- All data operations must be ADDITIVE or READ-ONLY by default
- If a migration is needed, always backup first and preserve original data

## 3. VERSION ACCURACY

- All UI version strings must read from `version.json` or `package.json` at runtime
- Never hardcode version numbers in UI components
- Use `_readAppVersionSync()` or equivalent dynamic version reader

## 4. CODE QUALITY

- No hardcoded paths to user machines (use `__dirname`, `process.env`, or config)
- All API endpoints must handle errors gracefully
- All frontend components must be responsive
- Use semantic HTML and accessible markup

## 5. WORD ENGINE CAPABILITIES

The MYRAA Professional Word Engine (v7.0) provides:

### Document Types
- Letters, Reports, Resumes/CVs, Business Proposals, Contracts
- Technical Documentation, SOPs, User Manuals, Whitepapers
- Essays, Articles, Meeting Minutes, Invoices, PRDs, READMEs

### Core Operations
- CREATE: Professional documents with design system, typography, styles
- READ: Parse .docx structure (headings, tables, images, styles)
- EDIT: Find/replace with regex, case-sensitive, whole-word matching
- FORMAT: Professional typography, styles, spacing, alignment
- REVIEW: Readability analysis, grammar checks, structure scoring
- REDESIGN: Fix typography, spacing, headings, tables, alignment
- MERGE: Combine multiple Word documents
- SPLIT: Divide document by headings
- EXPORT: Word to PDF via COM automation
- ANALYZE: Document structure analysis

### Design System
- Page size (A4, Letter, Legal)
- Orientation (Portrait, Landscape)
- Margins (configurable)
- Typography (font family, size, weight, spacing)
- Styles (Heading 1-4, Normal, List Bullet)
- Tables (borders, shading, header rows)
- Headers/Footers (page numbers, document title)
- Table of Contents (auto-generated)

### Voice Commands
- "Create a report" → WORD_CREATE
- "Fix formatting" → WORD_FORMAT
- "Review this document" → WORD_REVIEW
- "Make this professional" → WORD_REDESIGN
- "Add a TOC" → WORD_TOC
- "Combine these files" → WORD_MERGE
- "Save it to Desktop" → WORD_FILE_MANAGER
- "Export as PDF" → WORD_EXPORT

### API Endpoints
- POST /api/office/generate (type: 'word')
- POST /api/office/word/review
- POST /api/office/word/redesign
- POST /api/office/word/merge
- POST /api/office/word/split
- POST /api/office/word/find-replace
- POST /api/office/word/analyze
- POST /api/office/word/export-pdf

## 6. CODING AGENT CAPABILITIES (v9.0.0)

MYRAA is a voice-controlled software engineering agent. When the user speaks, MYRAA understands intent, detects project context, and executes autonomously.

### Unified Coding Loop
```
VOICE → INTENT → PROJECT DETECTION → MEMORY → PLAN → SKILL SELECTION →
TOOL SELECTION → CODE → RUN → TEST → OBSERVE → DEBUG → PATCH →
RETEST → REVIEW → MEMORY UPDATE → REPORT
```

### Services
- **GitService** (`git_service.cjs`): Real local git CLI wrapper — init, add, commit, push, pull, branch, checkout, status, log, diff, stash, clone, merge, tags, undo
- **ProjectDetectionService** (`project_detection_service.cjs`): Deep package.json analysis — framework detection, language detection, database detection, package manager, scripts, dependencies, entry points, git state
- **TestRunnerService** (`test_runner_service.cjs`): Test execution — jest, vitest, pytest, cargo test, go test, eslint, flake8, clippy, npm install, npm build
- **CodingOrchestrator** (`coding_orchestrator.cjs`): Master brain — intent classification, task routing, project state management, 30+ voice intents
- **SelfHealingDevEngine** (`self_healing_dev_engine.cjs`): Plan → Write → npm install → Run → Catch Error → Fix → Retry → Test
- **TerminalRunner** (`terminal_runner.cjs`): Real shell command execution with streaming, timeout, error detection
- **CodeReviewEngine** (`code_review_engine.cjs`): Multi-language linting, syntax checking, toolchain detection
- **GraftEngine** (`graft_engine.cjs`): AST-based code intelligence — symbol graph, call tracing, repo mapping

### Voice Commands
- "Create a React website" → create_project
- "Run the project" → run_project
- "Build the project" → build_project
- "Test the project" → test_project
- "Lint the code" → lint_project
- "Install dependencies" → install_deps
- "Git status" → git_status
- "Commit these changes" → git_commit
- "Push to remote" → git_push
- "Pull from remote" → git_pull
- "Show commit history" → git_log
- "Create a new branch" → git_branch
- "Show the diff" → git_diff
- "Fix the error" → fix_error
- "Analyze this error" → inspect_error
- "Refactor this code" → refactor
- "Review my code" → review_code
- "Create a file" → create_file
- "Read this file" → read_file
- "Search for X in the project" → search_files
- "Explain this code" → explain_code
- "Take a screenshot" → screenshot
- "Look at my screen" → look_at_screen
- "Open VS Code" → open_vscode
- "Run this command" → run_command
- "Fix the build" → fix_build
- "Remember this project" → remember_project
- "What changed today?" → what_changed
- "Undo last change" → undo
- "Stop" → stop (safely halts autonomous task)

### API Endpoints
- GET /api/git/status, /api/git/log, /api/git/diff, /api/git/branches, /api/git/search
- POST /api/git/init, /api/git/add, /api/git/commit, /api/git/push, /api/git/pull, /api/git/checkout, /api/git/create-branch, /api/git/clone, /api/git/stash, /api/git/undo-commit, /api/git/ignore
- GET /api/project/detect, /api/project/state
- GET /api/test/detect
- POST /api/test/run, /api/test/lint, /api/test/build, /api/test/install
- POST /api/coding/execute, /api/coding/stop
- GET /api/coding/intent, /api/coding/state
- POST /api/developer/generate, /api/developer/fix-bugs, /api/developer/refactor, /api/developer/lint
- POST /api/dev/self-healing-build
- POST /api/terminal/run, GET /api/terminal/status

### Self-Healing Loop
1. Plan project structure (AI-powered)
2. Write generated files
3. `npm install` if package.json exists
4. Open in VS Code
5. Execute entrypoint
6. If error: identify culprit file, AI fix, retry (up to 4 attempts)
7. Run tests if available
8. Report results

### Project Detection
Detects: React, Next.js, Vue, Angular, Svelte, Express, Fastify, NestJS, Electron, Tauri, Django, Flask, FastAPI, Rust, Go, Spring, and more. Reads package.json, requirements.txt, Cargo.toml, go.mod, pyproject.toml.
