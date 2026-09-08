---
name: meeting-follow-up-pipeline
title: "Meeting Follow Up Pipeline"
description: "Turn a completed meeting into a debrief, decisions, action items, ready-to-send follow-up drafts, and proposed writeb..."
category: "Communication"
image: "icon.svg"
icon: "icon.svg"
version: "2.5.0"
tags: ["automation", "communication", "follow", "meeting", "myraa-skill", "pipeline"]
---

# Meeting Follow Up Pipeline

# Meeting Follow-Up Pipeline

Close the loop after a meeting. Turn a finished conversation into clarity and shipped follow-ups, so nothing important gets dropped.

The job in one line:

**meeting happened → clarity shipped → nothing important gets dropped**

This is **not** a transcript dump and **not** a generic recap.

## Setup

Fill in the tools you use (or let the agent ask). The skill degrades gracefully — if a source isn't available, it flags that and asks for pasted input instead.

- `[MEETING NOTES TOOL]` — where your notes/transcript live (Granola, Fathom, Otter, Fireflies, Fellow, or pasted text)
- `[EMAIL]` — your email, for drafting external follow-ups
- `[CHAT]` — your team chat, for drafting internal follow-ups (Slack, Teams, etc.)
- `[TASK SYSTEM]` — where action items get promoted (Coda, Notion, Asana, Linear, a spreadsheet)
- `[DRAFTS AREA]` — where sendable drafts get staged for review before sending (a drafts folder, an "outbox" doc, etc.)

## When to Use

- "Run the meeting follow-up pipeline"
- "Debrief my last meeting"
- "Process this meeting"
- "What are the key follow-ups from that meeting?"

Right after a meeting, during an end-of-day wrap to catch missed follow-ups, or before the next meeting in a chain to avoid dropping context.

## Scope Rule: All Meetings Eligible, Not All Get the Same Treatment

Classify the meeting and route it to one of three levels. Run the workflow for all three — just don't force heavy outputs when the meeting doesn't justify them.

**Level 1 — Full pipeline:** external, customer/prospect, partner, candidate interviews, board/investor, high-stakes internal decision meetings.

**Level 2 — Internal substantive:** leadership reviews, initiative reviews, staffing/org discussions, important cross-functional working sessions.

**Level 3 — Lightweight capture:** routine status meetings, normal recurring syncs, low-novelty internal meetings.

## Default Target

If the user only says "run the pipeline" / "process this meeting" / "debrief my last meeting":

1. Use the most recent completed meeting as the default.
2. If ambiguous, ask the user to pick from the top 3 recent candidates.

Never guess across multiple adjacent meetings if the target is unclear.

## Source Priority

1. **[MEETING NOTES TOOL]** — notes and transcript (primary)
2. **Calendar** — meeting metadata and attendees
3. **[EMAIL]** — only when needed for follow-up drafting or relationship context
4. **Reference context** — only when a factual claim needs to be verified

If the notes tool is unavailable, say so explicitly and ask the user for pasted notes or bullets.

## Core Flow

### Step 1: Identify and Classify the Meeting

Determine: meeting name, time, participants, meeting type, and treatment level (1/2/3).

### Step 2: Generate the Debrief

Extract:

- **Bottom line** (1-2 sentences on what mattered)
- **Decisions** (only actual decisions — if none, say so)
- **Action items** (owners and due timing when possible)
- **Risks / open loops** (what's still unclear or risky)

Keep the debrief under ~250 words before drafts. Don't bury the takeaway in prose.

### Step 3: Draft Follow-Ups Inline (Only When Earned)

Good reasons to draft:

- An explicit promise or next step was made
- External relationship maintenance
- Coordination that will fail if not written down
- Ambiguity that should be closed quickly

Do not force follow-up drafts for low-value internal chatter.

Drafting rules:

- Direct, specific, no fluff. Match the user's voice.
- One clear ask per message.
- Include a concrete next step and owner.
- Avoid "just checking in" filler.
- For external recipients, keep it warm but crisp.

### Step 4: Propose Promotion Actions (Propose, Don't Auto-Write)

Propose — do not automatically execute:

- **[TASK SYSTEM] additions** for important user-owned commitments
- **[DRAFTS AREA] staging** when a draft is clearly worth sending later
- **Decision-log entries** for meaningful, durable decisions
- **Initiative/project-tracker escalation** for repeated or material blockers

Always propose promotion for: user-owned commitments, externally visible promises, due-soon items, repeated open loops, and decisions meaningful enough to matter later.

Usually don't promote: low-signal discussion points, conversational debris, generic chatter, speculative comments with no owner.

### Step 5: Hand Off or Stop

End by asking the smallest useful next question:

- Stage these to [DRAFTS AREA]?
- Send now?
- Promote these owned items to [TASK SYSTEM]?
- Leave as debrief only?

Do not default to staging or sending. Show drafts inline first.

## Required Output Shape

```markdown
## Source Status
| Source | Status | Notes |
|--------|--------|-------|
| [MEETING NOTES TOOL] | fresh / missing | Notes or transcript pulled |
| Calendar | fresh / missing | Meeting metadata checked |
| [EMAIL] | fresh / not_needed / missing | Used only if follow-up drafting needed |
| Reference context | not_needed / fresh / missing | Only if a factual claim was verified |

## Meeting Type
**[Meeting type] — Level [1/2/3]**

## Bottom Line
[1-2 sentences]

## Decisions
- [Decision]
- [Decision]

## Action Items
| Owner | Task | Due | Notes |
|-------|------|-----|-------|
| [You] | [Task] | [When] | [Context] |
| [Other] | [Task] | [When] | [Context] |

## Draft Follow-Ups
- **To:** [Person] · **Channel:** [Email/Chat]
  - Draft: "[ready-to-send text]"

## Promotion Actions
- **[TASK SYSTEM] proposal:** [What should be added, and why]
- **[DRAFTS AREA] proposal:** [What should be staged, and why]
- **Decision-log proposal:** [If needed]

## Recommended Next Step
- [Single highest-leverage next move]
```

## Edge Cases

- **Multiple adjacent meetings:** ask which one to process, then proceed.
- **No notes yet:** use the transcript if available; otherwise ask for 3 bullets.
- **Action-item ambiguity:** mark as "Needs owner confirmation" instead of guessing.

## Anti-Patterns

- Don't dump transcript text.
- Don't force a follow-up draft for every meeting.
- Don't auto-write to your task system without asking.
- Don't auto-stage or auto-send drafts without asking.
- Don't promote low-value chatter into durable systems.
- Don't treat a routine status sync like a board meeting.

## Working Standard

After this workflow, the user should know:

1. What happened
2. What was actually decided
3. Who owes what
4. What message should be sent, if any
5. What deserves promotion into the execution system
