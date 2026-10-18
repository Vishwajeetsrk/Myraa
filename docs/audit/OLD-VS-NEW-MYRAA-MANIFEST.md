# OLD vs NEW MYRAA Forensic Manifest & Freeze

**Audit Date**: 2026-09-12  
**Target Platform**: Windows 11 / Windows 10 (x64)  
**Old Reference (Known-Good)**: `C:\Users\Vishwajeet\Videos\MYRAA` (READ-ONLY)  
**New Build (Under Repair)**: `C:\Users\Vishwajeet\Music\Myraa` (Workspace)  

---

## 1. Executive Summary

This manifest freezes and records a complete forensic baseline of both installations.
The **Known-Good Reference** (`C:\Users\Vishwajeet\Videos\MYRAA`) represents a frozen production deployment (v1.0.1 packaging) where the 3D avatar (Evelyn) and basic voice/chat were observed working.
The **New Build** (`C:\Users\Vishwajeet\Music\Myraa`) incorporates major system capabilities (v9.3.0, 442 universal skills, 64 desktop automation tools, v7.0 Professional Word Engine, Autonomous Coding Agent), but encountered regressions on launch due to unhandled persistence errors and intrusive DOM script additions.

---

## 2. Character 3D Asset Hash Comparison

| Asset Description | Old Reference Path (`Videos\MYRAA`) | New Build Path (`Music\Myraa`) | Size (Bytes) | SHA-256 Hash | Match |
|---|---|---|---|---|---|
| **Evelyn Model PMX** | `resources/app/assets/characters/evelyn/model.pmx` | `resources/app/dist/assets/characters/evelyn/model.pmx` | 2,986,453 | `804e92823135bd7dc920ccca16a01f5d61a63f1fb5f4d9cbcb7b3822f32c79a0` | **IDENTICAL** |
| **Texture 0 (衣 - Outfit)** | `.../textures/tex_0.png` | `.../textures/tex_0.png` | 2,977,990 | `0663adab4ddbe9edb2043dca83a244a518a03c02e936cf7209962d7413ec9e73` | **IDENTICAL** |
| **Texture 1 (Skin)** | `.../textures/tex_1.bmp` | `.../textures/tex_1.bmp` | 3,126 | `02d7360ca41412d8a7d44f9930d73c700668511afdaad6b19976d09d3b477f99` | **IDENTICAL** |
| **Texture 2 (Face/Eyes)** | `.../textures/tex_2.png` | `.../textures/tex_2.png` | 1,802,951 | `819d0534bda6fbc8cdebc87ee9d0e87e8cd9d9685d80601a1994f8b6dafb784f` | **IDENTICAL** |
| **Texture 3 (Toon Defo)** | `.../textures/tex_3.bmp` | `.../textures/tex_3.bmp` | 822 | `b85e0fe1a6572e90f2305537e2da0cfbbd2b37ba4ef73ff4672e81fc06b72a6a` | **IDENTICAL** |
| **Texture 4 (Spa 2)** | `.../textures/tex_4.bmp` | `.../textures/tex_4.bmp` | 327,414 | `d512a84d4375084918f6c4be09f5fa44654922650041d5b3d07747e924a6ef53` | **IDENTICAL** |
| **Texture 5 (衣2 - Clothes 2)**| `.../textures/tex_5.png` | `.../textures/tex_5.png` | 2,750,216 | `17c573b8394e3b44e07814e115cafad9da431c5bda36f6a1e1031be76caa932d` | **IDENTICAL** |
| **Texture 6 (Spa Heisi)** | `.../textures/tex_6.png` | `.../textures/tex_6.png` | 209,538 | `e5a6aa60c915fcfbf0d35d21798ff1fbb022513fdf178f56efc58efb132a0b1f` | **IDENTICAL** |
| **Texture 7 (Hair Acc)** | `.../textures/tex_7.jpg` | `.../textures/tex_7.jpg` | 3,178 | `c9705a305fce9a557b7f14120ec292db2142e88a09f87c9fbbdb200d7fbcc0ea` | **IDENTICAL** |
| **Texture 8 (Hair)** | `.../textures/tex_8.bmp` | `.../textures/tex_8.bmp` | 3,126 | `02d7360ca41412d8a7d44f9930d73c700668511afdaad6b19976d09d3b477f99` | **IDENTICAL** |
| **Textures Mapping JSON** | `.../textures.json` | `.../textures.json` | 418 | Structure & Mappings 100% Identical | **MATCH** |

> [!NOTE]
> **Forensic Finding**: The character model `model.pmx` and all 9 textures in the new version are 100% authentic and uncorrupted. The missing character in the screenshot was **NOT** an asset corruption issue.

---

## 3. Core Software & Bundle Comparison

| Component | Old Reference (`Videos\MYRAA`) | New Build (`Music\Myraa`) | Differences & Forensic Analysis |
|---|---|---|---|
| **`index.html`** | 547 bytes | 545 bytes | Identical Vite HTML entry; loads bundle cleanly without intrusive injected addon scripts |
| **`index-qnLjC2CG.js`** | 518,585 bytes | 535,951 bytes | New build adds voice threshold tuning (`voiceThreshold=.005`), expanded capability panels, zero emojis |
| **`three-BBlFD6pU.js`** | 482,080 bytes | 482,080 bytes | **Byte-for-byte identical** Three.js WebGL & MMD physics engine |
| **`index-DAtgVL5Z.css`** | 81,347 bytes | 81,347 bytes | **Byte-for-byte identical** Glassmorphism styling tokens and CSS classes |
| **`character-C0yD4mYn.js`**| 134,715 bytes | 134,716 bytes | Identical Three.js MMD character loader and bone/viseme animation logic (CRLF normalization difference) |
| **`server.cjs`** | 320,941 bytes (v1.0.1) | 427,103 bytes (v9.3.0) | New build includes Word Engine, Autonomous Coding Agent, 442 Universal Skills, Dual Live/REST Chat, and Atomic Persistence |

---

## 4. Packaging, Run-Time & Installer Baseline

| Architecture Element | Old Reference (`Videos\MYRAA`) | New Build (`Music\Myraa`) |
|---|---|---|
| **Product Version** | 1.0.1 | 9.3.0 |
| **Desktop Shell** | Electron 31.7.7 | Electron 31.7.7 |
| **Installer Technology** | NSIS (`MYRAA-Setup-1.0.1.exe`) | NSIS (`MYRAA-Setup-9.3.0.exe`, 204 MB) |
| **Install Target** | `%LOCALAPPDATA%\Programs\MYRAA` | `%LOCALAPPDATA%\Programs\MYRAA` |
| **User Data Store** | `%APPDATA%\MYRAA` | `%APPDATA%\MYRAA AI OS` |
| **Single Instance Lock** | Handled via `main.cjs` | Handled via `main.cjs` (`app.requestSingleInstanceLock()`) |
| **Process Tree Cleanup** | `taskkill /T /F` on quit | `taskkill /T /F` on quit |
