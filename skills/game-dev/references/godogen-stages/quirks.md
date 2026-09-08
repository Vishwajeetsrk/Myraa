# Babylon And Browser Gotchas

- Import Babylon symbols from `src/app/babylon.ts` unless you are deliberately adding a new export there.
- Import loaders explicitly. GLB/GLTF loading needs `import "@babylonjs/loaders/glTF";`.
- Vite asset imports should use `?url` for files that Babylon loads by URL.
- Do not put runtime-loaded source assets in `public/**` unless they need stable direct URLs. Prefer `src/assets/**`.
- `createScene(app)` must return a new `Scene`; hot reload disposes the previous scene after the replacement is ready.
- Window, document, pointer-lock, and gamepad listeners are not disposed by Babylon scene disposal. Own and remove them explicitly.
- `scene.onBeforeRenderObservable.add(...)` observers attached to the scene are cleaned up when the scene is disposed.
- Browser audio usually needs a user gesture before playback. Design menus or first input to unlock audio when needed.
- Vite dev server port is strict. If `5173` is occupied, stop the stale server instead of silently switching URLs, unless the user asks for another port.
- Browser console errors are runtime failures. Vite forwards warnings/errors to the server terminal; read them.
- Hardware WebGL2 matters. The capture script warns but does not abort on software renderers — on a host with a GPU, a `[capture] WARNING` about SwiftShader/llvmpipe/lavapipe means the browser is misconfigured and the GPU path needs to be fixed before the run can be trusted as final proof.
