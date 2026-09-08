---
name: system_health
title: "System Health"
description: "Monitor MYRAA services, provider connections, skills, queues, errors, and performance."
category: "Business & Productivity"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "business", "myraa-skill", "system_health"]
---

# System Health

# System Health

## Mission
Monitor MYRAA services, provider connections, skills, queues, errors, and performance.

## Core capabilities
- health checks
- metrics
- alerts
- dependency status

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

