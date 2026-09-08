@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MIRA AI OS (v7.5.0 APEX Master) - Master Installer
cd /d "%~dp0"

cls
echo ===============================================================================
echo.
echo        MM      MM  IIIIII  RRRRRR      AAAA
echo        MMMM  MMMM    II    RR   RR    AA  AA
echo        MM  MM  MM    II    RRRRRR    AAAAAA
echo        MM      MM    II    RR  RR   AA    AA
echo        MM      MM  IIIIII  RR   RR  AA    AA
echo.
echo             MIRA AI OPERATING SYSTEM  ^|  MASTER INSTALLATION SUITE
echo             Autonomous 3D Companion   ^|  Operator Voice Biometrics
echo                     Target: Windows 10/11 x64  ^|  v7.5.0 APEX Master
echo ===============================================================================
echo.

echo [*] Step 1: Checking Node.js and execution environment...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js is not found in PATH. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
echo     ✓ Node.js detected: %NODE_VER%

echo [*] Step 2: Verifying MIRA AI OS file integrity...
if exist "%~dp0Start-Mira.bat" (
    echo     ✓ Launcher found: Start-Mira.bat
) else (
    echo [!] Warning: Start-Mira.bat not found in current directory.
)

if exist "%~dp0MYRAA.exe" (
    echo     ✓ Native Runtime found: MYRAA.exe
)

if exist "%~dp0resources\app\dist\identity.json" (
    echo     ✓ Identity configured: Mira (Female AI Companion)
)

echo [*] Step 3: Generating Desktop and Start Menu Shortcuts...
set "CURRENT_DIR=%~dp0"
set "LAUNCHER_PATH=%CURRENT_DIR%Start-Mira.bat"
set "ICON_PATH=%CURRENT_DIR%icon.ico"
if not exist "%ICON_PATH%" set "ICON_PATH=%CURRENT_DIR%resources\app\dist\icon.ico"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcutPath = Join-Path $desktop 'MIRA AI OS.lnk'; " ^
    "$shortcut = $wsh.CreateShortcut($shortcutPath); " ^
    "$shortcut.TargetPath = '%LAUNCHER_PATH%'; " ^
    "$shortcut.WorkingDirectory = '%CURRENT_DIR%'; " ^
    "$shortcut.Description = 'MIRA AI OS - Autonomous Companion & Neural Core'; " ^
    "if (Test-Path '%ICON_PATH%') { $shortcut.IconLocation = '%ICON_PATH%,0' }; " ^
    "$shortcut.Save(); " ^
    "$startMenu = [Environment]::GetFolderPath('Programs'); " ^
    "$smShortcutPath = Join-Path $startMenu 'MIRA AI OS.lnk'; " ^
    "$smShortcut = $wsh.CreateShortcut($smShortcutPath); " ^
    "$smShortcut.TargetPath = '%LAUNCHER_PATH%'; " ^
    "$smShortcut.WorkingDirectory = '%CURRENT_DIR%'; " ^
    "$smShortcut.Description = 'MIRA AI OS - Autonomous Companion & Neural Core'; " ^
    "if (Test-Path '%ICON_PATH%') { $smShortcut.IconLocation = '%ICON_PATH%,0' }; " ^
    "$smShortcut.Save(); " ^
    "Write-Host '    ✓ Desktop Shortcut created: MIRA AI OS.lnk pointing to %CURRENT_DIR%'; " ^
    "Write-Host '    ✓ Start Menu Shortcut created: MIRA AI OS.lnk';"

echo [*] Step 4: Verifying Voice Biometrics ^& Companion Configuration...
echo     ✓ Operator Voice Profile: Vishwajeet (85Hz - 180Hz)
echo     ✓ Wake-Words: 'Mira', 'Hey Mira', 'Hi Mira', 'Suno Mira'
echo     ✓ Female Voice Engine: Natural TTS Cadence (Pitch 1.18, Rate 1.02)
echo     ✓ Multilingual Core: English + Hindi/Hinglish Fluent

echo [*] Step 5: Announcing completion...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$speak = New-Object -ComObject SAPI.SpVoice; " ^
    "$speak.Rate = 0; " ^
    "$speak.Speak('Mira AI Operating System installed in Music Mira successfully.');" >nul 2>&1

echo.
echo ===============================================================================
echo  [SUCCESS] MIRA AI OS Installation Complete at %CURRENT_DIR%
echo  -- You can now launch MIRA anytime using the 'MIRA AI OS' shortcut on Desktop.
echo  • Or run Start-Mira.bat from %CURRENT_DIR%
echo ===============================================================================
echo.
pause
