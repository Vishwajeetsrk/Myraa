@echo off
:: MYRAA Launcher — bypasses SmartScreen / Smart App Control for unsigned builds
:: Right-click this file and "Run as administrator" if SmartScreen still blocks.

echo.
echo   ============================================
echo     MYRAA AI OS v8.3.0 — Launcher
echo   ============================================
echo.

:: Remove Mark-of-the-Web from all files (fixes SmartScreen)
echo [1/3] Removing Mark-of-the-Web from files...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-ChildItem -Recurse '%~dp0' -Include *.exe,*.dll,*.cjs,*.js,*.node | ForEach-Object { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue }"
echo       Done.
echo.

:: Unblock the portable exe specifically
echo [2/3] Unblocking MYRAA.exe...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Unblock-File -Path '%~dp0MYRAA AI OS.exe' -ErrorAction SilentlyContinue"
echo       Done.
echo.

:: Launch
echo [3/3] Starting MYRAA...
echo.
start "" "%~dp0MYRAA AI OS.exe"
