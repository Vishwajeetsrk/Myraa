#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI — Code Signing Script
 * ---------------------------------------------------------------------------
 * Signs all executables and DLLs with Authenticode (SHA256).
 *
 * Usage:
 *   node scripts/sign.cjs --cert <path-to-pfx> --password <pw>
 *   node scripts/sign.cjs --cert <path-to-pfx>              (interactive pw)
 *   CSC_LINK=<pfx> CSC_KEY_PASSWORD=<pw> node scripts/sign.cjs
 *
 * Requires: signtool.exe (Windows SDK)
 * ========================================================================== */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[SIGN] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

// ── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let certPath = process.env.CSC_LINK || process.env.WIN_CSC_LINK;
let certPassword = process.env.CSC_KEY_PASSWORD;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cert' && args[i + 1]) certPath = args[++i];
  if (args[i] === '--password' && args[i + 1]) certPassword = args[++i];
}

if (!certPath) {
  fail('No certificate specified.\nUsage: node scripts/sign.cjs --cert <path-to-pfx> [--password <pw>]\nOr set CSC_LINK and CSC_KEY_PASSWORD env vars.');
}

if (!fs.existsSync(certPath)) {
  fail(`Certificate file not found: ${certPath}`);
}

// ── Find signtool ────────────────────────────────────────────────────────────

function findSigntool() {
  const candidates = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22000.0\\x64\\signtool.exe',
    'C:\\Program Files\\Microsoft SDKs\\ClickOnce\\SignTool\\signtool.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    execSync('where signtool', { stdio: 'pipe' });
    return 'signtool';
  } catch {}
  fail('signtool.exe not found. Install Windows SDK or Visual Studio.');
}

// ── Find files to sign ──────────────────────────────────────────────────────

function findFiles(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(full, exts));
    } else if (exts.some(ext => item.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// ── Sign a file ──────────────────────────────────────────────────────────────

function signFile(signtool, filePath) {
  const args = [
    'sign',
    '/fd', 'SHA256',
    '/tr', 'http://timestamp.digicert.com',
    '/td', 'SHA256',
    '/f', `"${certPath}"`,
  ];
  if (certPassword) args.push('/p', `"${certPassword}"`);
  args.push(`"${filePath}"`);

  try {
    execSync(`"${signtool}" ${args.join(' ')}`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

// ── Verify a file ────────────────────────────────────────────────────────────

function verifyFile(signtool, filePath) {
  try {
    execSync(`"${signtool}" verify /pa /v "${filePath}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  MYRAA AI — Code Signing');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Certificate: ${certPath}`);
  console.log('═══════════════════════════════════════════════\n');

  const signtool = findSigntool();
  log(`signtool: ${signtool}`);

  // Find all executables and DLLs
  const winUnpacked = path.join(RELEASE_DIR, 'win-unpacked');
  const files = [
    ...findFiles(winUnpacked, ['.exe', '.dll']),
    ...findFiles(RELEASE_DIR, ['.exe']).filter(f => f.includes('Setup')),
  ];

  if (files.length === 0) {
    warn('No files found to sign. Run build first.');
    return;
  }

  log(`Found ${files.length} files to sign\n`);

  let signed = 0;
  let failed = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    process.stdout.write(`  Signing: ${rel} ... `);

    if (signFile(signtool, file)) {
      console.log('✓');
      signed++;
    } else {
      console.log('✗');
      failed++;
    }
  }

  console.log(`\n───────────────────────────────────────────────`);
  log(`Signed: ${signed}/${files.length}`);

  if (failed > 0) {
    warn(`${failed} files failed to sign`);
  }

  // Verify signatures
  console.log(`\n───────────────────────────────────────────────`);
  log('Verifying signatures...\n');

  let verified = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    process.stdout.write(`  Verify: ${rel} ... `);

    if (verifyFile(signtool, file)) {
      console.log('✓');
      verified++;
    } else {
      console.log('✗');
    }
  }

  console.log(`\n───────────────────────────────────────────────`);
  log(`Verified: ${verified}/${files.length}`);

  if (verified < files.length) {
    warn('Some files could not be verified — they may be unsigned');
  }

  console.log(`\n═══════════════════════════════════════════════`);
  if (signed === files.length && verified === files.length) {
    console.log('  SIGNING COMPLETE — All files signed and verified');
  } else {
    console.log('  SIGNING COMPLETE — Some files may need attention');
  }
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(err => {
  fail(err.message);
});
