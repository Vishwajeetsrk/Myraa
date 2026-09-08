# Game Decomposer

Analyze a game for implementation risks and define verification criteria. Output is `PLAN.md`.

## Runtime Limitations

Babylon output runs in the browser. The pipeline does not ship native or mobile packaging. Browser audio cannot autoplay before a user gesture — interactive games can unlock audio on first input, but a passive presentation video has no gesture and will be silent. If the brief assumes a native build or asks for audio in the final proof clip, drop those parts of the scope and tell the user what was dropped.

## Workflow

1. **Read `reference.png`** — camera angle, scene complexity, entity count, environment scope.
2. **Read the game description** — core technical requirements.
3. **Scan for risks** — identify features needing isolation (see taxonomy below).
4. **Define verification criteria** — risk-specific, general, and final.
5. **Write `PLAN.md`.**

## Risk Taxonomy

### Isolate

Features that fail unpredictably and produce ambiguous errors when mixed with other systems:

- **Procedural generation** — terrain, levels, meshes, dungeon layouts
- **Procedural animation** — runtime bone manipulation, IK, ragdoll blending. Motions jerk, blend weights fight, limbs overshoot.
- **Sprite/character animations** — multi-direction movement, state transitions. Almost always fail first pass: wrong frames for direction, transitions stutter or pop.
- **Complex vehicle physics** — wheel colliders, suspension, drifting, motorcycle balance. Babylon physics plugins (Havok, Cannon, Ammo) differ enough that the wrong choice can derail a task.
- **Custom shaders** — `ShaderMaterial`, `NodeMaterial`, post-process effects, water surfaces, portals, dissolve/distortion
- **Runtime geometry** — destructible environments, CSG operations, mesh deformation, baked-on-demand vertex data
- **Dynamic navigation** — pathfinding adapting to runtime obstacles, crowd simulation, flocking. Babylon ships the `recastjs` plugin but real-time rebuild requires care.
- **Complex camera systems** — third-person with collision avoidance, cinematic rail transitions, pointer-lock first-person, split-screen
- **Pointer lock / first-person controls** — browser pointer-lock API needs a user gesture to engage and silently no-ops in some embed contexts.
- **Imported GLB pipelines** — animation retargeting, morph targets, skeleton mismatches, draco/meshopt compression. Resolve loader extensions before relying on imported rigs.

Everything not listed above goes in the main build — no isolation needed.

## Verification Criteria

Each task gets a **Verify** field inline — what to check after implementation.

**Risk tasks** — target the exact failure mode (e.g., for animations: "every direction plays correct frames, transitions smooth, no pose snapping").

Whenever a requirement mentions smooth motion, state handoff (idle->walk, walk->attack, place/pickup, jump->land), or any runtime transition, the Verify line must name the specific transition to probe dynamically — not "matches reference.png". Reference-match is a static check and cannot see motion-timing bugs.

**Main build** — combine cross-cutting checks with game-specific ones:
- Movement direction matches player input
- Animation direction matches movement direction
- Player input -> character response feels correct
- Physics objects respond to gravity/collision
- UI readable, no overflow or overlap
- No missing textures or obvious fallback materials
- Game-specific checks (e.g., "enemies path around towers," "score increments on pickup")
- No browser console errors during the captured run
- reference.png consistency
- Presentation proof bundle as final deliverable

## Output Format

Produce `PLAN.md`:

````markdown
# Game Plan: {Name}

## Risk Tasks

{Omit entirely if no risks identified.}

### 1. {Risk Feature}
- **Why isolated:** {what makes this algorithmically hard}
- **Approach:** {algorithmic strategy or key constraints — enough for the implementor to know *how*, not just *what*}
- **Verify:** {specific criteria targeting the failure mode}

## Main Build

{What to build — all routine systems. High-level, not implementation recipes.}

- **Assets needed:** {visual assets the game needs — type, approximate size, visual role. Omit if none.}
- **Verify:**
  - {General checks: movement/input/animation alignment, physics, UI, textures}
  - {Game-specific checks}
  - Gameplay flow matches game description
  - No visual glitches, clipping, or placeholder assets
  - No browser console errors during capture
  - reference.png consistency: color palette, scale, camera angle, visual density
  - **Presentation proof bundle:** latest final-attempt folder under `screenshots/result/{N}/`
    - Record from the running Vite dev server at `http://127.0.0.1:5173` through `scripts/capture.mjs video` (Playwright + Chrome/Chromium). Default duration is 15s; extend to 30s only when needed for coverage.
    - `{N}` is a simple integer counter; increment it for each new final attempt
    - Store both `video.webm` (browser recording) and `video.mp4` (ffmpeg re-encode) in that folder
    - **3D:** scripted camera path or orbit, deliberate lighting, post-processing where it earns its cost
    - **2D:** camera pans, zoom transitions, tight viewport framing
    - Output: `screenshots/result/{N}/video.mp4`
````

Include only the relevant 3D/2D presentation requirements.

## What NOT to Include

- Implementation details for routine features (risk tasks need algorithmic specificity — see template)
- Detailed technical specs for routine features
- Micro-tasks for routine features
- Untestable requirements
- Artificial boundaries between routine systems
