'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const installedExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'MYRAA.exe');
const runtimeExe = fs.existsSync(installedExe) ? installedExe : 'node';
const serverPath = path.join(__dirname, 'resources', 'app', 'dist', 'server.cjs');

console.log('[*] Starting backend server for capability testing...');
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

serverProc.stdout.on('data', d => {
  const s = d.toString();
  if (s.includes('[Server] Running') || s.includes('mounted')) {
    console.log('  [LOG]', s.trim());
  }
});

async function testIntent(message) {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    console.log(`\n======================================================`);
    console.log(`PROMPT: "${message}"`);
    console.log(`OK:`, data.ok);
    console.log(`ACTION EXECUTED:`, data.actionExecuted || 'NONE (fell through to AI)');
    console.log(`MODEL:`, data.model);
    console.log(`REPLY:\n${data.reply?.slice(0, 160)}...`);
  } catch (err) {
    console.error(`ERROR for "${message}":`, err.message);
  }
}

async function run() {
  await new Promise(r => setTimeout(r, 4000));
  console.log('\n--- TESTING USER COMMANDS ---');
  await testIntent('create ms word');
  await testIntent('write into word');
  await testIntent('create ppt');
  await testIntent('create excel');
  await testIntent('coding');
  await testIntent('what are all the skills');

  serverProc.kill();
  process.exit(0);
}

run();
