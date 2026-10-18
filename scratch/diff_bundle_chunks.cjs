const fs = require('fs');
const cp = require('child_process');

const original = cp.execSync('git show HEAD:resources/app/dist/assets/index-qnLjC2CG.js', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
const current = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

console.log('Original length:', original.length);
console.log('Current length:', current.length);

// Let's find diff blocks
let pOrig = 0;
let pCurr = 0;
const diffs = [];

while (pOrig < original.length && pCurr < current.length) {
  if (original[pOrig] === current[pCurr]) {
    pOrig++;
    pCurr++;
  } else {
    // Found mismatch
    const origStart = pOrig;
    const currStart = pCurr;
    
    // Find next common anchor of 30 chars
    let anchorFound = false;
    for (let len = 30; len <= 50; len++) {
      for (let offsetCurr = 0; offsetCurr < 2000; offsetCurr++) {
        const needle = current.slice(currStart + offsetCurr, currStart + offsetCurr + len);
        if (needle.length < len) break;
        const foundInOrig = original.indexOf(needle, origStart);
        if (foundInOrig !== -1 && foundInOrig - origStart < 2000) {
          diffs.push({
            orig: original.slice(origStart, foundInOrig),
            curr: current.slice(currStart, currStart + offsetCurr),
            origStart,
            foundInOrig,
            currStart,
            currEnd: currStart + offsetCurr
          });
          pOrig = foundInOrig;
          pCurr = currStart + offsetCurr;
          anchorFound = true;
          break;
        }
      }
      if (anchorFound) break;
    }
    
    if (!anchorFound) {
      diffs.push({
        orig: original.slice(origStart, origStart + 200),
        curr: current.slice(currStart, currStart + 200),
        note: 'no anchor found within 2000 chars'
      });
      break;
    }
  }
}

console.log('Total diff chunks:', diffs.length);
diffs.forEach((d, idx) => {
  console.log(`\n=== Diff #${idx + 1} ===`);
  console.log('--- ORIGINAL: ---');
  console.log(d.orig.slice(0, 300));
  console.log('--- CURRENT: ---');
  console.log(d.curr.slice(0, 300));
});
