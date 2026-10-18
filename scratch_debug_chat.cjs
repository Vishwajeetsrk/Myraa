'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const installedExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'MYRAA.exe');
const runtimeExe = fs.existsSync(installedExe) ? installedExe : 'node';
const serverPath = path.join(__dirname, 'resources', 'app', 'dist', 'server.cjs');

console.log('[*] Starting backend server with full logs...');
const serverProc = spawn(runtimeExe, [serverPath], {
  cwd: path.dirname(path.dirname(serverPath)),
  env: {
    ...process.env,
    PORT: '3000',
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1'
  },
  stdio: 'pipe'
});

serverProc.stdout.on('data', d => console.log('  [OUT]', d.toString().trim()));
serverProc.stderr.on('data', d => console.error('  [ERR]', d.toString().trim()));

setTimeout(async () => {
  try {
    console.log('[*] Sending POST /api/chat: "create ms word"...');
    const res = await fetch('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'create ms word' }),
      signal: AbortSignal.timeout(10000)
    });
    const json = await res.json();
    console.log('[OK] Response:', json);
  } catch (e) {
    console.error('[FAIL] Chat fetch error:', e.message);
  } finally {
    serverProc.kill();
    process.exit(0);
  }
}, 4000);
