const fs = require('fs');
const path = require('path');

const targetDirs = [
  'C:/Users/Vishwajeet/Music/Myraa/resources/app/dist',
  'C:/Users/Vishwajeet/AppData/Local/Programs/MYRAA-AI-OS/resources/app/dist'
];

for (const dir of targetDirs) {
  const patchFile = path.join(dir, 'ui-health-patch.js');
  if (!fs.existsSync(patchFile)) continue;
  let content = fs.readFileSync(patchFile, 'utf8');

  // Replace #cinematic-subtitles { ... }
  content = content.replace(
    /#cinematic-subtitles\s*\{\s*position:\s*fixed\s*!important;\s*bottom:\s*84px\s*!important;/g,
    '#cinematic-subtitles {\n      position: fixed !important;\n      bottom: 175px !important;'
  );

  // Replace max-height: 64px
  content = content.replace(
    /max-height:\s*64px\s*!important;/g,
    'max-height: 220px !important;\n      min-height: 44px !important;'
  );

  // Replace responsive bottom positions
  content = content.replace(
    /#cinematic-subtitles\s*\{\s*bottom:\s*74px\s*!important;/g,
    '#cinematic-subtitles {\n        bottom: 155px !important;'
  );

  content = content.replace(
    /#cinematic-subtitles\s*\{\s*bottom:\s*68px\s*!important;/g,
    '#cinematic-subtitles {\n        bottom: 145px !important;'
  );

  fs.writeFileSync(patchFile, content, 'utf8');
  console.log(`[Patch Applied] Updated #cinematic-subtitles in ${patchFile}`);
}
