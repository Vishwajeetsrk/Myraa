@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MIRA AI OS (v7.5.0 APEX Master) - Autonomous Companion & Neural Core
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
echo                    MIRA AI OPERATING SYSTEM  ^|  v7.5.0 APEX Master
echo            Autonomous 3D Companion  ^|  Operator Voice Biometrics
echo                  28 Autonomous Agents  ^|  Cyberpunk HUD Cockpit
echo ===============================================================================
echo.

if exist "%~dp0MYRAA.exe" (
    echo [*] Launching MIRA Native Desktop Runtime...
    start "" "%~dp0MYRAA.exe"
    exit /b 0
)

if exist "%~dp0resources\app\dist\server.cjs" (
    echo [*] Launching MIRA Backend Engine...
    node "%~dp0resources\app\dist\server.cjs"
    exit /b 0
)

echo [!] Could not locate MYRAA.exe in %~dp0
pause
