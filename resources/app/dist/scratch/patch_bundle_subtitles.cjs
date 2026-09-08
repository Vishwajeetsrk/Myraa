const fs = require('fs');
const path = require('path');

const targetDirs = [
  'C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets',
  'C:/Users/Vishwajeet/AppData/Local/Programs/MYRAA-AI-OS/resources/app/dist/assets'
];

for (const dir of targetDirs) {
  const bundlePath = path.join(dir, 'index-qnLjC2CG.js');
  if (!fs.existsSync(bundlePath)) continue;
  let content = fs.readFileSync(bundlePath, 'utf8');

  // Replace bottom-12 with bottom-48 on cinematic-subtitles
  const before = 'id:"cinematic-subtitles",className:"fixed bottom-12';
  const after = 'id:"cinematic-subtitles",className:"fixed bottom-48';
  if (content.includes(before)) {
    content = content.replace(before, after);
    fs.writeFileSync(bundlePath, content, 'utf8');
    console.log(`[Bundle Patched] Updated bottom-12 -> bottom-48 in ${bundlePath}`);
  } else {
    console.log(`[Notice] String not found or already patched in ${bundlePath}`);
  }
}
