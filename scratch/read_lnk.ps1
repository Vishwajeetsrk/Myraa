$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut("$env:USERPROFILE\Desktop\MYRAA.lnk")
Write-Host "TargetPath:" $lnk.TargetPath
Write-Host "WorkingDirectory:" $lnk.WorkingDirectory
