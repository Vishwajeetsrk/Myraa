@echo off
setlocal enabledelayedexpansion
title MYRAA AI OS - Desktop Launcher (v9.3.0)

echo =====================================================================
echo   MYRAA AI OS - Autonomous Native Windows Desktop System (v9.3.0)
echo =====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "APP_DIR=%LOCALAPPDATA%\Programs\MYRAA"
if not exist "%APP_DIR%\MYRAA.exe" (
    set "APP_DIR=%USERPROFILE%\Desktop\MYRAA-Portable\MYRAA-Portable-8.3.4"
)

echo [*] Initializing MYRAA AI OS runtime environment...
set "NODE_ENV=production"
set "MYRAA_DATA_DIR=%APPDATA%\MYRAA AI OS"
set "MYRAA_APP_ROOT=%SCRIPT_DIR%\resources\app"

if exist "%APP_DIR%\MYRAA.exe" (
    echo [*] Launching MYRAA Windows Application from: "%APP_DIR%"
    start "" "%APP_DIR%\MYRAA.exe"
    echo [OK] MYRAA desktop application dispatched successfully.
    goto end
)

if exist "%APP_DIR%\MYRAA AI.exe" (
    echo [*] Launching MYRAA Portable Application from: "%APP_DIR%"
    start "" "%APP_DIR%\MYRAA AI.exe"
    echo [OK] MYRAA desktop application dispatched successfully.
    goto end
)

if exist "%SCRIPT_DIR%\resources\app\node_modules\electron\dist\electron.exe" (
    echo [*] Launching via local Electron binary...
    cd /d "%SCRIPT_DIR%\resources\app"
    start "" "node_modules\electron\dist\electron.exe" .
    echo [OK] MYRAA desktop process dispatched successfully.
    goto end
)

echo [!] Launching backend server...
start "" node "%SCRIPT_DIR%\resources\app\dist\server.cjs"
echo [OK] Backend server started on http://127.0.0.1:3000

:end
timeout /t 2 >nul
exit /b 0
