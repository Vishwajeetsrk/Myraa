# MYRAA System Architecture

## Architecture Overview

MYRAA is built as a layered, fault-tolerant AI Operating System:

```
+-----------------------------------------------------------+
|                   DESKTOP ELECTRON SHELL                  |
+-----------------------------------------------------------+
|                      EXPRESS HTTP API                     |
|           /api/coding, /api/git, /api/intelligence       |
+-----------------------------------------------------------+
|                   AGI FOUNDATION LAYER                    |
|  Capability Registry | Health Monitor | Activity Timeline  |
+-----------------------------------------------------------+
|              AUTONOMOUS INTELLIGENCE V2 ENGINE             |
|   Decision Pipeline | Design Tokens | Quality Gates       |
+-----------------------------------------------------------+
|                  CORE SERVICES & ENGINES                  |
| GitService | TestRunner | WordEngine | ProjectDetection   |
+-----------------------------------------------------------+
|                   PERSISTENT STORAGE                      |
|      .myraa-data/ (JSON, Memory, Timeline, Backups)       |
+-----------------------------------------------------------+
```

## Layer Responsibilities

1. **Presentation / Electron Shell**: Handles desktop window lifecycles, global keyboard shortcuts, system tray, and webview rendering.
2. **API & Router Layer**: Serves frontend endpoints, routes voice commands, and coordinates tool executions.
3. **AGI Foundation**: Maintains registry of all engine descriptors, tracks dependency health, logs activities to chronological timeline.
4. **Autonomous Intelligence V2**: Synthesizes PRDs, selects frameworks, computes design tokens, audits code against zero-emoji and accessibility standards, and tracks project memory.
5. **Core Services**: Local git CLI wrapper, test runner, AST graft engine, self-healing dev loop, and Word document generator.
6. **Data Storage**: Durable, atomic JSON storage with non-destructive versioning.
