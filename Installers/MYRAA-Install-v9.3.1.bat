@echo off
setlocal enabledelayedexpansion
title MYRAA AI OS v9.3.1 - Production Installer

echo.
echo =====================================================================
echo   MYRAA AI OS v9.3.1  -  Windows Application Setup
echo =====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%USERPROFILE%\Desktop\MYRAA-Installers-v9.3.1"
set "SETUP_EXE="

if exist "%SCRIPT_DIR%v9.3.1\MYRAA-Setup-v9.3.1.exe" (
    set "SETUP_EXE=%SCRIPT_DIR%v9.3.1\MYRAA-Setup-v9.3.1.exe"
) else if exist "%DESKTOP_DIR%\MYRAA-Setup-v9.3.1.exe" (
    set "SETUP_EXE=%DESKTOP_DIR%\MYRAA-Setup-v9.3.1.exe"
) else if exist "%SCRIPT_DIR%MYRAA-Setup-v9.3.1.exe" (
    set "SETUP_EXE=%SCRIPT_DIR%MYRAA-Setup-v9.3.1.exe"
)

echo [*] Target Installer: !SETUP_EXE!

if "!SETUP_EXE!"=="" (
    echo [!] Setup executable not found in local folder or Desktop.
    echo [*] Launching automated PowerShell setup helper...
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%DESKTOP_DIR%\setup_helper.ps1" -Action Install
    goto END
)

echo [*] Launching Windows Setup Wizard...
start "" /wait "!SETUP_EXE!"

echo [*] Registering Desktop and Start Menu Shortcuts...
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%DESKTOP_DIR%\setup_helper.ps1" -Action Repair

:END
echo.
echo =====================================================================
echo   [SUCCESS] MYRAA AI OS v9.3.1 Installation Finished
echo =====================================================================
echo.
pause
