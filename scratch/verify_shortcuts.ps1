$sh = New-Object -ComObject WScript.Shell
$lnk1 = $sh.CreateShortcut("$env:USERPROFILE\Desktop\MYRAA.lnk")
Write-Host "Desktop lnk:" $lnk1.TargetPath (Test-Path $lnk1.TargetPath)
$onedrive = Join-Path $env:USERPROFILE "OneDrive\Desktop\MYRAA.lnk"
if (Test-Path $onedrive) {
    $lnk2 = $sh.CreateShortcut($onedrive)
    Write-Host "OneDrive Desktop lnk:" $lnk2.TargetPath (Test-Path $lnk2.TargetPath)
}
