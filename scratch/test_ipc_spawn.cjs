const { spawn } = require('child_process');

const exe = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Installers-v9.3.1\\MYRAA.exe';

console.log('Testing spawn with IPC channel:');
const p = spawn(exe, ['-e', 'console.log("HELLO FROM CHILD"); process.on("message", m => console.log("MSG:", m)); setTimeout(() => { console.log("CHILD TIMEOUT"); process.exit(0); }, 3000);'], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('exit', (c, s) => console.log('EXIT:', c, s));
p.on('error', e => console.error('ERROR:', e.message));

setTimeout(() => {
  console.log('Parent done');
}, 5000);
