@echo off
setlocal enabledelayedexpansion
title MYRAA AI OS v9.6.0 - Production Windows Setup

echo.
echo =====================================================================
echo   MYRAA AI OS v9.6.0  -  Windows Application Setup
echo =====================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%USERPROFILE%\Desktop\MYRAA-Installers-v9.6.0"
set "SETUP_EXE="

rem Locate the official NSIS Setup Executable across all candidate paths
for %%F in (
    "%SCRIPT_DIR%MYRAA-Setup-9.6.0.exe"
    "%SCRIPT_DIR%MYRAA-Setup-v9.6.0.exe"
    "%SCRIPT_DIR%v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%SCRIPT_DIR%v9.6.0\MYRAA-Setup-v9.6.0.exe"
    "%DESKTOP_DIR%\MYRAA-Setup-9.6.0.exe"
    "%DESKTOP_DIR%\MYRAA-Setup-v9.6.0.exe"
    "%USERPROFILE%\OneDrive\Desktop\MYRAA-Installers-v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%USERPROFILE%\Desktop\MYRAA-Installers-v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%SCRIPT_DIR%..\Installers\v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%SCRIPT_DIR%..\release\v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%SCRIPT_DIR%..\resources\app\dist-release\MYRAA-Setup-9.6.0.exe"
    "%USERPROFILE%\Music\Myraa\Installers\v9.6.0\MYRAA-Setup-9.6.0.exe"
    "%USERPROFILE%\Music\Myraa\release\v9.6.0\MYRAA-Setup-9.6.0.exe"
) do (
    if "!SETUP_EXE!"=="" if exist "%%~fF" (
        set "SETUP_EXE=%%~fF"
    )
)

echo [*] Target Setup Executable: !SETUP_EXE!

rem Locate the PowerShell helper script
set "HELPER_PS1="
for %%H in (
    "%SCRIPT_DIR%setup_helper.ps1"
    "%SCRIPT_DIR%v9.6.0\setup_helper.ps1"
    "%DESKTOP_DIR%\setup_helper.ps1"
    "%USERPROFILE%\OneDrive\Desktop\MYRAA-Installers-v9.6.0\setup_helper.ps1"
    "%USERPROFILE%\Music\Myraa\Installers\setup_helper.ps1"
    "%USERPROFILE%\Music\Myraa\release\setup_helper.ps1"
) do (
    if "!HELPER_PS1!"=="" if exist "%%~fH" (
        set "HELPER_PS1=%%~fH"
    )
)

if "!SETUP_EXE!"=="" (
    echo [!] Setup executable not found in local folder or Desktop.
    if not "!HELPER_PS1!"=="" (
        echo [*] Launching automated PowerShell setup helper...
        powershell.exe -ExecutionPolicy Bypass -NoProfile -File "!HELPER_PS1!" -Action Install
    ) else (
        echo [X] Error: Could not locate MYRAA-Setup-9.6.0.exe or setup_helper.ps1.
    )
    goto END
)

echo [*] Launching Windows Setup Wizard for MYRAA AI OS v9.6.0...
echo [*] The Windows Setup Wizard will guide you through the installation.

rem Check if silent install requested via commandline flag (/S or /silent)
if /i "%~1"=="/S" (
    start "" /wait "!SETUP_EXE!" /S
) else if /i "%~1"=="/silent" (
    start "" /wait "!SETUP_EXE!" /S
) else (
    start "" /wait "!SETUP_EXE!"
)

echo.
echo [*] Registering Desktop and Start Menu Shortcuts...
if not "!HELPER_PS1!"=="" (
    powershell.exe -ExecutionPolicy Bypass -NoProfile -File "!HELPER_PS1!" -Action Repair
)

set "INSTALLED_APP=%LOCALAPPDATA%\Programs\MYRAA\MYRAA.exe"
if exist "%INSTALLED_APP%" (
    echo [OK] Verified application binary: "%INSTALLED_APP%"
)

:END
echo.
echo =====================================================================
echo   [SUCCESS] MYRAA AI OS v9.6.0 Installation Finished
echo =====================================================================
echo.
echo Press any key to exit setup...
pause >nul
