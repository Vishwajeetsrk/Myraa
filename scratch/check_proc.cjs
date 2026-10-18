const { execSync } = require('child_process');
try {
  execSync('taskkill /F /IM "MYRAA AI.exe" /T', { stdio: 'ignore' });
} catch(e) {}
try {
  execSync('taskkill /F /IM "myraa-agent.exe" /T', { stdio: 'ignore' });
} catch(e) {}
try {
  execSync('taskkill /F /IM "MYRAA.exe" /T', { stdio: 'ignore' });
} catch(e) {}

const out = execSync('tasklist', { encoding: 'utf8' });
const lines = out.split('\n').filter(l => /myraa/i.test(l));
console.log('Remaining MYRAA processes:', lines);
