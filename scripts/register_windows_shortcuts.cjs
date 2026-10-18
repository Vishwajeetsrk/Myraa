'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'MYRAA.exe');
const workingDir = path.dirname(targetExe);
const iconPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist', 'icon.ico');
const resolvedIcon = fs.existsSync(iconPath) ? iconPath : targetExe;

if (!fs.existsSync(targetExe)) {
  console.error(`[FAIL] Target executable does not exist: ${targetExe}`);
  process.exit(1);
}

const desktopLnk = path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA.lnk');
const startMenuDir = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MYRAA');
const startMenuLnk = path.join(startMenuDir, 'MYRAA.lnk');

if (!fs.existsSync(startMenuDir)) {
  fs.mkdirSync(startMenuDir, { recursive: true });
}

const psScript = `
$ws = New-Object -ComObject WScript.Shell
$scDesktop = $ws.CreateShortcut('${desktopLnk.replace(/'/g, "''")}')
$scDesktop.TargetPath = '${targetExe.replace(/'/g, "''")}'
$scDesktop.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
$scDesktop.IconLocation = '${resolvedIcon.replace(/'/g, "''")},0'
$scDesktop.Description = 'MYRAA AI OS'
$scDesktop.Save()

$oneDriveDesktop = Join-Path $env:USERPROFILE 'OneDrive\Desktop'
if (Test-Path $oneDriveDesktop) {
    $scOneDrive = $ws.CreateShortcut((Join-Path $oneDriveDesktop 'MYRAA.lnk'))
    $scOneDrive.TargetPath = '${targetExe.replace(/'/g, "''")}'
    $scOneDrive.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
    $scOneDrive.IconLocation = '${resolvedIcon.replace(/'/g, "''")},0'
    $scOneDrive.Description = 'MYRAA AI OS'
    $scOneDrive.Save()
}

$scStartMenu = $ws.CreateShortcut('${startMenuLnk.replace(/'/g, "''")}')
$scStartMenu.TargetPath = '${targetExe.replace(/'/g, "''")}'
$scStartMenu.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
$scStartMenu.IconLocation = '${resolvedIcon.replace(/'/g, "''")},0'
$scStartMenu.Description = 'MYRAA AI OS'
$scStartMenu.Save()
`.replace(/\r?\n/g, '; ');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'inherit' });
  console.log('[OK] Registered Desktop shortcut:', desktopLnk);
  console.log('[OK] Registered Start Menu shortcut:', startMenuLnk);
  console.log('[OK] Shortcut target:', targetExe);
} catch (e) {
  console.error('[FAIL] Error registering shortcuts:', e.message);
  process.exit(1);
}
