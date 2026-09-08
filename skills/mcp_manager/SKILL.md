---
name: mcp_manager
title: "Mcp Manager"
description: "Discover, connect, authorize, and invoke Model Context Protocol servers and tools."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "mcp_manager", "myraa-skill"]
---

# Mcp Manager

# MCP Manager

## Mission
Discover, connect, authorize, and invoke Model Context Protocol servers and tools.

## Core capabilities
- server registry
- tool discovery
- permissions
- health checks

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

