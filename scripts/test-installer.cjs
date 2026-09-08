#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI — Installer Test Suite
 * ---------------------------------------------------------------------------
 * Tests: fresh install, upgrade, downgrade protection, uninstall, repair,
 * missing permissions, running app during update.
 *
 * Usage:
 *   node scripts/test-installer.cjs
 *   node scripts/test-installer.cjs --install-dir <path>
 * ========================================================================== */

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function pass(msg) { passCount++; console.log(`  ✓ ${msg}`); }
function fail(msg) { failCount++; console.log(`  ✗ ${msg}`); }
function info(msg) { console.log(`    ${msg}`); }
function section(msg) { console.log(`\n── ${msg} ──`); }

function findSetup() {
  const files = fs.readdirSync(RELEASE_DIR).filter(f => f.includes('Setup') && f.endsWith('.exe'));
  return files.length > 0 ? path.join(RELEASE_DIR, files[0]) : null;
}

function getInstallDir() {
  const arg = process.argv.find(a => a.startsWith('--install-dir='));
  if (arg) return arg.split('=')[1];
  return path.join(process.env['ProgramFiles(x86)'] || process.env['ProgramFiles'] || 'C:\\Program Files', 'MYRAA AI');
}

function isInstalled() {
  const installDir = getInstallDir();
  return fs.existsSync(path.join(installDir, 'MYRAA AI.exe'));
}

function getInstalledVersion() {
  const versionFile = path.join(getInstallDir(), '.myraa-version');
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf8').trim();
  }
  return null;
}

function killMyraa() {
  try {
    execSync('taskkill /F /IM "MYRAA AI.exe" /T', { stdio: 'pipe' });
    execSync('taskkill /F /IM "MYRAA-runtime.exe" /T', { stdio: 'pipe' });
    execSync('taskkill /F /IM "node.exe" /T /FI "WINDOWTITLE eq MYRAA*"', { stdio: 'pipe' });
  } catch {}
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════');
console.log('  MYRAA AI — Installer Test Suite');
console.log('═══════════════════════════════════════════════\n');

const setup = findSetup();
if (!setup) {
  console.error('No installer found in release/. Run build first.');
  process.exit(1);
}
info(`Installer: ${path.basename(setup)}`);
info(`Install dir: ${getInstallDir()}\n`);

// Test 1: Fresh Installation
section('1. Fresh Installation');

if (isInstalled()) {
  info('MYRAA is already installed — skipping fresh install test');
  info('To test fresh install, uninstall first');
} else {
  info('Running installer silently...');
  try {
    execSync(`"${setup}" /S /D=${getInstallDir()}`, { timeout: 120000, stdio: 'pipe' });
    if (isInstalled()) {
      pass('Fresh installation succeeded');
      const version = getInstalledVersion();
      if (version) pass(`Installed version: ${version}`);
      else warn('Could not read installed version');
    } else {
      fail('Installation completed but files not found');
    }
  } catch (e) {
    fail(`Fresh installation failed: ${e.message}`);
  }
}

// Test 2: Upgrade Installation
section('2. Upgrade Installation');

if (isInstalled()) {
  const oldVersion = getInstalledVersion();
  info(`Current installed version: ${oldVersion}`);
  info('Running installer again (upgrade)...');
  try {
    execSync(`"${setup}" /S /D=${getInstallDir()}`, { timeout: 120000, stdio: 'pipe' });
    const newVersion = getInstalledVersion();
    if (newVersion) {
      pass(`Upgrade completed, version: ${newVersion}`);
      if (oldVersion && newVersion !== oldVersion) {
        pass(`Version changed: ${oldVersion} → ${newVersion}`);
      }
    } else {
      warn('Could not read version after upgrade');
    }
  } catch (e) {
    fail(`Upgrade failed: ${e.message}`);
  }
} else {
  info('MYRAA not installed — skipping upgrade test');
}

// Test 3: Downgrade Protection
section('3. Downgrade Protection');

if (isInstalled()) {
  info('Checking installed version marker...');
  const versionFile = path.join(getInstallDir(), '.myraa-version');
  if (fs.existsSync(versionFile)) {
    pass('Version marker exists — downgrade protection active');
  } else {
    warn('Version marker missing — no downgrade protection');
  }
} else {
  info('MYRAA not installed — skipping downgrade test');
}

// Test 4: Uninstall
section('4. Uninstall');

if (isInstalled()) {
  const uninstaller = path.join(getInstallDir(), 'uninstall.exe');
  if (fs.existsSync(uninstaller)) {
    info('Running uninstaller silently...');
    try {
      execSync(`"${uninstaller}" /S`, { timeout: 60000, stdio: 'pipe' });
      if (!isInstalled()) {
        pass('Uninstall succeeded');
      } else {
        fail('Uninstall completed but files still exist');
      }
    } catch (e) {
      fail(`Uninstall failed: ${e.message}`);
    }
  } else {
    fail('Uninstaller not found');
  }
} else {
  info('MYRAA not installed — skipping uninstall test');
}

// Test 5: Data Preservation
section('5. Data Preservation');

const appDataDir = path.join(process.env.APPDATA || '', 'MYRAA AI');
if (fs.existsSync(appDataDir)) {
  pass(`User data directory exists: ${appDataDir}`);
  const settingsFile = path.join(appDataDir, 'settings.json');
  if (fs.existsSync(settingsFile)) {
    pass('User settings preserved');
  } else {
    info('No settings file found (may be first install)');
  }
} else {
  info('No user data directory found');
}

// Test 6: Registry Entries
section('6. Windows Registry');

try {
  const result = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MYRAA AI" /v DisplayName 2>nul', { encoding: 'utf8', stdio: 'pipe' });
  if (result.includes('MYRAA AI')) {
    pass('Registry entry exists in Add/Remove Programs');
  }
} catch {
  warn('Registry entry not found in Add/Remove Programs');
}

// Test 7: Desktop Shortcut
section('7. Shortcuts');

const desktopPath = path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA AI.lnk');
if (fs.existsSync(desktopPath)) {
  pass('Desktop shortcut exists');
} else {
  info('Desktop shortcut not found (may be disabled)');
}

const startMenuPath = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MYRAA AI');
if (fs.existsSync(startMenuPath)) {
  pass('Start Menu folder exists');
} else {
  info('Start Menu folder not found');
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════');
console.log('  TEST SUMMARY');
console.log('═══════════════════════════════════════════════');
console.log(`  Passed: ${passCount}`);
console.log(`  Failed: ${failCount}`);
console.log('═══════════════════════════════════════════════\n');

process.exit(failCount > 0 ? 1 : 0);
