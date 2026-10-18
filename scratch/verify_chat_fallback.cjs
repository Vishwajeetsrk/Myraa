'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_PATH = path.resolve(__dirname, '../resources/app/dist/server.cjs');
console.log('Starting server for verification:', SERVER_PATH);

const srv = spawn(process.execPath, [SERVER_PATH], {
  cwd: path.dirname(SERVER_PATH),
  env: { ...process.env, PORT: '3000' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverStarted = false;

srv.stdout.on('data', (d) => {
  const msg = d.toString();
  if (msg.includes('3000') || msg.includes('ready') || msg.includes('running') || msg.includes('listening')) {
    serverStarted = true;
  }
  process.stdout.write('[server out] ' + msg);
});

srv.stderr.on('data', (d) => {
  process.stderr.write('[server err] ' + d.toString());
});

async function runVerification() {
  console.log('Waiting for server to become responsive...');
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise(r => setTimeout(r, 1000));
      const configRes = await fetch('http://localhost:3000/api/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        console.log('[OK] Server is up! Config data:', configData);
        break;
      }
    } catch (e) {
      // Keep waiting
    }
  }

  console.log('Sending test POST to /api/chat...');
  try {
    const chatRes = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello MYRAA, please reply in 5 words.' })
    });

    console.log('Status code:', chatRes.status);
    const data = await chatRes.json();
    console.log('[OK] /api/chat response:', JSON.stringify(data));

    if (data && (data.reply || data.text)) {
      console.log('[PASS] REST fallback /api/chat working perfectly!');
    } else {
      console.error('[FAIL] Unexpected response format:', data);
    }
  } catch (err) {
    console.error('[FAIL] Error calling /api/chat:', err.message);
  } finally {
    console.log('Stopping test server process...');
    srv.kill('SIGTERM');
    setTimeout(() => {
      srv.kill('SIGKILL');
      process.exit(0);
    }, 1500);
  }
}

runVerification();
