@echo off
setlocal
title MYRAA AI OS - Windows Uninstaller
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Installers\v9.3.0\setup_helper.ps1" -Action Uninstall %*
exit /b %ERRORLEVEL%
