#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI — Pre-Release Verification Script
 * ---------------------------------------------------------------------------
 * Validates that everything is correct before publishing a release.
 * Run after build + sign, before creating a GitHub release.
 *
 * Usage:
 *   node scripts/verify.cjs
 *   node scripts/verify.cjs --strict    (fail on warnings)
 * ========================================================================== */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'resources', 'app');
const RELEASE_DIR = path.join(APP_DIR, 'release');
const PKG_PATH = path.join(APP_DIR, 'package.json');
const VERSION_JSON = path.join(APP_DIR, 'version.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) { passCount++; console.log(`${COLORS.green}  ✓${COLORS.reset} ${msg}`); }
function warn(msg) { warnCount++; console.log(`${COLORS.yellow}  ⚠${COLORS.reset} ${msg}`); }
function fail(msg) { failCount++; console.log(`${COLORS.red}  ✗${COLORS.reset} ${msg}`); }
function info(msg) { console.log(`${COLORS.cyan}    ${COLORS.reset} ${msg}`); }
function section(msg) { console.log(`\n${COLORS.bold}${COLORS.blue}── ${msg} ──${COLORS.reset}`); }

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findSigntool() {
  const candidates = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22000.0\\x64\\signtool.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try { execSync('where signtool', { stdio: 'pipe' }); return 'signtool'; } catch {}
  return null;
}

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...findFiles(full, ext));
    else if (item.name.endsWith(ext)) results.push(full);
  }
  return results;
}

// ── Verification Checks ─────────────────────────────────────────────────────

const strict = process.argv.includes('--strict');

console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`${COLORS.bold}  MYRAA AI — Pre-Release Verification${COLORS.reset}`);
console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}\n`);

// 1. Version consistency
section('1. Version Consistency');

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const pkgVersion = pkg.version;

if (fs.existsSync(VERSION_JSON)) {
  const vjson = JSON.parse(fs.readFileSync(VERSION_JSON, 'utf8'));
  if (vjson.version === pkgVersion) {
    pass(`package.json and version.json match: ${pkgVersion}`);
  } else {
    fail(`Version mismatch: package.json=${pkgVersion}, version.json=${vjson.version}`);
  }
} else {
  warn('version.json not found — version management incomplete');
}

// Check NSIS header
const nsisPath = path.join(APP_DIR, 'build', 'nsis-installer.nsh');
if (fs.existsSync(nsisPath)) {
  const nsisContent = fs.readFileSync(nsisPath, 'utf8');
  if (nsisContent.includes('customInit') && nsisContent.includes('customInstall')) {
    pass('NSIS installer has customInit and customInstall macros');
  } else {
    warn('NSIS installer missing customInit or customInstall macros');
  }
} else {
  fail('NSIS installer customization file not found');
}

// 2. Build artifacts
section('2. Build Artifacts');

const setupExes = findFiles(RELEASE_DIR, '.exe').filter(f => f.includes('Setup'));
const portableExes = findFiles(RELEASE_DIR, '.exe').filter(f => !f.includes('win-unpacked'));

if (setupExes.length > 0) {
  pass(`NSIS installer found: ${path.basename(setupExes[0])}`);
  const size = fs.statSync(setupExes[0]).size;
  info(`Size: ${(size / 1024 / 1024).toFixed(1)} MB`);
  if (size < 50 * 1024 * 1024) {
    warn('Installer seems small (< 50 MB) — check if asar was included');
  }
} else {
  fail('No NSIS installer found in release/');
}

if (portableExes.length > 0) {
  pass(`Portable exe found: ${path.basename(portableExes[0])}`);
} else {
  warn('No portable exe found');
}

// Check win-unpacked has asar.unpacked/dist
const unpackedDist = path.join(RELEASE_DIR, 'win-unpacked', 'resources', 'app.asar.unpacked', 'dist');
if (fs.existsSync(unpackedDist)) {
  const serverCjs = path.join(unpackedDist, 'server.cjs');
  if (fs.existsSync(serverCjs)) {
    pass('server.cjs exists in unpacked dist (spawn will work)');
  } else {
    fail('server.cjs NOT found in unpacked dist — spawn will fail');
  }

  const coreCjs = path.join(unpackedDist, 'myraa_core.cjs');
  if (fs.existsSync(coreCjs)) {
    pass('myraa_core.cjs exists in unpacked dist');
  } else {
    warn('myraa_core.cjs not found in unpacked dist');
  }
} else {
  fail('app.asar.unpacked/dist not found — asarUnpack may not be configured');
}

// 3. Code signing
section('3. Code Signing');

const signtool = findSigntool();
if (!signtool) {
  warn('signtool.exe not found — cannot verify signatures');
} else {
  info(`signtool: ${signtool}`);

  const winExes = findFiles(path.join(RELEASE_DIR, 'win-unpacked'), '.exe');
  let signedCount = 0;
  let unsignedCount = 0;

  for (const exe of winExes.slice(0, 5)) { // Check first 5
    try {
      execSync(`"${signtool}" verify /pa "${exe}"`, { stdio: 'pipe' });
      signedCount++;
    } catch {
      unsignedCount++;
    }
  }

  if (signedCount > 0) {
    pass(`${signedCount} executables are signed`);
  }
  if (unsignedCount > 0) {
    warn(`${unsignedCount} executables are unsigned (SmartScreen will warn)`);
  }
  if (signedCount === 0 && unsignedCount > 0) {
    info('To sign: CSC_LINK=<pfx> CSC_KEY_PASSWORD=<pw> node scripts/sign.cjs');
  }
}

// 4. Checksums
section('4. Checksums');

const _verifyVersion = (() => { try { return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8')).version; } catch (e) { return '8.3.1'; } })();
const checksumsDir = path.join(RELEASE_DIR, 'checksums');
const pkgChecksumsDir = path.join(RELEASE_DIR, `MYRAA-${_verifyVersion}`, 'checksums');
const effectiveChecksumsDir = fs.existsSync(checksumsDir) ? checksumsDir : (fs.existsSync(pkgChecksumsDir) ? pkgChecksumsDir : checksumsDir);
if (fs.existsSync(effectiveChecksumsDir)) {
  const checksumFiles = fs.readdirSync(effectiveChecksumsDir).filter(f => f.endsWith('.txt'));
  if (checksumFiles.length > 0) {
    pass(`Checksum file found: ${checksumFiles[0]}`);
    const content = fs.readFileSync(path.join(effectiveChecksumsDir, checksumFiles[0]), 'utf8');
    const lines = content.trim().split('\n');
    info(`${lines.length} checksums recorded`);
  } else {
    warn('No checksum files found');
  }
} else {
  warn('Checksums directory not found');
}

// 5. electron-builder config
section('5. Build Configuration');

const builderPath = path.join(APP_DIR, 'electron-builder.v2.yml');
if (fs.existsSync(builderPath)) {
  const config = fs.readFileSync(builderPath, 'utf8');

  if (config.includes('appId: com.myraa.desktop')) {
    pass('App ID configured: com.myraa.desktop');
  } else {
    fail('App ID not configured');
  }

  if (config.includes('productName: MYRAA AI')) {
    pass('Product name configured: MYRAA AI');
  } else {
    warn('Product name may be incorrect');
  }

  if (config.includes('sign: null') || config.includes('sign: true')) {
    pass('Code signing enabled (auto-detect from env)');
  } else if (config.includes('sign: false')) {
    warn('Code signing is explicitly disabled');
  }

  if (config.includes('asarUnpack:')) {
    pass('asarUnpack configured (dist files will be on disk)');
  } else {
    fail('asarUnpack NOT configured — spawn will fail');
  }

  if (config.includes('afterPack:')) {
    pass('afterPack hook configured');
  } else {
    warn('afterPack hook not configured');
  }

  if (config.includes('publish:')) {
    pass('Auto-update publish config found');
  } else {
    warn('Auto-update publish config not found');
  }
} else {
  fail('electron-builder.v2.yml not found');
}

// 6. Release package
section('6. Release Package');

const version = pkgVersion;
const packageDir = path.join(RELEASE_DIR, `MYRAA-${version}`);
if (fs.existsSync(packageDir)) {
  pass(`Release package directory exists: MYRAA-${version}/`);

  const metadataPath = path.join(packageDir, 'build-metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (metadata.version === version) {
      pass('Build metadata version matches');
    } else {
      fail(`Build metadata version mismatch: ${metadata.version} vs ${version}`);
    }
    pass(`Build date: ${metadata.buildDate}`);
    pass(`Signed: ${metadata.signed ? 'Yes' : 'No'}`);
  } else {
    warn('build-metadata.json not found');
  }
} else {
  warn(`Release package directory not found: MYRAA-${version}/`);
}

// 7. File integrity
section('7. File Integrity');

if (setupExes.length > 0) {
  const hash = sha256(setupExes[0]);
  pass(`Installer SHA256: ${hash}`);
  info(`Full hash: ${hash}`);

  // Check if hash matches checksums
  const _csDir1 = path.join(RELEASE_DIR, 'checksums');
  const _csDir2 = path.join(RELEASE_DIR, `MYRAA-${version}`, 'checksums');
  const _effectiveCsDir = fs.existsSync(_csDir1) ? _csDir1 : _csDir2;
  const checksumFile = path.join(_effectiveCsDir, `MYRAA-${version}-sha256.txt`);
  if (fs.existsSync(checksumFile)) {
    const content = fs.readFileSync(checksumFile, 'utf8');
    if (content.includes(hash)) {
      pass('Installer hash matches checksum file');
    } else {
      warn('Installer hash does NOT match checksum file');
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`${COLORS.bold}  VERIFICATION SUMMARY${COLORS.reset}`);
console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`  ${COLORS.green}Passed:${COLORS.reset}  ${passCount}`);
console.log(`  ${COLORS.yellow}Warnings:${COLORS.reset} ${warnCount}`);
console.log(`  ${COLORS.red}Failed:${COLORS.reset}  ${failCount}`);
console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}\n`);

if (failCount > 0) {
  console.log(`${COLORS.red}${COLORS.bold}  VERIFICATION FAILED — Fix issues before releasing${COLORS.reset}\n`);
  process.exit(1);
} else if (warnCount > 0 && strict) {
  console.log(`${COLORS.yellow}${COLORS.bold}  VERIFICATION PASSED WITH WARNINGS (--strict mode)${COLORS.reset}\n`);
  process.exit(1);
} else if (warnCount > 0) {
  console.log(`${COLORS.yellow}${COLORS.bold}  VERIFICATION PASSED WITH WARNINGS${COLORS.reset}\n`);
  process.exit(0);
} else {
  console.log(`${COLORS.green}${COLORS.bold}  VERIFICATION PASSED — Ready to release${COLORS.reset}\n`);
  process.exit(0);
}
