# Scene Generation

`src/game/scene.ts` is the main game implementation entry. It must export:

```ts
export async function createScene(app: BabylonApp): Promise<Scene>
```

`createScene` should create a fresh `Scene` every time. Hot reload calls it repeatedly while the `Engine` and canvas stay alive.

## Ownership Pattern

Small games can keep scene setup and a few classes in `src/game/scene.ts`. Move code out when ownership becomes clearer:

```text
src/game/world/GameWorld.ts
src/game/actors/Player.ts
src/game/actors/Enemy.ts
src/game/camera/CameraController.ts
src/game/ui/UIController.ts
```

Gameplay objects may own Babylon meshes, materials, animations, input state, and cleanup. Keep object-specific behavior with the object. Keep broad world rules in `GameWorld` or equivalent.

## Update Loop

Prefer one high-level scene update hook that delegates to owned objects:

```ts
scene.onBeforeRenderObservable.add(() => {
  const delta = scene.getEngine().getDeltaTime() / 1000;
  world.update(delta);
});
```

Dispose scene-owned observers, meshes, materials, textures, and sounds through Babylon scene disposal whenever possible. If a gameplay object attaches DOM/window listeners, give it an explicit `dispose()`.

## Camera

Use Babylon cameras directly. `ArcRotateCamera` is a good default for inspection and generated scenes; use `UniversalCamera` or custom camera controllers for first-person or character-driven games.

Attach controls to `app.canvas` only for interactive camera modes. Automated presentation paths should use deterministic camera motion rather than live pointer input.

## Input

Use `InputState` or a game-specific `InputManager` to expose semantic actions. Do not spread raw key checks through unrelated classes.

## UI

Use DOM HUD (`#hud`) for text overlays, menus, and conventional browser UI. Use Babylon GUI or mesh text only when UI must live in the 3D world.

## Asset Loading

Keep asset URL imports in `src/game/assets.ts`:

```ts
import heroUrl from "../assets/models/hero.glb?url";

export const assets = {
  hero: heroUrl
} as const;
```

Load GLB/GLTF assets with `@babylonjs/loaders/glTF` imported once in the module that loads them.

## Presentation Mode

For final video, add deterministic presentation behavior when needed:

- scripted camera orbit or path
- autoplaying interaction sequence
- seeded spawn pattern
- visible state transitions

Do not depend on manual input to prove the final behavior.
