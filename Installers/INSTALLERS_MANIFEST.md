# AI OS Master Installers Archive & Version Manifest

This archive consolidates all installer variants, deployment scripts, and runtime packages for **MYRAA AI OS** and **JARVIS AI OS** across all development milestones.

---

## 🌸 MYRAA AI OS (3D Female Companion & Voice Biometrics)

- **Root Location**: `C:\Users\Vishwajeet\Music\Mira` *(alias: `C:\Users\Vishwajeet\Music\Myraa`)*
- **Interface**: Original 3D Character Girl Avatar (Three.js / VRM Model), Real Navigation Modules, Voice Biometrics
- **Skills Active**: 515 Universal Skills + 483 Cognitive Dynamic Skills
- **Desktop Shortcut**: `MYRAA AI OS.lnk` -> points to `C:\Users\Vishwajeet\Music\Mira\Start-Myraa.bat`

| File Name | Version | Architecture | Description | Execution Mode |
|:---|:---:|:---:|:---|:---|
| **`MYRAA-Setup.exe`** | v5.0.0 | Windows x64 | Base Native Desktop Installer (Electron/Tauri Runtime) | Double-click to install base app |
| **`MYRAA-Upgrade-Setup.exe`** | v5.2.0 | Windows x64 | APEX Upgrade Installer with 18 engines & dynamic skills | Double-click to upgrade |
| **`MYRAA-Setup-New.exe`** | v5.1.0 | Windows x64 | Lightweight Native Setup Executable | Double-click to install |
| **`Install-Myraa.bat`** | v5.2.0 | Windows BAT | Master Interactive Installer (shortcuts & voice profile) | Double-click or run from CMD |
| **`install_myraa.vbs`** | v5.2.0 | Windows VBS | Silent Headless Background Installer | Double-click to run silently |
| **`Install-MYRAA-Windows11.bat`** | v5.0.0 | Windows BAT | Windows 11 Specialized Environment Installer | Double-click to configure |
| **`MYRAA-Upgrade-Installer.cs`** | v5.2.0 | .NET C# Source | Automated C# Patch, Verification & Registry Engine | Compile via `csc.exe` or .NET |
| **`Start-Myraa.bat`** | v5.2.0 | Windows BAT | Direct Instant Runtime Launcher | Double-click to launch |

---

## 👑 JARVIS AI OS (Autonomous 18-Agent Operating System)

- **Root Location**: `D:\Team of Vishwajeet`
- **Interface**: WebGL 3D Constellation Cockpit, Career OS 2.0, App Studio, 18-Agent Workforce
- **Skills Active**: 481+ Autonomous Ingested Skills (including all copied from ASTRA pack)
- **Desktop Shortcut**: `JARVIS AI OS.lnk` -> points to `D:\Team of Vishwajeet\Start-Jarvis.bat`
- **Dynamic Port Resolution**: Automatically detects port 3000; if in use by MYRAA, seamlessly binds to port 3005

| File Name | Version | Architecture | Description | Execution Mode |
|:---|:---:|:---:|:---|:---|
| **`Install-Jarvis.bat`** | v5.2.0 | Windows BAT | Master Interactive Installer (shortcuts, fleet verification) | Double-click or run from CMD |
| **`install_jarvis.vbs`** | v5.2.0 | Windows VBS | Silent Headless Background Installer | Double-click to run silently |
| **`Start-Jarvis.bat`** | v5.2.0 | Windows BAT | Direct Runtime Launcher (dynamic port 3000/3005) | Double-click to boot JARVIS |

---

## 🚀 Dual-Run Guarantee

Both systems can run simultaneously without any port collisions:
1. **MYRAA AI OS** binds to port `3000` (serving the 3D girl avatar companion, speech synthesis, and local cognition).
2. **JARVIS AI OS** automatically detects MYRAA and binds to port `3005` (serving the 18-agent fleet and Next.js web application).
3. Both desktop shortcuts (`MYRAA AI OS` and `JARVIS AI OS`) are independent, fully functional, and verified.
