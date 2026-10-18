const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const installDir = path.join(process.env.LOCALAPPDATA, 'Programs', 'MYRAA');
const uninstaller = path.join(installDir, 'Uninstall MYRAA.exe');
const userDataDir = path.join(process.env.APPDATA, 'MYRAA');
const testCanaryFile = path.join(userDataDir, 'canary_user_data_test.txt');

// 1. Create a user data canary file to prove user data is preserved
if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
fs.writeFileSync(testCanaryFile, 'CANARY_USER_DATA_ACTIVE_' + Date.now());
console.log('[STEP 1] Created user canary file in %APPDATA%\\MYRAA:', fs.existsSync(testCanaryFile));

// 2. Run uninstaller
if (!fs.existsSync(uninstaller)) {
  console.error('[ERROR] Uninstaller not found at:', uninstaller);
  process.exit(1);
}

console.log('[STEP 2] Running uninstaller: "Uninstall MYRAA.exe /S"...');
execSync(`"${uninstaller}" /S`, { stdio: 'inherit' });

// Wait 4 seconds for NSIS background uninstaller process to complete file deletion
const start = Date.now();
while (Date.now() - start < 4000) {}

// 3. Check application directory
const appExe = path.join(installDir, 'MYRAA.exe');
console.log('[STEP 3] Application binary removed:', !fs.existsSync(appExe));

// 4. Verify USER DATA PRESERVATION (Rule 2)
const canaryExists = fs.existsSync(testCanaryFile);
const userDirExists = fs.existsSync(userDataDir);
console.log('[STEP 4] User Data Directory Preserved:', userDirExists);
console.log('[STEP 4] User Canary File Intact:', canaryExists);

if (canaryExists && userDirExists) {
  console.log('[PASS] RULE 2 VERIFIED: User data strictly preserved after uninstallation!');
  fs.unlinkSync(testCanaryFile);
} else {
  console.error('[FAIL] User data was unexpectedly affected!');
}
