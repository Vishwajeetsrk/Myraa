'use strict';
const { execSync } = require('child_process');
const ps = `Get-Process | Where-Object { $_.ProcessName -like "*MYRAA*" -or $_.ProcessName -like "*myraa*" } | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize | Out-String`;
const b64 = Buffer.from(ps, 'utf16le').toString('base64');
console.log(execSync('powershell -NoProfile -EncodedCommand ' + b64, { encoding: 'utf8' }));
