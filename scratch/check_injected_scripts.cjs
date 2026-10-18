'use strict';
const fs = require('fs');
const path = require('path');

const locations = [
  path.join(__dirname, '..', 'resources', 'app', 'dist'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist'),
  path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4', 'resources', 'app.asar.unpacked', 'dist')
];

for (const loc of locations) {
  console.log('=== Checking:', loc, '===');
  if (!fs.existsSync(loc)) {
    console.log('Does not exist.');
    continue;
  }
  const indexHtmlPath = path.join(loc, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    console.log('index.html content:\n', fs.readFileSync(indexHtmlPath, 'utf8'));
  }
  const patchPath = path.join(loc, 'ui-health-patch.js');
  console.log('ui-health-patch.js exists?', fs.existsSync(patchPath));
  const addonPath = path.join(loc, 'universal-control-addon.js');
  console.log('universal-control-addon.js exists?', fs.existsSync(addonPath));
}
