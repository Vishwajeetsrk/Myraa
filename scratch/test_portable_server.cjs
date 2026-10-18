const { spawn } = require('child_process');
const path = require('path');

const portableDir = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Portable\\MYRAA-Portable-8.3.4';
const exe = path.join(portableDir, 'MYRAA AI.exe');
const serverEntry = path.join(portableDir, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs');
const appRoot = path.join(portableDir, 'resources', 'app.asar.unpacked');

console.log('Testing portable server launch:');
console.log('Exe:', exe);
console.log('Server:', serverEntry);
console.log('CWD:', appRoot);

const p = spawn(exe, [serverEntry], {
  cwd: appRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    MYRAA_LAUNCHED_BY: 'electron',
    PORT: '3000'
  },
  stdio: 'pipe'
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('exit', (code, sig) => console.log('EXIT:', code, sig));

setTimeout(() => {
  p.kill();
  console.log('Test completed after 6s');
}, 6000);
