#!/usr/bin/env node
/* ===========================================================================
 * MYRAA AI OS — Release Orchestrator (`npm run release:prepare`)
 * ---------------------------------------------------------------------------
 * Commands:
 *   node scripts/release.cjs prepare    → validate version, stamp CHANGELOG
 *                                        entry with build #, print next steps
 *   node scripts/release.cjs checksums  → recompute checksums.txt for a folder
 *   node scripts/release.cjs latest     → write latest.json manifest for updater
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'resources', 'app');
const PKG_PATH = path.join(APP_DIR, 'package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

const args = process.argv.slice(2);
const cmd = args[0] || 'prepare';

function fail(m) { console.error('✗ ' + m); process.exitCode = 1; }
function ok(m) { console.log('✓ ' + m); }
function read(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, 'utf8'); }

function buildNum() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.1`;
}

function isoDate() { return new Date().toISOString().slice(0, 10); }

function semver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

// ---------------------------------------------------------------- checksums
function checksumFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function checksumsRo(dir) {
  return new Promise((resolve, reject) => {
    const out = [];
    if (!fs.existsSync(dir)) return resolve('');
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) continue;
      if (/\.(txt|json|yml|yaml)$/i.test(e.name)) continue;
      try { out.push(`${e.name}\t${checksumFile(p)}`); } catch {}
    }
    resolve(out.join('\n') + '\n');
  });
}

// ---------------------------------------------------------------- changelog
function changelogHeader(version, channel = 'stable') {
  return `## [${version}] - ${isoDate()}\n\n### Status\n- Release channel: ${channel}\n- Build: ${buildNum()}\n\n### Added\n- (list new capabilities/features)\n\n### Improved\n- (list refinements)\n\n### Fixed\n- (list bug fixes)\n\n### Security\n- (list hardening)\n`;
}

function prepareChangelog() {
  const pkg = JSON.parse(read(PKG_PATH));
  const version = pkg.version;
  if (!semver(version)) { fail(`${version} is not semantic`); return; }

  let changelog = read(CHANGELOG) || '# Changelog\n\nAll notable changes to MYRAA AI OS are documented here.\n\n';
  if (!changelog.startsWith('# Changelog')) {
    changelog = '# Changelog\n\n' + changelog;
  }

  // Avoid duplicate header for same version.
  if (changelog.includes(`## [${version}]`)) {
    ok(`CHANGELOG already has [${version}] — no-op.`);
    return;
  }

  const insert = changelogHeader(version, 'stable');
  // Insert after "# Changelog ... \n\n" first paragraph
  const idx = changelog.indexOf('## [');
  if (idx === -1) changelog += '\n' + insert;
  else changelog = changelog.slice(0, idx) + insert + changelog.slice(idx);

  write(CHANGELOG, changelog);
  ok(`CHANGELOG.md stamped for v${version}`);
}

function latestManifest() {
  const pkg = JSON.parse(read(PKG_PATH));
  const version = pkg.version;
  const dir = path.join(APP_DIR, 'release');
  return checksumsRo(dir).then((sums) => {
    const manifest = {
      version,
      notes: `https://github.com/vishwajeetsrk/JARVIS-AI-OS/releases/tag/v${version}`,
      pub_date: new Date().toISOString(),
      platforms: {},
      checksums: sums,
    };
    write(path.join(ROOT, 'latest.json'), JSON.stringify(manifest, null, 2));
    ok('latest.json written');
  });
}

function printNextSteps() {
  const pkg = JSON.parse(read(PKG_PATH));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit CHANGELOG.md "Added/Improved/Fixed/Security" bullets.');
  console.log(`  2. npm run dist:win  (or dist:mac / dist:linux / dist:all)`);
  console.log('  3. Verify resources/app/release/ artifacts + checksums.txt');
  console.log(`  4. git add -A; git commit -m "chore: release v${pkg.version}"`);
  console.log(`  5. git tag v${pkg.version}; git push origin v${pkg.version}`);
  console.log('     → .github/workflows/release.yml builds + uploads GitHub Release.');
}

// ---------------------------------------------------------------- main
(async () => {
  switch (cmd) {
    case 'prepare': prepareChangelog(); printNextSteps(); break;
    case 'checksums': {
      const dir = args[1] || path.join(APP_DIR, 'release');
      const sums = await checksumsRo(dir);
      write(path.join(dir, 'checksums.txt'), sums || '');
      ok(`checksums.txt written for ${dir}`);
      break;
    }
    case 'latest': await latestManifest(); break;
    default: fail(`unknown subcommand '${cmd}'`); break;
  }
})();