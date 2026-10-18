const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const lnk = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop', 'MYRAA.lnk');
const ps = `
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut('${lnk}')
Write-Host "TARGET:" $s.TargetPath
Write-Host "WORKDIR:" $s.WorkingDirectory
Write-Host "ICON:" $s.IconLocation
`;

const res = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/\r?\n/g, '; ')}"`, { encoding: 'utf8' });
console.log(res);

// Also check Registry
const regKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const regCheck = `
Get-ChildItem '${regKey}' | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($p.DisplayName -like '*MYRAA*') {
    Write-Host "FOUND REGISTRY ENTRY:"
    Write-Host "  Key:" $_.PSChildName
    Write-Host "  DisplayName:" $p.DisplayName
    Write-Host "  DisplayVersion:" $p.DisplayVersion
    Write-Host "  Publisher:" $p.Publisher
    Write-Host "  InstallLocation:" $p.InstallLocation
    Write-Host "  UninstallString:" $p.UninstallString
  }
}
`;
const regRes = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${regCheck.replace(/\r?\n/g, '; ')}"`, { encoding: 'utf8' });
console.log(regRes);
