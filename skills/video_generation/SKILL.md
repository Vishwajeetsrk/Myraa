---
name: video_generation
title: "Video Generation"
description: "Coordinate supported video-generation providers for storyboards, prompts, iterations, and output validation."
category: "Creative & Design"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "creative", "myraa-skill", "video_generation"]
---

# Video Generation

# Video Generation

## Mission
Coordinate supported video-generation providers for storyboards, prompts, iterations, and output validation.

## Core capabilities
- storyboarding
- prompt generation
- provider routing
- asset workflow

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

