const { execSync } = require('child_process');

try {
  const res = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -like \'*myraa*\' } | Select-Object ProcessId, ParentProcessId, Name, CommandLine"').toString();
  console.log(res);
} catch (e) {
  console.log('Error:', e.message);
}
