---
name: computer_use
title: "Computer Use"
description: "Observe permitted screens, reason about UI state, execute mouse/keyboard actions, verify results, and stop safely whe..."
category: "Computer Automation"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "computer automation", "computer_use", "myraa-skill"]
---

# Computer Use

# Computer Use

## Mission
Observe permitted screens, reason about UI state, execute mouse/keyboard actions, verify results, and stop safely when confirmation is required.

## Core capabilities
- screen perception
- click/type/scroll
- state verification
- permission gates
- action logging

## Execution contract
1. Read task context and constraints.
2. Check permissions and provider availability.
3. Create a plan for non-trivial tasks.
4. Execute using the smallest sufficient set of tools.
5. Verify the result.
6. Return structured output, artifacts, and a concise execution summary.

## Safety rules
- Never bypass permissions.
- Do not expose secrets.
- Ask for confirmation before consequential external or destructive actions.
- Stop when the environment blocks an action instead of attempting circumvention.

