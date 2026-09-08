---
name: long_context_memory
title: "Long Context And Memory"
description: "Store task-relevant notes, retrieve prior context, preserve decisions, and support long-running projects without losi..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "long_context_memory", "myraa-skill"]
---

# Long Context And Memory

# Long Context and Memory

## Mission
Store task-relevant notes, retrieve prior context, preserve decisions, and support long-running projects without losing constraints.

## Core capabilities
- working memory
- project memory
- retrieval
- decision log
- context compression

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

