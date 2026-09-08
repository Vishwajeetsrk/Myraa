---
name: model_router
title: "Model Router"
description: "Select the best available provider/model based on modality, latency, cost, privacy, tool support, and task complexity."
category: "Security"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "model_router", "myraa-skill", "security"]
---

# Model Router

# Model Router

## Mission
Select the best available provider/model based on modality, latency, cost, privacy, tool support, and task complexity.

## Core capabilities
- capability registry
- fallback routing
- cost policy
- latency policy
- provider health

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

