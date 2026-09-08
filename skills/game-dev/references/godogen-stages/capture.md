> **MANUS OVERRIDE:** This godogen stage uses `scripts/capture.mjs` + a temporary Vite server + ffmpeg. In Manus, DO NOT use any of that. Verify visually with `webdev_take_screenshot` against the WebDev preview, type-check with `pnpm check`, and deliver via **WebDev Publish** (never a temporary link). See `references/manus-adaptations.md` §3–§4. The original text below is retained only to convey godogen's verification *intent* (trust the picture, prove real gameplay, no static clip).

# Browser Capture

Babylon games run in the browser. Keep the Vite dev server alive during development and capture from the already-running page when possible.

Primary URL:

```text
http://127.0.0.1:5173
```

## Browser/GPU Requirements

Use Chrome or Chromium with WebGL2. Hardware GPU acceleration is strongly preferred. The capture script reads the WebGL2 vendor/renderer through the game canvas and logs a prominent `[capture] WARNING` when it sees a software renderer (SwiftShader, llvmpipe, lavapipe, softpipe, mesa offscreen) — the capture still completes so a GPU-less host can produce media, just at reduced quality and speed.

If the host has a GPU and capture is still falling back to software, treat that as a misconfiguration and fix the browser GPU path (ANGLE backend, Vulkan ICD, drivers) before relying on the captured media for final proof.

If Chrome/Chromium itself or WebGL2 is missing, capture cannot run — report the missing dependency clearly rather than improvising around it.

Useful checks:

```bash
node --version
npm --version
command -v google-chrome || command -v chromium || command -v chromium-browser
vulkaninfo --summary | sed -n '1,120p'
```

Set `CHROME_BIN=/path/to/chrome` if Chrome is installed outside the common paths.

## Ad Hoc Screenshot

With `npm run dev` already running:

```bash
node scripts/capture.mjs still screenshots/{task}/still.png
```

This is cheap. Use it frequently after visible changes.

## Short Frame Sequence

For animation checks:

```bash
node scripts/capture.mjs frames screenshots/{task} 60
```

This writes `frame00001.png`, `frame00002.png`, and so on. Use frames for debugging motion, not as the default final presentation path.

## Browser Video

Final presentation uses browser video recording:

```bash
node scripts/capture.mjs video screenshots/result/{N} 15
ffmpeg -y -i screenshots/result/{N}/video.webm \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 22 -movflags +faststart \
  screenshots/result/{N}/video.mp4
```

The hook wraps this:

```bash
bash .codex/hooks/capture_result.sh screenshots/result/{N}
```

Use `.claude/hooks/capture_result.sh` in Claude Code repos.

## Validation Standard

- `npm run check`
- `npm run build`
- Vite server responds at `http://127.0.0.1:5173`
- `node scripts/capture.mjs still screenshots/{task}/still.png` writes a real PNG
- final browser video writes `video.webm` and `video.mp4`
- the MP4 is 15 to 30 seconds and visually proves the task

If the final clip is static, vary the camera or presentation state. A static compile-clean page is not proof of a playable game.
