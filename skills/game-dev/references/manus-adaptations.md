# Manus Adaptations Layer

This file defines exactly how godogen's canonical pipeline runs inside Manus.
Read it together with `references/godogen-stages/*` (the unmodified godogen
stage instructions). Where this file conflicts with a godogen stage file, this
file wins — because it adapts godogen to the Manus environment.

Layering principle: **React = picture frame, Babylon = canvas, godogen game code = the painting.**

---

## 1. Host shell: WebDev instead of godogen's Vite scaffold

godogen ships its own minimal Vite + `index.html` + `main.ts`. Do NOT use it as
the deployable host. Instead:

1. `webdev_init_project` with scaffold `web-static` (React 19 + Vite + Tailwind + shadcn/ui).
2. Add Babylon to the WebDev project: `pnpm add @babylonjs/core` (and `@babylonjs/loaders` only if loading GLB models). Run `webdev_restart_server` after.
3. Create `client/src/components/GameCanvas.tsx` from `templates/GameCanvas.tsx`.
4. Render `<GameCanvas />` as the ONLY content of the `/` route in `client/src/App.tsx` (remove the demo Home page chrome). The game is full-screen.
5. Put all gameplay in `client/src/game/**` as plain TS classes — zero React coupling. This is where godogen's framework-agnostic modules (GameWorld, Player, ObstacleManager, etc.) live, ported almost verbatim.

### Babylon-in-React safety contract (non-negotiable)
- Initialize the `Engine` exactly once. Guard React 19 StrictMode double-mount with a ref flag (see template).
- `engine.dispose()` on unmount; remove every event listener you added.
- Render loop tied to component lifecycle (`engine.runRenderLoop` started after the scene resolves, stopped via dispose).
- Handle `window.resize` → `engine.resize()`.
- Attach input listeners to the canvas/window and clean them up on unmount.
- `client/src/game/scene.ts` must export `createGameScene(engine, canvas): Promise<GameHandle>` and a `GameHandle` type with `{ scene, dispose() }`.

### Import paths
Import Babylon from deep paths to keep bundles lean, e.g.
`import { Engine } from "@babylonjs/core/Engines/engine";`
`import { Scene } from "@babylonjs/core/scene";`
Use side-effect imports for features actually used (e.g. `@babylonjs/core/Materials/standardMaterial`).

---

## 2. Art step: Manus built-in image generation (MANDATORY — never skip)

godogen's `asset-planner.md` / `asset-gen.md` call paid Gemini / xAI Grok /
Tripo3D CLIs. In Manus those are REPLACED by the built-in `generate` mode. The
art step is mandatory: every game gets real generated art direction, never a
silent "no art" fallback.

Workflow:
1. **visual-target stage** → enter `generate` mode and produce a reference image that defines art direction (palette, mood, perspective, density). Record it in `ASSETS.md`. (Read `references/imagegen` principles for prompt structure.)
2. **asset-gen stage** → for each asset in the plan (sprites, textures, tiles, props, backgrounds, character art, UI art), generate an image in `generate` mode. For transparency, prompt for a clean transparent/cutout background (replaces godogen's rembg step).
3. **Wire assets into the game**:
   - Download/locate the generated PNGs.
   - Upload via `manus-upload-file --webdev path/to/asset.png` → it returns a `/manus-storage/...` URL.
   - Use that returned URL directly as a Babylon texture (`new Texture("/manus-storage/xxx.png", scene)`), sprite, or skybox. NEVER commit large images into the project tree (causes deploy timeouts).
   - Store originals under `/home/ubuntu/webdev-static-assets/`.
4. **3D models (GLB)**: Manus has no built-in image→3D generation equivalent to Tripo3D. Default to **procedural meshes textured with generated images** (boxes/planes/extrusions + generated textures). Only if photoreal 3D models are essential, ask the user to provide a Tripo3D key and then follow godogen's `asset-gen.md` GLB path.

Budget note: godogen gates asset generation behind a "budget". In Manus, treat
the art step as always-on (built-in generation), so generate a sensible, small
asset set by default; scale up only if the user asks.

---

## 3. Verification: webdev_take_screenshot instead of capture.mjs

godogen's `capture.md` uses `scripts/capture.mjs` (Playwright) + a temporary
server. In Manus:
- Use `webdev_take_screenshot` against the WebDev preview to verify the game visually. This honors godogen's core law: **trust the picture, not the code; if a requirement is not visible, it is unfinished.**
- For an autoplay/demo verification, add a `?demo` flag that drives a deterministic AutoPilot (port godogen's demo brain) so screenshots show real gameplay without manual input.
- Type-check with the project's `pnpm check`. Inspect `.manus-logs/*.log` (grep/tail) for runtime errors rather than reading whole files.
- godogen's GPU/software-renderer warning logic does not apply; WebDev preview rendering is sufficient for verification.

---

## 4. Deployment: WebDev Publish ONLY (temporary links forbidden)

This is a hard rule. The final game is delivered through Manus WebDev:
1. `webdev_save_checkpoint` once the game is verified.
2. Tell the user to click **Publish** in the Management UI → the game goes live at `*.manus.space` with managed hosting.
3. NEVER use the `expose` tool or any temporary proxy link as the deliverable. Temporary links are only acceptable for transient internal debugging, never as the handoff.
4. You may share an in-progress version with `manus-webdev://${version_id}` after a successful checkpoint.

---

## 5. Context files (keep godogen fidelity)

Keep these inside the WebDev project root so the pipeline is resumable and faithful:
- `PLAN.md` — tasks + verification criteria + risk slices.
- `STRUCTURE.md` — architecture reference.
- `MEMORY.md` — discoveries, quirks, what worked/failed.
- `ASSETS.md` — generated-asset manifest with prompts + `/manus-storage/...` URLs.

On resume: if `PLAN.md` exists, read PLAN/STRUCTURE/MEMORY/ASSETS and skip to task execution (same as godogen).
