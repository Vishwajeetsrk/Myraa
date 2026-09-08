@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MYRAA AI OS (v5.2 APEX) - Autonomous Companion & Neural Core
cd /d "%~dp0"

cls
echo ===============================================================================
echo.
echo        MM      MM  YY      YY  RRRRRR      AAAA      AAAA
echo        MMMM  MMMM   YY    YY   RR   RR    AA  AA    AA  AA
echo        MM  MM  MM    YYYYYY    RRRRRR    AAAAAA    AAAAAA
echo        MM      MM      YY      RR  RR   AA    AA  AA    AA
echo        MM      MM      YY      RR   RR  AA    AA  AA    AA
echo.
echo                   MYRAA AI OPERATING SYSTEM  ^|  v5.2.0 APEX
echo            Autonomous 3D Companion  ^|  Operator Voice Biometrics
echo                Dynamic Skills Engine  ^|  Original 3D Model Core
echo ===============================================================================
echo.

if exist "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe" (
    echo [*] Starting installed MYRAA AI OS native window application...
    start "" "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe"
    exit /b 0
)

if exist "%~dp0MYRAA.exe" (
    echo [*] Launching MYRAA Native Desktop Runtime...
    start "" "%~dp0MYRAA.exe"
    exit /b 0
)

if exist "%~dp0resources\app\dist\server.cjs" (
    echo [*] Launching MYRAA Backend Engine...
    node "%~dp0resources\app\dist\server.cjs"
    exit /b 0
)

echo [!] Could not locate MYRAA.exe.
pause
