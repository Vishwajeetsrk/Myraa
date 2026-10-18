[CmdletBinding()]
param([string]$InstallPath)

$ErrorActionPreference = 'Continue'
$report = Join-Path $PSScriptRoot 'MYRAA-Diagnostic-Report.txt'
$lines = [System.Collections.Generic.List[string]]::new()
function Add-Result([string]$Status, [string]$Message) { $lines.Add("[$Status] $Message") }
function Test-ItemResult([string]$Label, [string]$Path) { if (Test-Path -LiteralPath $Path -PathType Leaf) { Add-Result PASS "${Label}: $Path"; return $true }; Add-Result FAIL "${Label} missing: $Path"; return $false }

Add-Result PASS "Windows: $((Get-CimInstance Win32_OperatingSystem).Caption)"
if (-not $InstallPath) {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\MYRAA AI OS'),
    (Join-Path $env:LOCALAPPDATA 'Programs\MYRAA'),
    (Join-Path $env:ProgramFiles 'MYRAA AI OS')
  ) | Where-Object { Test-Path -LiteralPath $_ }
  $InstallPath = $candidates | Select-Object -First 1
}
if (-not $InstallPath) { Add-Result FAIL 'MYRAA installation directory was not found.'; $lines | Set-Content -LiteralPath $report; Write-Output "Report: $report"; exit 1 }
Add-Result PASS "Installation location: $InstallPath"
$exe = Join-Path $InstallPath 'MYRAA AI.exe'
if (Test-ItemResult 'Application executable' $exe) {
  $item = Get-Item -LiteralPath $exe
  Add-Result PASS "Executable size: $($item.Length) bytes"
  Add-Result PASS "Executable version: $($item.VersionInfo.ProductVersion)"
  $sig = Get-AuthenticodeSignature -LiteralPath $exe
  Add-Result $(if ($sig.Status -eq 'Valid') {'PASS'} else {'WARNING'}) "Authenticode: $($sig.Status); Publisher: $($sig.SignerCertificate.Subject)"
  $zone = Get-Item -LiteralPath $exe -Stream Zone.Identifier -ErrorAction SilentlyContinue
  Add-Result $(if ($zone) {'WARNING'} else {'PASS'}) $(if ($zone) {'Mark-of-the-Web stream present.'} else {'No Mark-of-the-Web stream.'})
}
Test-ItemResult 'app.asar' (Join-Path $InstallPath 'resources\app.asar') | Out-Null
$uninstaller = Get-ChildItem -LiteralPath $InstallPath -Filter 'Uninstall*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
if ($uninstaller) { Add-Result PASS "Uninstaller: $($uninstaller.FullName)" } else { Add-Result FAIL 'Uninstaller was not found.' }
Get-Process -Name 'MYRAA AI' -ErrorAction SilentlyContinue | ForEach-Object { Add-Result PASS "Running process: PID $($_.Id)" }
$lines | Set-Content -LiteralPath $report -Encoding UTF8
$lines | ForEach-Object { Write-Output $_ }; Write-Output "Report: $report"
