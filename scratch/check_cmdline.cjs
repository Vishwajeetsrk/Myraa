'use strict';
const { execSync } = require('child_process');
try {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*MYRAA*' -or $_.ProcessName -like '*myraa*' } | ForEach-Object { [PSCustomObject]@{ Id = $_.Id; Name = $_.ProcessName; Path = $_.Path } } | Format-Table -AutoSize | Out-String`;
  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  const out = execSync(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
