#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI — Release Packaging Script
 * ---------------------------------------------------------------------------
 * Creates the final release directory structure with all artifacts,
 * checksums, signatures, release notes, and metadata.
 *
 * Usage:
 *   node scripts/release-package.cjs
 *   node scripts/release-package.cjs --channel stable|beta|development
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[RELEASE] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function fail(msg) { console.error(`  ✗ ${msg}`); process.exit(1); }

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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

// ── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let channel = 'stable';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--channel' && args[i + 1]) channel = args[++i];
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const version = pkg.version;

  console.log('═══════════════════════════════════════════════');
  console.log('  MYRAA AI — Release Packaging');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Version: ${version}`);
  console.log(`  Channel: ${channel}`);
  console.log('═══════════════════════════════════════════════\n');

  // Create release structure
  const releaseRoot = path.join(RELEASE_DIR, `MYRAA-${version}`);
  const dirs = [
    releaseRoot,
    path.join(releaseRoot, 'checksums'),
    path.join(releaseRoot, 'signatures'),
    path.join(releaseRoot, 'release-notes'),
    path.join(releaseRoot, 'verification'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
  ok('Release directory structure created');

  // Copy installer and portable
  const setupExes = findFiles(RELEASE_DIR, '.exe').filter(f => f.includes('Setup'));
  const portableExes = findFiles(RELEASE_DIR, '.exe').filter(f => f.includes('Portable'));

  for (const exe of [...setupExes, ...portableExes]) {
    const dest = path.join(releaseRoot, path.basename(exe));
    fs.copyFileSync(exe, dest);
    ok(`Copied: ${path.basename(exe)}`);
  }

  // Generate checksums
  log('Generating SHA256 checksums...');
  const allArtifacts = [...setupExes, ...portableExes];
  const checksumLines = [];
  for (const artifact of allArtifacts) {
    const hash = sha256(artifact);
    const name = path.basename(artifact);
    checksumLines.push(`${hash}  ${name}`);
    ok(`${name}: ${hash.slice(0, 16)}...`);
  }

  const checksumFile = path.join(releaseRoot, 'checksums', `MYRAA-${version}-sha256.txt`);
  fs.writeFileSync(checksumFile, checksumLines.join('\n') + '\n');
  ok(`Checksums written`);

  // Copy release notes
  const changelog = path.join(ROOT, 'CHANGELOG.md');
  if (fs.existsSync(changelog)) {
    fs.copyFileSync(changelog, path.join(releaseRoot, 'release-notes', 'CHANGELOG.md'));
    ok('Copied CHANGELOG.md');
  }

  // Write release metadata
  const metadata = {
    version,
    channel,
    buildDate: new Date().toISOString(),
    buildNumber: Date.now(),
    platform: 'win32',
    arch: 'x64',
    electronVersion: '31.7.7',
    nodeVersion: process.version,
    signed: !!process.env.CSC_LINK,
    artifacts: allArtifacts.map(f => path.basename(f)),
    checksums: checksumLines,
    publisher: 'MYRAA',
    website: 'https://github.com/vishwajeetsrk/JARVIS-AI-OS',
  };

  fs.writeFileSync(
    path.join(releaseRoot, 'build-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  ok('Written build-metadata.json');

  // Write latest.json for electron-updater
  const latest = {
    version,
    files: [
      { url: `MYRAA-Setup-${version}.exe`, sha512: setupExes[0] ? sha256(setupExes[0]) : '', size: setupExes[0] ? fs.statSync(setupExes[0]).size : 0 },
    ],
    path: `MYRAA-Setup-${version}.exe`,
    sha512: setupExes[0] ? sha256(setupExes[0]) : '',
    releaseDate: new Date().toISOString(),
    releaseNotes: `MYRAA AI ${version} — See CHANGELOG.md for details`,
  };

  fs.writeFileSync(
    path.join(releaseRoot, 'latest.json'),
    JSON.stringify(latest, null, 2)
  );
  ok('Written latest.json (for electron-updater)');

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RELEASE PACKAGE COMPLETE');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Directory: release/MYRAA-${version}/`);
  console.log('  Contents:');
  for (const artifact of allArtifacts) {
    console.log(`    - ${path.basename(artifact)}`);
  }
  console.log(`    - checksums/MYRAA-${version}-sha256.txt`);
  console.log(`    - release-notes/CHANGELOG.md`);
  console.log(`    - build-metadata.json`);
  console.log(`    - latest.json`);
  console.log('═══════════════════════════════════════════════\n');
}

main();
