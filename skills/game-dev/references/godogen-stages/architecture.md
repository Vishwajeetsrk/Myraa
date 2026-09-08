# Babylon Architecture

Use an OOP-first, composition-friendly architecture by default.

Babylon.js owns rendering, scene graph, cameras, lights, materials, animation, audio integration, input observables, loaders, and physics integration. It is not the gameplay architecture.

Preferred ownership:

```text
Gameplay objects own Babylon nodes.
Babylon nodes provide rendering, transforms, collisions, animation, and engine integration.
```

Use objects such as `Player`, `Enemy`, `Projectile`, `Weapon`, `Door`, `Pickup`, `Spawner`, `Level`, and `GameWorld` when the game earns them. They may own Babylon meshes, state, behavior, and cleanup.

Use composition for reusable behavior:

```text
Health
Inventory
WeaponHandling
Interactable
Damageable
Lifetime
AIBehavior
```

Avoid deep inheritance. Avoid hiding Babylon behind a heavy fake-engine abstraction. Also avoid putting core gameplay rules into mesh metadata, scattered observables, or anonymous callbacks.

ECS is not the default. Use small data-oriented systems only for dense repeated simulation such as bullets, particles, collectibles, boids, crowds, or grid simulations. Do not convert the whole game to ECS unless the brief strongly justifies it.

Common top-level objects may include `BabylonApp`, `SceneManager`, `GameWorld`, `AssetManager`, `InputManager`, `AudioManager`, `PhysicsManager`, `CameraController`, `UIController`, `EventBus`, and `DebugTools`. Create only the ones the game needs.

Use semantic input actions rather than raw key checks spread across gameplay code. Keep UI separate from core gameplay rules. Represent important modes explicitly with state machines or equivalent state when behavior depends on modes.

Scaling rule:

- Small game -> compact scene module plus a few local classes.
- Mid-size game -> objects, composition, factories, focused services, and clear world ownership.
- Larger game -> feature modules, data-driven configuration, disciplined asset ownership, and targeted data systems where scale requires them.
