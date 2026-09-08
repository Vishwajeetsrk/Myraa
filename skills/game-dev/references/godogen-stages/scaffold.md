# Babylon Scaffold

> **MANUS OVERRIDE:** Do NOT create godogen's standalone Vite/index.html/main.ts shell. The host is a Manus **WebDev** React project: `webdev_init_project`, `pnpm add @babylonjs/core`, then mount the full-screen `GameCanvas.tsx` (see `templates/GameCanvas.tsx`) as the `/` route. Gameplay still lives in framework-agnostic TS under `client/src/game/**`, matching this stage's intent. See `references/manus-adaptations.md` §1.

Create or refresh a Babylon.js + TypeScript + Vite project shell. This defines the runtime entrypoints and hot-reload contract; gameplay generation fills in `src/game/**`.

## Workflow

1. Check `node --version` and `npm --version`.
2. Fresh project: use the published scaffold files already present in the repo root, or recreate the same file set if the directory was wiped.
3. Existing Babylon project: preserve package name and dependency versions unless the user asked for a migration. Preserve `package-lock.json` when it already matches the manifest.
4. Keep the baseline contract:
   - `index.html` contains `canvas#game-canvas` and `div#hud`.
   - `src/main.ts` creates one `BabylonApp`, loads `createScene`, and listens for `godogen:scene-change`.
   - `src/app/BabylonApp.ts` owns the Babylon `Engine` lifecycle.
   - `src/app/babylon.ts` is the project import surface for Babylon symbols.
   - `src/game/scene.ts` exports `createScene(app)`.
   - `src/game/assets.ts`, `input.ts`, and `state.ts` are small helpers, not mandatory frameworks.
   - `scripts/capture.mjs` captures browser screenshots/video through Chrome/Chromium.
5. Run `npm install` if `node_modules/` is missing or `package-lock.json` is stale.
6. Run `npm run check`.
7. Run `npm run build`.
8. Start `npm run dev` and keep it running when possible.
9. Verify the browser at `http://127.0.0.1:5173` with `node scripts/capture.mjs still screenshots/scaffold.png`.

If Chrome/Chromium or WebGL2 is unavailable, stop and report the missing dependency. Hardware GPU is preferred — the capture script warns prominently when it falls back to a software renderer but still produces the capture, so a GPU-less host can iterate at reduced quality.

## Baseline Files

```text
index.html
package.json
tsconfig.json
vite.config.ts
scripts/capture.mjs
src/main.ts
src/style.css
src/app/BabylonApp.ts
src/app/babylon.ts
src/game/scene.ts
src/game/assets.ts
src/game/input.ts
src/game/state.ts
src/assets/models/
src/assets/textures/
src/assets/audio/
src/assets/shaders/
public/
```

The current baseline package versions are:

```json
{
  "@babylonjs/core": "^9.8.0",
  "@babylonjs/loaders": "^9.8.0",
  "playwright-core": "^1.60.0",
  "typescript": "^6.0.3",
  "vite": "^8.0.13"
}
```

These versions were checked against npm during the Babylon source update. For a new project, use the current source scaffold. For an existing project, avoid opportunistic dependency churn.

## Hot Reload Contract

`vite.config.ts` installs the `godogen-babylon-reload` plugin:

```text
src/game/**     -> custom godogen:scene-change, recreate Scene only
src/assets/**   -> custom godogen:scene-change, recreate Scene only
src/app/**      -> full browser reload
public/**       -> full browser reload
index.html      -> full browser reload
vite.config.ts  -> full browser reload
```

The engine and canvas persist across scene reloads. `createScene(app)` must create a fresh `Scene` and leave cleanup to `BabylonApp.load`, which disposes the previous scene after the new one is ready.

## STRUCTURE.md

Write `STRUCTURE.md` in full. Start with this shape:

````markdown
# {Project Name}

## Runtime

- Babylon.js {version from package.json}
- TypeScript + Vite
- Browser URL: `http://127.0.0.1:5173`
- Dimension: 3D

## App Entry

- `index.html` -> `src/main.ts`
- `src/main.ts` -> creates `BabylonApp`, loads `createScene(app)`, starts render loop, handles scene hot reload
- `src/app/BabylonApp.ts` -> owns `Engine`, active `Scene`, resize, disposal
- `src/app/babylon.ts` -> Babylon import barrel

## Game Entry

- `src/game/scene.ts` -> exports `createScene(app)`
- `src/game/assets.ts` -> imported asset URLs
- `src/game/input.ts` -> optional input helper
- `src/game/state.ts` -> optional state helper

## Planned Modules

- `GameWorld` -> active actors, spawning, high-level rules
- `CameraController` -> camera behavior
- `UIController` -> HUD and menus through DOM or Babylon GUI

## Assets

- Runtime imports: `src/assets/**`
- Stable direct URLs: `public/**`

## Verification

- `npm run check`
- `npm run build`
- `npm run dev`
- browser screenshot/video capture through `scripts/capture.mjs`
````

Keep `STRUCTURE.md` structural. Do not turn it into a task log.
