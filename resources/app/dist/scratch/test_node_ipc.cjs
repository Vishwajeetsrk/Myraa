const cp = require('child_process');
const p = cp.spawn('C:\\Program Files\\nodejs\\node.exe', ['-e', 'console.log("IPC test passed");'], {
  stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});
p.stdout.on('data', d => console.log(d.toString()));
p.on('exit', code => console.log('Exited with:', code));
