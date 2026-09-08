# MYRAA UI/UX Research — Cinematic Glassmorphism (Chosen System)

> Research-first per §4 — checked existing ecosystem before building.

## Design System Decision

- **Chosen: Cinematic + Glassmorphism** (not Neo-Brutalism/Fintech/Clay/Neon Velocity)
- **Reason:** MYRAA is futuristic, emotional, AI-focused, 3D companion-driven, sci-fi premium — matches existing `ApexWorld` orb + cyan `#00e5ff` + `build/icon.ico`. Glassmorphism (backdrop-blur, `bg-white/5 border-white/10`) gives depth for HUD without clashing with `three-vrm` avatar; Cinematic adds dramatic spotlight + vignette for status clarity.
- **Tokens:** accent `cyan #00e5ff` tints `rgba(0,229,255,0.15) / 0.3 / 0.6` (from `app/page.tsx` brand pill), spacing scale `4/8/16/24` from `index-DAtgVL5Z.css`, typography `display mono sans` (mixed weights → hierarchy: `text-[10px] mono uppercase tracking-widest` for labels, `text-xs mono` for status).
- **References checked first:** Vapi.ai (voice orb), Aceternity UI BentoGrid/glass card (App Studio `Projects/apex-web/index.html` already uses), Magic UI shimmer, LottieFiles micro-interactions, Rive avatar state machine (existing `assets/thinking.mp4/idle.mp4/talking.mp4` → Rive `IDLE/LISTENING/THINKING/TALKING`).

## Per-Screen Application (explicit)

| Screen | Design system | Why | Key patterns researched 2026 |
|--------|--------------|-----|------------------------------|
| **System** (Desktop Agent + 8 tools) | Glassmorphism + HUD | Needs health visibility (chip `Active/Inactive/Error` not checkmark) + `Streaming FPS: 0.4 → degraded alert` not green dot | AI agent status indicator design — status chip + latency + error inline, self-test button on tab open |
| **Hardware & IoT** (Mobile ADB) | Cinematic card | Battery/model hero + live mirror preview | Device bridge UX — mirrored control with tap/swipe forwarding, consent gate for notifications |
| **Credential Vault** | Glassmorphism secure card | Show Master Identity + service list without exposing secret | Secret manager UX — reveal requires biometric/confirm, no secret in DOM |
| **Plugins** (now 8) | Cinematic dashboard | 8 tiles need uniform health language | Plugin management UX — 3-state card + `Verified 2 min ago` + `Connect` OAuth flow |
| **Teach & Learn** | Glassmorphism step list | Record → step review → confirm | Teach flow — reorder/delete per-step, version list, pre-flight mismatch modal |
| **App Studio** | Aceternity BentoGrid | Website/Mobile cards + Figma/Canva row | Generator UX — template + brand kit preview, real file download link + project link |
| **Memory Core** | Glassmorphism recall cards | Identity/Preferences/Life/Active/Recalls | Memory viz — category chips + `Man. seed` + `Recalled: date` + search |
| **About / Voice** |Minimal HUD | Gemini Live reconnect status | Voice status — `Active/Degraded` + `Microphone: Connected` |

## Animation Purpose (not decoration)

- **Rive:** avatar `idle→listening` on mic active, `thinking` on AI processing (queue), `talking` on TTS, `error` on `1006`, `offline` on `connected:false` — state-driven, one pose not static.
- **Motion (framer):** button hover `scale 1.02`, panel `spring damping 25 stiffness 200` (already in `index-qnLjC2CG.js MA3`), toast `fade` — no animation without feedback purpose.
- **Gate:** `s.animations` toggle in GENERAL settings — respects `prefers-reduced-motion`.

## Verification Checklist (per screen)

1. Launch `MYRAA.exe` (no browser)
2. Open screen, interact (click health ping, connect, draft teach, generate docx)
3. Resize 940→1920, check glass blur + text contrast (caption panel has `bg-white/5` not floating over avatar)
4. Error path: revoke token → `Degraded` + reason shown, delete outside workspace → `CONFIRM_REQUIRED` modal
5. `BUILD_STATUS.md` updated `Last Tested` not just "done"

> No generic dashboard reused — each screen's layout driven by its data shape.
