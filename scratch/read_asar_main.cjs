const { spawnSync } = require('child_process');

const exe = 'C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA\\MYRAA.exe';
const innerScript = `
const fs = require('fs');
const s = fs.readFileSync('C:\\\\Users\\\\Vishwajeet\\\\AppData\\\\Local\\\\Programs\\\\MYRAA\\\\resources\\\\app.asar\\\\electron\\\\main.cjs', 'utf8');
const l = s.split('\\n');
for (let i = 100; i < 125; i++) {
  console.log(i + 1, l[i]);
}
`;

const res = spawnSync(exe, ['-e', innerScript], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
});

console.log('STDOUT:');
console.log(res.stdout.toString());
console.log('STDERR:');
console.log(res.stderr.toString());
