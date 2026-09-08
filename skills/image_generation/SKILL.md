---
name: image_generation
title: "Image Generation"
description: "Generate visual assets from prompts and support iterative creative direction through configured image providers."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "image_generation", "myraa-skill"]
---

# Image Generation

# Image Generation

## Mission
Generate visual assets from prompts and support iterative creative direction through configured image providers.

## Core capabilities
- prompt planning
- generation
- variant strategy
- asset metadata
- provider routing

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

