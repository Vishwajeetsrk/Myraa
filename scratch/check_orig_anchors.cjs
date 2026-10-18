const cp = require('child_process');

const orig = cp.execSync('git show HEAD:resources/app/dist/assets/index-qnLjC2CG.js', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
const origLines = orig.split('\n');

const origLine49 = origLines[48];
const origLine858 = origLines[857];

console.log('Orig line 49 around pos 38990:');
const anchor1 = 'onScreenVisionState';
const idx1 = origLine49.indexOf(anchor1);
console.log(origLine49.slice(idx1 - 40, idx1 + 100));

console.log('Orig line 49 around transcription:');
const anchor2 = 'r.type==="transcription"';
const idx2 = origLine49.indexOf(anchor2);
console.log(origLine49.slice(idx2 - 150, idx2 + 100));

console.log('Orig line 858 around rep:');
const anchor3 = 'dt("talking")';
const idx3 = origLine858.indexOf(anchor3);
console.log(origLine858.slice(idx3 - 60, idx3 + 150));
