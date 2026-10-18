@echo off
setlocal
title MYRAA AI OS - Windows Setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Installers\v9.3.0\setup_helper.ps1" -Action Install %*
exit /b %ERRORLEVEL%
