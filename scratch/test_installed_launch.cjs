const { spawn } = require('child_process');
const http = require('http');

const exe = 'C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA\\MYRAA.exe';

console.log('Testing installed MYRAA launch:');
console.log('Exe:', exe);

const child = spawn(exe, [], {
  detached: false,
  stdio: 'ignore'
});

console.log('Spawned PID:', child.pid);

function pollHealth(retriesLeft) {
  if (retriesLeft <= 0) {
    console.error('[FAIL] Timed out waiting for MYRAA on port 3000');
    try { process.kill(child.pid); } catch(e){}
    process.exit(1);
  }

  const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('[SUCCESS] Port 3000 responded with HTTP', res.statusCode);
      console.log('Response body:', data.slice(0, 200));
      // Kill child cleanly after successful test
      try {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      } catch(e){}
      console.log('[OK] Test complete!');
      process.exit(0);
    });
  });

  req.on('error', () => {
    setTimeout(() => pollHealth(retriesLeft - 1), 1000);
  });
  req.setTimeout(2000, () => req.destroy());
}

setTimeout(() => pollHealth(25), 2000);
