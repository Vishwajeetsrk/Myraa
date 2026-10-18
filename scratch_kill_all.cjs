const { execSync } = require('child_process');

try {
  const pids = execSync('powershell -NoProfile -Command "Get-Process *myraa* | Select-Object -ExpandProperty Id"').toString().trim().split(/\s+/);
  for (const pid of pids) {
    if (pid) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log('process.kill succeeded for', pid);
      } catch (e1) {
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log('taskkill succeeded for', pid);
        } catch (e2) {
          console.log(`Could not kill ${pid}:`, e2.message);
        }
      }
    }
  }
} catch (e) {
  console.log('Error listing pids:', e.message);
}
