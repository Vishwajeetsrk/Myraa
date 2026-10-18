const { spawn } = require('child_process');
const path = require('path');

const exe = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Installers-v9.3.1\\MYRAA.exe';
const asarModules = 'C:\\Users\\Vishwajeet\\Desktop\\MYRAA-Installers-v9.3.1\\resources\\app.asar\\node_modules';

const testCode = `
console.log('Node version:', process.version);
try {
  const express = require('express');
  console.log('express OK');
} catch (e) {
  console.error('express error:', e.message);
}
`;

const p = spawn(exe, ['-e', testCode], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: asarModules },
  stdio: 'pipe'
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('exit', code => console.log('EXIT CODE:', code));
