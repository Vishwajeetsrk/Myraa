---
name: image_editing
title: "Image Editing"
description: "Perform authorized edits such as object changes, cleanup, background changes, and visual transformations using config..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "image_editing", "myraa-skill"]
---

# Image Editing

# Image Editing

## Mission
Perform authorized edits such as object changes, cleanup, background changes, and visual transformations using configured image tools.

## Core capabilities
- edit planning
- mask/region workflow
- quality validation
- versioning

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

