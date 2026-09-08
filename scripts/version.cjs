#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI OS — Single Source of Truth for Version (`npm run version:...`)
 * ---------------------------------------------------------------------------
 * Source of truth:  resolve(ROOT, 'resources/app/package.json').version
 * Syncs to:        src-tauri/Cargo.toml [package].version
 *                  src-tauri/tauri.conf.json .version
 *                  VERSION.md   (generated)
 *                  build/nsis-installer.nsh DetailPrint string (stub only)
 *
 * Usage:
 *   node scripts/version.cjs              → print current version + consumers
 *   node scripts/version.cjs patch        → 1.0.0 → 1.0.1
 *   node scripts/version.cjs minor        → 1.0.1 → 1.1.0
 *   node scripts/version.cjs major        → 1.1.0 → 2.0.0
 *   node scripts/version.cjs 1.2.3        → explicit
 *   node scripts/version.cjs sync         → re-sync consumers without bumping
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'resources', 'app');
const PKG_PATH = path.join(APP_DIR, 'package.json');
const VERSION_JSON = path.join(APP_DIR, 'version.json');
const CARGO_PATH = path.join(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_PATH = path.join(ROOT, 'src-tauri', 'tauri.conf.json');
const NSIS_PATH = path.join(APP_DIR, 'build', 'nsis-installer.nsh');
const VERSION_MD_PATH = path.join(ROOT, 'VERSION.md');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function fail(msg) { console.error('✗ ' + msg); process.exitCode = 1; return; }
function ok(msg) { console.log('✓ ' + msg); }

function loadPkg() {
  if (!fs.existsSync(PKG_PATH)) { fail('package.json missing at ' + PKG_PATH); process.exit(1); }
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function bump(version, type) {
  const m = version.match(SEMVER);
  if (!m) { fail('Current version is not semantic: ' + version); process.exit(1); }
  let [_, maj, min, pat] = m.map(Number);
  if (type === 'major') { maj++; min = 0; pat = 0; }
  else if (type === 'minor') { min++; pat = 0; }
  else if (type === 'patch') { pat++; }
  else { fail("Unknown bump type '" + type + "' (expected patch|minor|major)."); process.exit(1); }
  return `${maj}.${min}.${pat}`;
}

// Rust Cargo.toml: set [package] version = "x.y.z"
function setCargoVersion(filePath, version) {
  if (!fs.existsSync(filePath)) { console.warn('  ! Cargo.toml missing, skipped'); return; }
  let s = fs.readFileSync(filePath, 'utf8');
  // Replace version line directly under [package] (before the first blank line)
  const re = /(^\[package\]\s*(?:\n[^\[]*?)?\n)version\s*=\s*"[^"]*"/;
  if (re.test(s)) { s = s.replace(re, (m, prefix) => `${prefix}version = "${version}"`); fs.writeFileSync(filePath, s); ok('   Cargo.toml [package].version = ' + version); }
  else { console.warn('  ! [package] version not found in ' + filePath); }
}

function setTauriVersion(filePath, version) {
  if (!fs.existsSync(filePath)) { console.warn('  ! tauri.conf.json missing, skipped'); return; }
  const j = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (j.version === undefined) { console.warn('  ! no .version key, skipped'); return; }
  j.version = version;
  fs.writeFileSync(filePath, JSON.stringify(j, null, 2) + '\n');
  ok('   tauri.conf.json .version = ' + version);
}

function setNsisVersion(filePath, version) {
  if (!fs.existsSync(filePath)) { console.warn('  ! nsis-installer.nsh missing, skipped'); return; }
  let s = fs.readFileSync(filePath, 'utf8');
  const m = s.match(/DetailPrint\s+"([^"]*)"/);
  if (m) {
    s = s.replace(m[1], `MYRAA AI OS ${version} installer initializing...`);
    fs.writeFileSync(filePath, s);
    ok('   nsis-installer.nsh DetailPrint = ' + version);
  }
}

function setVersionJson(filePath, version) {
  if (!fs.existsSync(filePath)) { console.warn('  ! version.json missing, creating...'); }
  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
  data.version = version;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  ok('   version.json .version = ' + version);
}

function buildDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.1`;
}

function writeVersionMd(filePath, version) {
  const md = `# Version

**Current Version:** ${version}
**Build:** ${buildDate()}

## Release Strategy

Semantic Versioning (MAJOR.MINOR.PATCH)

- **MAJOR** — breaking architecture changes (e.g., 2.0.0 shell decision)
- **MINOR** — new features and capabilities (e.g., 1.1.0 agents + plugins)
- **PATCH** — bug fixes and improvements (e.g., 1.1.1)

## Update Channels

- **Stable** — production-ready releases (default)
- **Beta** — new features before stable
- **Development** — internal testing

## Release Process

1. Development
2. Testing
3. Version bump  — \`npm run version:patch|minor|major\`
4. Changelog update  — \`npm run release:prepare\`
5. Build  — \`npm run dist:win|mac|linux|all\`
6. GitHub Release  — tag \`v*.*.*\`, workflow \`.github/workflows/release.yml\`
7. Auto-update distribution  — electron-updater reads GitHub Releases (provider: vishwajeetsrk/JARVIS-AI-OS)

## Build Metadata

Generated: ${new Date().toISOString()}
`;
  fs.writeFileSync(filePath, md, 'utf8');
  ok('   VERSION.md written');
}

// ------------------------------------------------ main
const argv = process.argv.slice(2);

let pkg = loadPkg();
let current = pkg.version || '0.0.0';
console.log('MYRAA current version: ' + current);

// -- what are we doing?
if (argv.length === 0) {
  console.log('Usage: node scripts/version.cjs [patch|minor|major|1.2.3|sync]');
  console.log('Consumers:');
  setCargoVersion(CARGO_PATH, current);      // no-op read (idempotent re-write)
  setTauriVersion(TAURI_PATH, current);
  setVersionJson(VERSION_JSON, current);
  process.exit(0);
}

let next = null;
const cmd = argv[0];
if (cmd === 'sync') { next = current; }
else if (SEMVER.test(cmd)) { next = cmd; }
else if (['patch','minor','major'].includes(cmd)) { next = bump(current, cmd); }
else { fail(`Unknown command: ${cmd}`); process.exit(1); }

if (next === current && cmd !== 'sync') {
  console.log('Already at ' + current + ' — nothing to bump. Use "sync" to re-sync consumers.');
}

pkg.version = next;
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
ok('package.json version = ' + next);

setCargoVersion(CARGO_PATH, next);
setTauriVersion(TAURI_PATH, next);
setNsisVersion(NSIS_PATH, next);
setVersionJson(VERSION_JSON, next);
writeVersionMd(VERSION_MD_PATH, next);

console.log('');
console.log(`MYRAA version → ${next}`);
console.log('Next: npm run release:prepare (changelog) → npm run dist:win → tag v' + next + ' → push');