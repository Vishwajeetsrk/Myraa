---
name: realtime_conversation
title: "Realtime Conversation"
description: "Maintain low-latency multimodal sessions with interruption handling, streaming responses, and session state."
category: "AI & Intelligence"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["ai", "automation", "myraa-skill", "realtime_conversation"]
---

# Realtime Conversation

# Realtime Conversation

## Mission
Maintain low-latency multimodal sessions with interruption handling, streaming responses, and session state.

## Core capabilities
- streaming
- barge-in
- session state
- latency monitoring

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

