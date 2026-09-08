const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const unpacked = path.join(
  'C:', 'Users', 'Vishwajeet', 'Music', 'Myraa', 'resources', 'app',
  'release', 'win-unpacked', 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'
);

console.log('server.cjs exists:', fs.existsSync(unpacked));

const p = spawn('node', [unpacked], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    MYRAA_DATA_DIR: process.env.TEMP,
    MYRAA_CORE_DISABLE: '1',
    MYRAA_LAUNCHED_BY: 'test',
  },
  cwd: path.dirname(path.dirname(unpacked)),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let out = '';
let err = '';
p.stdout.on('data', d => { out += d.toString(); });
p.stderr.on('data', d => { err += d.toString(); });
p.on('error', e => { console.log('SPAWN ERROR:', e.message); process.exit(1); });
p.on('exit', (code, sig) => {
  console.log('exit code:', code, 'signal:', sig);
  if (out) console.log('stdout:', out.slice(0, 300));
  if (err) console.log('stderr:', err.slice(0, 500));
});

setTimeout(() => {
  p.kill();
  console.log('KILLED after 10s (server was running = success)');
  if (out) console.log('stdout:', out.slice(0, 500));
  if (err) console.log('stderr:', err.slice(0, 500));
  process.exit(0);
}, 10000);
