@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MYRAA AI OS (v5.0 APEX)
cd /d "%~dp0"

echo ===============================================================================
echo                   MYRAA AI OPERATING SYSTEM  ^|  v5.0.0 APEX
echo                   Autonomous 3D Companion    ^|  All Plugins Active
echo ===============================================================================
echo.

if exist "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe" (
    echo [*] Starting installed MYRAA AI OS native window application...
    start "" "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe"
    exit /b 0
)

if exist "%~dp0MYRAA.exe" (
    echo [*] Starting native MYRAA AI OS window application...
    start "" "%~dp0MYRAA.exe"
    exit /b 0
)

echo [!] Could not locate MYRAA.exe. Please run MYRAA-Setup.exe to install.
pause
