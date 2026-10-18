# MYRAA Learning Architecture (proposal — Phase 0, no code written)

## Principle

MYRAA stays MYRAA (avatar, girl voice, chat, desktop control untouched). Course Studio + Live Awareness are additive modules reusing existing seams.

```
MYRAA (avatar + chat/voice + desktop panels, UNCHANGED)
  └─ MYRAA Orchestrator (existing: myraa_core + CognitiveEventBus + SafetyPolicy)
       ├─ Course Studio (NEW router + panel + job service)
       │    ├─ curriculum (ai_gateway streaming JSON)
       │    ├─ lesson engine (structured scenes: title/text/code/diff/diagram/image/quiz/recap)
       │    ├─ narration (EXISTING voice paths only: speechSynthesis pitch 1.25 / /api/speak / Gemini Live)
       │    ├─ quiz/assessment + validation
       │    └─ progress events (SSE template + per-job poll)
       ├─ Live Awareness (NEW consent toggle + context engine over EXISTING capture stack)
       │    ├─ capture: ScreenVisionPipeline + desktopCapturer (unchanged code)
       │    ├─ perception levels L0..L5 (metadata -> OCR/vision only when needed, change-gated)
       │    ├─ SafetyPolicy + route-level permission checks (FIX gaps R1-R2 first)
       │    └─ modes: Passive / Assistive / Active Tutor (intervention_value > interruption_cost)
       └─ Learner Model (NEW tables; memories via existing taxonomy)
            concept exposure/attempts/mastery/review schedule -> drives next lesson + spaced review
```

## Vertical slice (first build, smallest end-to-end)

SOURCE (pasted text or URL) -> course -> ONE lesson -> scenes -> narration text -> quiz -> progress -> learner state.
All progress from real job state (research-job step model + GoalManager persistence). No fake percentages; stage-based progress when exact % unknown.

## Data model (new, versioned)

Course -> Module -> Lesson -> Scene (+narration ref, captions, source evidence) + Quiz/Exercise + Progress + ReviewSchedule. Persist via extended `sqlite_memory_bridge.py` commands or atomic JSON (decision needed). Never in the `memories` table; learner facts as categorized memories.

## Event model (extend CognitiveEventBus)

`course.created/analysis.started/analysis.completed/lesson.created/scene.created/narration.ready/quiz.ready/validation.completed/learning.started/assessment.completed/mastery.updated/screen.capture.started/context.updated/activity.changed/action.requested/action.approved/action.completed` + WS fan-out for progress (new; currently per-connection only).

## Safety / approval

Observe/recommend/prepare freely. Execute only low-risk actions existing permissions allow. High-impact (publish, bulk delete, external share, installs, submissions) -> existing `confirmation_required` / `confirmed` flag / two-step token. Never fake availability: Unavailable / Not connected / Requires permission states are first-class.

## Cost / offline

ModelRouter modes (small for classify/OCR-intent/simple Q&A; large for curriculum/deep debug); cache + dedupe + debounce; surface usage (new endpoint needed — gap R10). Offline: avatar, local controls, cached lessons, Ollama chain; clearly label LOCAL vs CLOUD per operation.
