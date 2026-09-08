@echo off
setlocal enabledelayedexpansion

cd /d "d:\Team of Vishwajeet\MYRAA"

:: 1. Check if MYRAA window is already active
tasklist /fi "imagename eq MYRAA.exe" 2>nul | findstr /i "MYRAA.exe" >nul 2>&1
if not errorlevel 1 (
    exit /b 0
)

:: 2. Launch Installed MYRAA or Local MYRAA
if exist "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe" (
    cd /d "%LOCALAPPDATA%\Programs\MYRAA-AI-OS"
    start "" "%LOCALAPPDATA%\Programs\MYRAA-AI-OS\MYRAA.exe"
    exit /b 0
)

if exist "%~dp0..\MYRAA\MYRAA.exe" (
    cd /d "%~dp0..\MYRAA"
    start "" "%~dp0..\MYRAA\MYRAA.exe"
    exit /b 0
)

if exist "d:\Team of Vishwajeet\MYRAA\MYRAA.exe" (
    cd /d "d:\Team of Vishwajeet\MYRAA"
    start "" "d:\Team of Vishwajeet\MYRAA\MYRAA.exe"
    exit /b 0
)

exit /b 0
