const { execSync } = require('child_process');

try {
  const res = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | ForEach-Object { \`"$($_.ProcessId): $($_.CommandLine)\`" }"').toString();
  console.log(res);
} catch (e) {
  console.error(e.message);
}
