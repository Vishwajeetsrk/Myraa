const { spawn } = require('child_process');
const path = require('path');

const exe = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Installers-v9.3.1\\MYRAA.exe';
const serverEntry = 'c:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\app\\dist\\server.cjs';
const appRoot = 'c:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\app';

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
  console.log('Test completed after 8s');
}, 8000);
