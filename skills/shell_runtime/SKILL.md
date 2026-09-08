---
name: shell_runtime
title: "Hosted Shell / Local Runtime"
description: "Run approved commands in isolated environments, install dependencies, execute scripts, inspect logs, and return repro..."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "myraa-skill", "shell_runtime"]
---

# Hosted Shell / Local Runtime

# Hosted Shell / Local Runtime

## Mission
Run approved commands in isolated environments, install dependencies, execute scripts, inspect logs, and return reproducible results.

## Core capabilities
- command execution
- dependency setup
- log analysis
- sandbox policy
- artifacts

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

