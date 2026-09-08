const fs = require('fs');
const content = fs.readFileSync('d:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Find the return of App
const idx = content.indexOf('onTranscription:(q,gt)');
if (idx !== -1) {
  // search backwards for useState declarations in App
  console.log('--- App declaration context ---');
  console.log(content.substring(idx - 600, idx));
  
  // search forward for JSX return
  const returnIdx = content.indexOf('return b.jsxs("div"', idx);
  if (returnIdx !== -1) {
    console.log('--- App JSX return ---');
    console.log(content.substring(returnIdx, returnIdx + 3000));
  } else {
    const returnIdx2 = content.indexOf('return b.jsx("div"', idx);
    console.log('--- App JSX return 2 ---');
    console.log(content.substring(returnIdx2, returnIdx2 + 3000));
  }
}
