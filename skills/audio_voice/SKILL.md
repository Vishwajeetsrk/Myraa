---
name: audio_voice
title: "Audio And Voice"
description: "Handle speech input/output pipelines including transcription, speech generation, and conversational voice interaction."
category: "Creative & Design"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["audio_voice", "automation", "creative", "myraa-skill"]
---

# Audio And Voice

# Audio and Voice

## Mission
Handle speech input/output pipelines including transcription, speech generation, and conversational voice interaction.

## Core capabilities
- transcription
- speech synthesis
- voice session
- audio preprocessing

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

