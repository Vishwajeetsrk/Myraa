@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MYRAA AI OS (v7.5.0 APEX Master) - Autonomous Companion & Neural Core
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
echo                   MYRAA AI OPERATING SYSTEM  ^|  v7.5.0 APEX Master
echo            Autonomous 3D Companion  ^|  Operator Voice Biometrics
echo                Dynamic Skills Engine  ^|  Original 3D Model Core
echo ===============================================================================
echo.

if exist "C:\Users\Vishwajeet\Music\Myraa\MYRAA.exe" (
    echo [*] Starting installed MYRAA AI OS native application...
    start "" "C:\Users\Vishwajeet\Music\Myraa\MYRAA.exe"
    exit /b 0
)

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

echo [*] Launching MYRAA AI OS Web Interface...
start http://localhost:3000
npm run dev
