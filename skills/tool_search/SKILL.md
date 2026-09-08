---
name: tool_search
title: "Tool Search"
description: "Dynamically search available tools/skills based on task intent and capability metadata."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "myraa-skill", "tool_search"]
---

# Tool Search

# Tool Search

## Mission
Dynamically search available tools/skills based on task intent and capability metadata.

## Core capabilities
- semantic discovery
- capability matching
- ranking
- fallbacks

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

