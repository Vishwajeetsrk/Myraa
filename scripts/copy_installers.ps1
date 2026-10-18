$src = "C:\Users\Vishwajeet\Desktop\MYRAA-Installers-v9.3.1"
$targets = @(
    "C:\Users\Vishwajeet\Music\Myraa\Installers\v9.3.1",
    "C:\Users\Vishwajeet\Music\Myraa\Installers",
    "C:\Users\Vishwajeet\Music\Myraa\release\v9.3.1",
    "C:\Users\Vishwajeet\Music\Myraa\release"
)

$files = @(
    "MYRAA-Setup-v9.3.1.exe",
    "MYRAA-Portable-v9.3.1.exe",
    "MYRAA-Install-v9.3.1.bat",
    "setup_helper.ps1",
    "README.txt"
)

foreach ($target in $targets) {
    Write-Host "Target: $target"
    foreach ($file in $files) {
        $sourceFile = Join-Path $src $file
        if (Test-Path $sourceFile) {
            $destFile = Join-Path $target $file
            try {
                Copy-Item -Path $sourceFile -Destination $destFile -Force -ErrorAction Stop
                Write-Host "  [OK] Copied $file"
            } catch {
                Write-Host "  [!] Copy error for $file : $_"
            }
        }
    }
}

Write-Host "`n[+] Verification:"
foreach ($target in $targets) {
    Write-Host "Contents of $target :"
    Get-ChildItem -Path $target -ErrorAction SilentlyContinue | Select-Object Name, Length | Format-Table -AutoSize
}
