$srcSetup = "C:\Users\Vishwajeet\Desktop\MYRAA-Portable\MYRAA-Setup-9.3.0.exe"
Write-Host "srcSetup: $srcSetup"
Write-Host "srcSetup exists: $(Test-Path -LiteralPath $srcSetup)"

$destDir = "C:\Users\Vishwajeet\Music\Myraa\Installers\v9.3.1"
Write-Host "destDir exists: $(Test-Path -LiteralPath $destDir)"

$destFile = Join-Path $destDir "MYRAA-Setup-9.3.1.exe"
Write-Host "destFile: $destFile"

robocopy "C:\Users\Vishwajeet\Desktop\MYRAA-Portable" $destDir "MYRAA-Setup-9.3.0.exe" /NFL /NDL
if (Test-Path "$destDir\MYRAA-Setup-9.3.0.exe") {
    Rename-Item "$destDir\MYRAA-Setup-9.3.0.exe" "MYRAA-Setup-9.3.1.exe" -Force
    Write-Host "[OK] Robocopy succeeded for Setup exe!"
} else {
    Write-Host "[FAIL] Robocopy did not produce file"
}
