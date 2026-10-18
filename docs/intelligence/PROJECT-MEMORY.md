# MYRAA Project Memory Architecture

## Overview

Project Memory ensures continuity across development sessions, enabling MYRAA to understand what has been built, how dependencies are organized, and which architectural patterns have been established.

## Schema & Persistence

Project memory is stored within `.myraa-data/intelligence/project_memory.json` or local data directories using atomic writes.

```json
{
  "executions": [
    {
      "id": "exec_1727249102618",
      "timestamp": "2026-09-25T07:25:02.618Z",
      "projectLocation": "resources/app/dist/autonomous_decision_engine.cjs",
      "filesChanged": [
        "resources/app/dist/autonomous_decision_engine.cjs",
        "docs/intelligence/*"
      ],
      "commands": [
        "node -e \"require('./autonomous_decision_engine.cjs')\""
      ],
      "tests": "ALL_PASSED",
      "architecture": "Autonomous V2 Engine with Modular Design Tokens and Pure SVG",
      "decisions": [
        {
          "item": "Premium Aesthetic",
          "reason": "Deepened background to obsidian blue, refined surface contrast."
        }
      ]
    }
  ]
}
```

## Non-Destructive Principles

- **Zero Overwrite of History**: New executions are prepended or appended to history. Past logs and snapshots are preserved.
- **Atomic File Updates**: Temporary swap files (`.tmp`) ensure that process interruption never corrupts stored knowledge.
- **Privacy & Isolation**: Memory files are stored locally on the user's filesystem and never exported to unauthorized third parties.
