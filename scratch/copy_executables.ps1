$ErrorActionPreference = "Stop"

$srcSetup = "C:\Users\Vishwajeet\Desktop\MYRAA-Portable\MYRAA-Setup-9.3.0.exe"
if (-not (Test-Path $srcSetup)) {
    $srcSetup = "C:\Users\Vishwajeet\Music\Myraa\release\MYRAA-Setup-9.3.0.exe"
}

$srcPortable = "C:\Users\Vishwajeet\Desktop\MYRAA-Portable\MYRAA-Portable-9.3.0.exe"
if (-not (Test-Path $srcPortable)) {
    $srcPortable = "C:\Users\Vishwajeet\Music\Myraa\release\MYRAA-Portable-9.3.0.exe"
}

$srcApp = "C:\Users\Vishwajeet\AppData\Local\Programs\MYRAA\MYRAA.exe"

$destFolders = @(
    "C:\Users\Vishwajeet\Music\Myraa\Installers\v9.3.1",
    "C:\Users\Vishwajeet\Music\Myraa\release\v9.3.1",
    "C:\Users\Vishwajeet\Music\Myraa\Installers"
)

foreach ($dest in $destFolders) {
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        Write-Host "[OK] Created directory: $dest"
    }

    # Copy Setup Installer exe
    if (Test-Path $srcSetup) {
        $destFile = Join-Path $dest "MYRAA-Setup-9.3.1.exe"
        [System.IO.File]::Copy($srcSetup, $destFile, $true)
        Write-Host "[OK] Copied Setup Installer -> $destFile ($( (Get-Item $destFile).Length ) bytes)"
    }

    # Copy Portable Edition exe
    if (Test-Path $srcPortable) {
        $destFile = Join-Path $dest "MYRAA-Portable-9.3.1.exe"
        [System.IO.File]::Copy($srcPortable, $destFile, $true)
        Write-Host "[OK] Copied Portable -> $destFile ($( (Get-Item $destFile).Length ) bytes)"
    }

    # Copy Native Standalone Application Exe
    if (Test-Path $srcApp) {
        $destFile = Join-Path $dest "MYRAA.exe"
        [System.IO.File]::Copy($srcApp, $destFile, $true)
        Write-Host "[OK] Copied Real Application Exe -> $destFile ($( (Get-Item $destFile).Length ) bytes)"
    }
}

Write-Host "`n[SUCCESS] All Real Windows Application Exe Files Deployed."
