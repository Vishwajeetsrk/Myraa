'use strict';

const fs = require('fs');
const path = require('path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const productName = context.packager.appInfo.productFilename;
  const primaryExe = path.join(context.appOutDir, productName + '.exe');
  if (!fs.existsSync(primaryExe)) {
    throw new Error('Packaged Electron application executable is missing: ' + primaryExe);
  }

  // MYRAA used to replace the Electron executable with a second launcher and
  // rename the actual runtime to "MYRAA AI-runtime.exe". That indirection was
  // the source of the missing-file failures in the portable distribution.
  // Keep the real Electron executable as the single, stable launch target.
  console.log('[afterPack] Verified application executable: ' + primaryExe);
};
