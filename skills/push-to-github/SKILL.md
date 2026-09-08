---
name: push-to-github
title: "Push To Github"
description: "Runs all necessary checks (lint, tests) and pushes to GitHub. Use this as the final safety gate."
category: "Coding & Development"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["automation", "coding", "github", "myraa-skill", "push"]
---

# Push To Github

# Push to GitHub

Use this skill **when you are ready to push** your changes to the remote repository. It acts as a safety gate to prevent breaking CI.

## Usage

1.  Verifies changes (Unit Tests).
2.  Runs code checks (Lint/CheckCode).
3.  Pushes to the current branch.

### Command

```bash
python3 .agent/skills/push_to_github/scripts/push.py
```
