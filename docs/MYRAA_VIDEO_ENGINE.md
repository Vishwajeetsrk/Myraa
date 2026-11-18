# MYRAA Video Intelligence Engine

Status: **implemented core (v9.8.0 work, not in the v9.7.0 installer)** — source version 9.7.0 at time of writing.

Module: `resources/app/dist/video_engine.cjs` · Tests: `tests/test_video_engine.cjs` (17 checks, all real ffmpeg/ffprobe) · Planned API mount: `/api/video`.

## Truth contract

No operation reports success until the output file **exists** and `ffprobe` parses it. A failed ffmpeg exit, a missing output, or an unparseable probe is returned as an honest error code (`FFMPEG_FAILED`, `OUTPUT_NOT_FOUND`, `OUTPUT_INVALID`). Capabilities that need a vision or ASR model are reported as `NOT_IMPLEMENTED`, never as working.

## Runtime dependency

- `ffmpeg` and `ffprobe` are resolved from `PATH`, or from `MYRAA_FFMPEG_PATH` / `MYRAA_FFPROBE_PATH`.
- `status()` version-probes both binaries. If either is missing it returns `DEPENDENCY_MISSING` with the exact override hint.
- Verified in this environment via WinGet-provided binaries; libx264 + AAC encoding confirmed.

## Implemented operations (verified against a generated test clip)

| Operation | Method | Validation |
|---|---|---|
| `status()` | real `ffmpeg -version` / `ffprobe -version` | version strings returned |
| `probe(input)` | `ffprobe -show_streams -show_format` (JSON) | duration, codec, resolution, fps, audio stream |
| `validate(file)` | ffprobe parse of the produced file | streams > 0, real size/duration |
| `analyze(input)` | ffmpeg `select=gt(scene,...)` + `silencedetect` | real scene timestamps + silence ranges -> timeline |
| `thumbnail(input, t)` | ffmpeg single-frame extract | output validated as real image |
| `trim(start,end)` | ffmpeg `-ss` / `-t` + re-encode | output duration within requested range |
| `split` | two `trim` operations to distinct outputs | each output validated |
| `concat(inputs)` | ffmpeg concat demuxer | output validated |
| `crop` / `resize` / `rotate` | ffmpeg filter chain | output validated |
| `speed(rate)` | `setpts` + `atempo` | output validated; audio-sync warning surfaced |
| `mute` | `-an` | probe confirms no audio stream |

## Implemented timeline semantics

`analyze()` builds segments from actual scene-change timestamps and silence regions detected by ffmpeg. Labels are deliberately neutral (`Scene 1`, `Low/no audio`) and each segment carries its detection source. This avoids inventing semantic descriptions the engine cannot yet produce.

## Explicitly NOT IMPLEMENTED (no fake claims)

- Object / person / UI-element detection in frames — requires a vision model adapter.
- Speech transcription — requires an ASR adapter.
- Subtitle/caption generation — depends on speech transcription.
- Semantic scene labeling ("Introduction", "Demonstration") — requires a classifier.
- Text/image/logo overlays, transitions, background music, voiceover — planned, not built.
- Rendering approval gate and persistent job receipts — planned (route is read/compute-only today).

## Path and injection safety

- Inputs must exist, be files, and carry a supported video extension; otherwise `INPUT_NOT_FOUND` / `UNSUPPORTED_INPUT`.
- ffmpeg/ffprobe are invoked with argument arrays via `spawnSync` (no shell), so user strings cannot inject commands.
- Outputs default to `<MYRAA_DATA_DIR>/video-workspace` with unique names. Explicit outputs require a supported extension and refuse to overwrite unless `overwrite: true`.

## Spec coverage

Sections 11 (Video Intelligence Engine input/analyze/edit) and 12 (Video -> Understanding -> Editing) are partially covered: real probe/analyze/timeline/trim/concat/crop/resize/rotate/speed/mute/thumbnail with output validation. The semantic analysis and richer editing operations above remain honest gaps with named dependencies.
