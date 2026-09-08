# MYRAA AI OS — Icon generation pipeline (single source)
# -----------------------------------------------------------------------------
# Source of truth : C:\Users\Vishwajeet\Music\Myraa.png
# Generates       : resources/app/build/icon.png, icon.ico  (Electron)
#                  src-tauri/icons/*                          (Tauri)
#                  docs/installer/icon-*.png                  (installer assets)
# Requirements    : PowerShell 5.1 + .NET System.Drawing (built into Windows)
# Usage           : powershell -ExecutionPolicy Bypass -File scripts\generate-icons.ps1
# -----------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$root    = Split-Path $PSScriptRoot -Parent
$srcPng  = 'C:\Users\Vishwajeet\Music\Myraa.png'
$buildDir = Join-Path $root 'resources\app\build'
$tauriIcons = Join-Path $root 'src-tauri\icons'
$instDir = Join-Path $root 'docs\installer'

if (-not (Test-Path $srcPng)) { Write-Error "Logo not found: $srcPng"; exit 1 }
foreach ($d in @($buildDir, $tauriIcons, $instDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($srcPng)
Write-Host "Source: $srcPng ($($source.Width)x$($source.Height))"

function Write-CleanedSize([System.Drawing.Image]$img, [int]$size, [string]$outPath) {
  # High-quality bicubic resize onto a transparent square canvas.
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "  OK $outPath ($size`px)"
}

# ── Tauri icon set (exact names tauri.conf.json expects) ────────────────────
Write-Host "`n[Tauri icons]"
Write-CleanedSize $source 32  (Join-Path $tauriIcons '32x32.png')
Write-CleanedSize $source 128 (Join-Path $tauriIcons '128x128.png')
Write-CleanedSize $source 256 (Join-Path $tauriIcons '128x128@2x.png')
Write-CleanedSize $source 512 (Join-Path $tauriIcons 'icon.png')

# ── Electron build icons ────────────────────────────────────────────────────
Write-Host "`n[Electron build icons]"
Write-CleanedSize $source 512 (Join-Path $buildDir 'icon.png')

# ── Installer assets (PNG source sizes for NSIS bitmaps) ────────────────────
Write-Host "`n[Installer assets]"
Write-CleanedSize $source 150 (Join-Path $instDir 'icon-150.png')
Write-CleanedSize $source 256 (Join-Path $instDir 'icon-256.png')

# ── Build multi-size .ico (16,24,32,48,64,128,256) ──────────────────────────
Write-Host "`n[ICO]"
$icoPath = Join-Path $buildDir 'icon.ico'
$sizes   = @(16,24,32,48,64,128,256)
$streams = @()
try {
  foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($source, 0, 0, $s, $s)
    $g.Dispose()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $streams += ,@($s, $ms)
  }

  $writer = New-Object System.IO.BinaryWriter([System.IO.File]::Create($icoPath))
  $writer.Write([uint16]0)                          # reserved
  $writer.Write([uint16]1)                          # type: icon
  $writer.Write([uint16]$streams.Count)             # count
  $offset = 6 + 16 * $streams.Count
  $pngData = @{}
  foreach ($pair in $streams) {
    $s = $pair[0]; $ms = $pair[1]
    $pngData[$s] = $ms.ToArray()
    # ICONDIRENTRY
    $b = if ($s -ge 256) { 0 } else { $s }
    $writer.Write([byte]$b)                         # width (0 = 256)
    $writer.Write([byte]$b)                         # height
    $writer.Write([byte]0)                          # colors
    $writer.Write([byte]0)                          # reserved
    $writer.Write([uint16]1)                        # planes
    $writer.Write([uint16]32)                       # bits per pixel
    $writer.Write([uint32]$pngData[$s].Length)      # bytes in resource
    $writer.Write([uint32]$offset)                  # offset
    $offset += $pngData[$s].Length
  }
  foreach ($s in $sizes) { $writer.Write($pngData[$s]) }
  $writer.Flush(); $writer.Close()
  Write-Host "  OK $icoPath ($(($sizes -join ',')) px)"
} finally {
  foreach ($pair in $streams) { $pair[1].Dispose() }
}

$source.Dispose()
Write-Host "`nIcon pipeline complete. Verify visually before release."
Write-Host "macOS .icns NOTE: generate on a macOS runner via iconutil (see .github/workflows/release.yml)."