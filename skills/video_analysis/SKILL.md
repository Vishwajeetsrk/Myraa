---
name: video_analysis
title: "Video Analysis"
description: "Inspect video frames and timelines, summarize scenes, extract events, analyze demonstrations, and answer questions gr..."
category: "Creative & Design"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "creative", "myraa-skill", "video_analysis"]
---

# Video Analysis

# Video Analysis

## Mission
Inspect video frames and timelines, summarize scenes, extract events, analyze demonstrations, and answer questions grounded in the video.

## Core capabilities
- frame sampling
- timeline analysis
- scene summary
- UI workflow extraction

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

