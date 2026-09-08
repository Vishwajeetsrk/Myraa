# Task Execution

> **MANUS OVERRIDE:** Same inner loop, but the project is a WebDev React app. Edit under `client/src/game/**`, rely on Vite HMR, verify with `webdev_take_screenshot` (not `capture.mjs`), type-check with `pnpm check`, inspect `.manus-logs/*.log` via grep/tail. See `references/manus-adaptations.md` §3.

Implementation workflow for Babylon.js feature work after scaffold is in place.

## Planning Each Task

- Read `STRUCTURE.md`, `package.json`, `src/game/scene.ts`, `architecture.md`, `scene-generation.md`, and `quirks.md` before touching code.
- Use `babylon-help` for Babylon APIs, loaders, exact import paths, Vite behavior, browser capture, and rendering setup.
- Decide the concrete scope: state owner, modules/files, runtime assets, verification commands, and browser evidence.
- Preserve dependency versions unless the task is an engine/tool migration.
- Keep `npm run dev` running at `http://127.0.0.1:5173` when possible.

## Default Loop

1. Start or reuse `npm run dev`.
2. Implement the next visible/playable slice.
3. Let Vite hot reload the scene.
4. Capture an ad hoc screenshot when the change is visual:
   ```bash
   node scripts/capture.mjs still screenshots/{task}/still.png
   ```
5. Run `npm run check`.
6. Fix TypeScript and runtime console errors before tuning.
7. Run `npm run build` once the slice is clean.
8. Update `STRUCTURE.md` if module ownership, state, asset contracts, or verification changed.

For long-running visible work, capture several frames:

```bash
node scripts/capture.mjs frames screenshots/{task} 30
```

## Browser Runtime Standard

The browser path is the runtime. Do not treat a TypeScript build as sufficient proof.

Required for browser validation:

- Chrome/Chromium executable is available or `CHROME_BIN` points to one.
- WebGL2 is available on the game canvas.
- Hardware GPU acceleration is preferred. The capture script logs a `[capture] WARNING` when WebGL2 lands on a software renderer (SwiftShader, llvmpipe, lavapipe, etc) but still completes — on a GPU-equipped host, treat that warning as a misconfiguration to fix; on a GPU-less host the run is still valid at reduced quality.
- Vite browser console forwarding stays enabled so runtime errors appear in the terminal.

## Assets

Use Vite asset URLs:

```ts
import heroUrl from "../assets/models/hero.glb?url";
```

Then load with Babylon:

```ts
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "../app/babylon";

await SceneLoader.ImportMeshAsync("", "", heroUrl, scene);
```

Use `public/**` only for files that need stable direct URLs. Imported runtime assets should normally live under `src/assets/**`.

## Final Proof

Final Babylon proof uses browser video recording:

```bash
bash .codex/hooks/capture_result.sh screenshots/result/{N}
```

For Claude Code repos, use `.claude/hooks/capture_result.sh`.

The result folder must contain `video.webm` and `video.mp4`. The MP4 should be 15 to 30 seconds and show task-relevant behavior for the full duration. If the scene is static, make the capture camera or scripted presentation vary the view.

## Stop Conditions

- `npm run check` passes.
- `npm run build` passes.
- The Vite dev server runs at `http://127.0.0.1:5173`.
- Browser validation confirms WebGL2 hardware rendering.
- Visual requirements are verified from screenshot or video.
- `STRUCTURE.md` matches the shipped runtime shape.
