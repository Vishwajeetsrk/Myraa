#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI — Production Build Pipeline
 * ---------------------------------------------------------------------------
 * Usage:
 *   node scripts/build.cjs                    → full build (all platforms)
 *   node scripts/build.cjs --win              → Windows only
 *   node scripts/build.cjs --sign             → build + sign
 *   node scripts/build.cjs --sign --verify    → build + sign + verify
 *   node scripts/build.cjs --release          → full release pipeline
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
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(msg) { console.log(`${COLORS.cyan}[BUILD]${COLORS.reset} ${msg}`); }
function ok(msg) { console.log(`${COLORS.green}  ✓${COLORS.reset} ${msg}`); }
function warn(msg) { console.log(`${COLORS.yellow}  ⚠${COLORS.reset} ${msg}`); }
function fail(msg) { console.error(`${COLORS.red}  ✗${COLORS.reset} ${msg}`); process.exit(1); }
function step(n, msg) { console.log(`\n${COLORS.bold}${COLORS.blue}── Step ${n}: ${msg} ──${COLORS.reset}`); }

function run(cmd, opts = {}) {
  log(`Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    fail(`Command failed: ${cmd}`);
    return false;
  }
}

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ── Version Management ───────────────────────────────────────────────────────

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  return pkg.version;
}

function syncVersion() {
  log('Syncing version across all consumers...');
  run('node scripts/version.cjs sync');
}

// ── Build Steps ──────────────────────────────────────────────────────────────

function step1_clean() {
  step(1, 'Clean');
  if (fs.existsSync(RELEASE_DIR)) {
    fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
    ok('Removed old release directory');
  }
  const distDir = path.join(APP_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    ok('Removed old dist directory');
  }
  ok('Clean complete');
}

function step2_syncVersion() {
  step(2, 'Sync Version');
  syncVersion();
  const version = getVersion();
  ok(`Version: ${version}`);
}

function step3_buildApp() {
  step(3, 'Build Application');
  run('npm run build', { cwd: APP_DIR });
  ok('Application built');
}

function step4_buildInstaller(platforms) {
  step(4, 'Build Installer');

  const args = ['--config electron-builder.v2.yml', '--publish never'];

  if (platforms.includes('win')) {
    args.push('--win', 'nsis', '--x64');
    log('Building Windows NSIS installer...');
    run(`node node_modules/electron-builder/cli.js ${args.join(' ')}`, { cwd: APP_DIR });

    // Also build portable
    const portableArgs = ['--config electron-builder.v2.yml', '--publish never', '--win', 'portable', '--x64'];
    log('Building Windows portable...');
    run(`node node_modules/electron-builder/cli.js ${portableArgs.join(' ')}`, { cwd: APP_DIR });
  }

  if (platforms.includes('mac')) {
    args.push('--mac', 'dmg');
    log('Building macOS DMG...');
    run(`node node_modules/electron-builder/cli.js ${args.join(' ')}`, { cwd: APP_DIR });
  }

  if (platforms.includes('linux')) {
    args.push('--linux', 'AppImage');
    log('Building Linux AppImage...');
    run(`node node_modules/electron-builder/cli.js ${args.join(' ')}`, { cwd: APP_DIR });
  }

  ok('Installers built');
}

function step5_sign() {
  step(5, 'Code Signing');

  const certPath = process.env.CSC_LINK || process.env.WIN_CSC_LINK;
  const certPassword = process.env.CSC_KEY_PASSWORD;

  if (!certPath) {
    warn('No code signing certificate found (CSC_LINK not set)');
    warn('Skipping code signing — installer will show SmartScreen warnings');
    warn('To sign: set CSC_LINK and CSC_KEY_PASSWORD env vars');
    return false;
  }

  if (!fs.existsSync(certPath)) {
    fail(`Certificate file not found: ${certPath}`);
    return false;
  }

  log(`Using certificate: ${certPath}`);

  // Find all executables to sign
  const winUnpacked = path.join(RELEASE_DIR, 'win-unpacked');
  if (fs.existsSync(winUnpacked)) {
    const exes = findFiles(winUnpacked, '.exe');
    const dlls = findFiles(winUnpacked, '.dll');

    for (const file of [...exes, ...dlls]) {
      log(`Signing: ${path.relative(ROOT, file)}`);
      try {
        const signtool = findSigntool();
        const args = [
          'sign',
          '/fd', 'SHA256',
          '/tr', 'http://timestamp.digicert.com',
          '/td', 'SHA256',
          '/f', certPath,
        ];
        if (certPassword) args.push('/p', certPassword);
        args.push(file);

        execSync(`"${signtool}" ${args.join(' ')}`, { stdio: 'pipe' });
        ok(`Signed: ${path.basename(file)}`);
      } catch (e) {
        warn(`Failed to sign ${path.basename(file)}: ${e.message}`);
      }
    }

    // Sign the installer
    const installers = findFiles(RELEASE_DIR, '.exe').filter(f => f.includes('Setup'));
    for (const installer of installers) {
      log(`Signing installer: ${path.basename(installer)}`);
      try {
        const signtool = findSigntool();
        execSync(`"${signtool}" sign /fd SHA256 /tr http://timestamp.digicert.com /td 256 /f "${certPath}"${certPassword ? ` /p "${certPassword}"` : ''} "${installer}"`, { stdio: 'pipe' });
        ok(`Signed installer: ${path.basename(installer)}`);
      } catch (e) {
        warn(`Failed to sign installer: ${e.message}`);
      }
    }
  }

  return true;
}

function step6_verify() {
  step(6, 'Verify Signatures');

  const winUnpacked = path.join(RELEASE_DIR, 'win-unpacked');
  if (fs.existsSync(winUnpacked)) {
    const exes = findFiles(winUnpacked, '.exe');
    for (const exe of exes) {
      try {
        const signtool = findSigntool();
        execSync(`"${signtool}" verify /pa /v "${exe}"`, { stdio: 'pipe' });
        ok(`Verified: ${path.basename(exe)}`);
      } catch (e) {
        warn(`Verification failed for ${path.basename(exe)} — may be unsigned`);
      }
    }
  }
}

function step7_checksums() {
  step(7, 'Generate SHA256 Checksums');

  const checksumsDir = path.join(RELEASE_DIR, 'checksums');
  fs.mkdirSync(checksumsDir, { recursive: true });

  const artifacts = findFiles(RELEASE_DIR, '.exe').filter(f =>
    f.includes('Setup') || f.includes('Portable')
  );

  const lines = [];
  for (const artifact of artifacts) {
    const hash = sha256(artifact);
    const name = path.basename(artifact);
    lines.push(`${hash}  ${name}`);
    ok(`${name}: ${hash.slice(0, 16)}...`);
  }

  const version = getVersion();
  const checksumFile = path.join(checksumsDir, `MYRAA-${version}-sha256.txt`);
  fs.writeFileSync(checksumFile, lines.join('\n') + '\n');
  ok(`Checksums written to: ${path.relative(ROOT, checksumFile)}`);
}

function step8_package() {
  step(8, 'Package Release');

  const version = getVersion();
  const packageDir = path.join(RELEASE_DIR, `MYRAA-${version}`);
  fs.mkdirSync(packageDir, { recursive: true });

  // Copy installers
  const installers = findFiles(RELEASE_DIR, '.exe').filter(f =>
    f.includes('Setup') || f.includes('Portable')
  );
  for (const installer of installers) {
    fs.copyFileSync(installer, path.join(packageDir, path.basename(installer)));
    ok(`Copied: ${path.basename(installer)}`);
  }

  // Copy checksums
  const checksumsDir = path.join(RELEASE_DIR, 'checksums');
  if (fs.existsSync(checksumsDir)) {
    fs.cpSync(checksumsDir, path.join(packageDir, 'checksums'), { recursive: true });
    ok('Copied checksums');
  }

  // Copy release notes
  const changelog = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(changelog)) {
    fs.copyFileSync(changelog, path.join(packageDir, 'RELEASE-NOTES.md'));
    ok('Copied release notes');
  }

  // Write metadata
  const metadata = {
    version,
    buildDate: new Date().toISOString(),
    buildNumber: Date.now(),
    platform: 'win32',
    arch: 'x64',
    electronVersion: '31.7.7',
    nodeVersion: process.version,
    signed: !!process.env.CSC_LINK,
    artifacts: installers.map(f => path.basename(f)),
  };
  fs.writeFileSync(
    path.join(packageDir, 'build-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  ok('Written build metadata');

  ok(`Release package: ${path.relative(ROOT, packageDir)}`);
}

// ── Utilities ────────────────────────────────────────────────────────────────

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function findSigntool() {
  // Try common locations
  const candidates = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22000.0\\x64\\signtool.exe',
    'C:\\Program Files\\Microsoft SDKs\\ClickOnce\\SignTool\\signtool.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Try PATH
  try {
    execSync('where signtool', { stdio: 'pipe' });
    return 'signtool';
  } catch {}
  fail('signtool.exe not found. Install Windows SDK or Visual Studio.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doSign = args.includes('--sign');
const doVerify = args.includes('--verify');
const doRelease = args.includes('--release');
const platforms = [];

if (args.includes('--win')) platforms.push('win');
if (args.includes('--mac')) platforms.push('mac');
if (args.includes('--linux')) platforms.push('linux');
if (platforms.length === 0) platforms.push('win');

console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`${COLORS.bold}  MYRAA AI — Production Build Pipeline${COLORS.reset}`);
console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`  Version: ${getVersion()}`);
console.log(`  Platforms: ${platforms.join(', ')}`);
console.log(`  Sign: ${doSign ? 'Yes' : 'No'}`);
console.log(`  Verify: ${doVerify ? 'Yes' : 'No'}`);
console.log(`${COLORS.bold}═══════════════════════════════════════════════${COLORS.reset}\n`);

step1_clean();
step2_syncVersion();
step3_buildApp();
step4_buildInstaller(platforms);

if (doSign) {
  step5_sign();
}

if (doVerify || doSign) {
  step6_verify();
}

step7_checksums();
step8_package();

console.log(`\n${COLORS.bold}${COLORS.green}═══════════════════════════════════════════════${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.green}  BUILD COMPLETE${COLORS.reset}`);
console.log(`${COLORS.bold}${COLORS.green}═══════════════════════════════════════════════${COLORS.reset}\n`);
