'use strict';
const cp = require('child_process');
const out = cp.execSync('powershell -Command "Get-Process | Where-Object { $_.Name -match \'MYRAA\' } | Select-Object Id, Name, Path | ConvertTo-Json"').toString();
console.log(out);
process.exit(0);
