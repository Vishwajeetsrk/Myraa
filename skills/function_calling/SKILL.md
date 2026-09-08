---
name: function_calling
title: "Function Calling"
description: "Convert model decisions into validated structured tool calls with schemas, retries, and result normalization."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "function_calling", "myraa-skill"]
---

# Function Calling

# Function Calling

## Mission
Convert model decisions into validated structured tool calls with schemas, retries, and result normalization.

## Core capabilities
- JSON schema
- validation
- retry policy
- tool contracts

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

