---
name: myraa_desktop_screen_file_automation_skill
title: "Myraa Desktop, Screen & File Automation"
description: "Screen-aware computer automation, OCR, file downloads, saving, moving, ZIP extraction, and authorized messaging."
category: "Computer Automation"
image: "icon.svg"
icon: "icon.svg"
version: "1.0.0"
tags: ["automation", "computer automation", "myraa-skill", "myraa_desktop_screen_file_automation_skill"]
---

# Myraa Desktop, Screen & File Automation

# MYRAA Desktop, Screen & File Automation Skill

## Mission
Enable MYRAA to understand the visible screen, identify requested people or labels,
operate an authorized computer/browser session, download files, save files to user-selected
locations, organize documents/images, and extract ZIP archives.

## Core workflow
Observe -> Understand -> Plan -> Request/verify permission -> Act -> Verify -> Report.

## Supported tasks
1. Read the active screen using OCR/vision.
2. Find visible names, labels, filenames, buttons and chat targets.
3. Navigate an authorized browser or desktop UI.
4. Download selected files.
5. Save to Desktop, Downloads, Documents or a user-provided path.
6. Move, copy, rename and organize files.
7. Extract ZIP archives to a chosen folder.
8. Create ZIP archives when requested.
9. Identify images/documents and organize them by type or task.
10. Compose and send a message through an authorized messaging UI.

## Messaging safety
- Default: draft the message and show the target before sending.
- Auto-send is allowed only when the user explicitly enables trusted auto-send
  for the current task/session.
- Never guess the recipient.
- Verify the visible recipient name before sending.

## Download safety
- Download only user-requested files.
- Verify filename, extension and final destination.
- Do not execute downloaded programs automatically.
- Do not bypass login, security checks, CAPTCHA or access controls.

## File destination aliases
Desktop   -> user Desktop folder
Downloads -> user Downloads folder
Documents -> user Documents folder
Pictures  -> user Pictures folder
Custom    -> exact path specified by user

## ZIP extraction
1. Verify archive exists.
2. Ask/select destination if not specified.
3. Extract.
4. Verify extracted files.
5. Report destination and file count.

## Structured result
{
  "status": "completed | blocked | failed",
  "screen_findings": [],
  "actions": [],
  "saved_files": [],
  "extracted_files": [],
  "messages": [],
  "verification": []
}

