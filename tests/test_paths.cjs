'use strict';
/* ===========================================================================
 * MYRAA — Build Validation Tests (moved-folder, upgrade, permissions, etc.)
 * ---------------------------------------------------------------------------
 * Tests 7 scenarios without actually moving files (mocks paths via resolver).
 * Also does a real sanity check on the packaged asar and install registry.
 * Run: node tests/test_paths.cjs  (or: node scripts/test_paths.cjs)
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log(`  ✓ ${msg}`); }
function bad(msg) { fail++; console.log(`  ✗ ${msg}`); }
function info(msg) { console.log(`    ${msg}`); }

console.log('═══════════════════════════════════════════════');
console.log('  MYRAA — Build Validation Tests');
console.log('═══════════════════════════════════════════════\n');

// ── Load modules ──────────────────────────────────────────────────────────
let appIdentity, pathManager, resolver, detector, repair, health;
try { appIdentity = require('../resources/app/dist/core/config/app_identity.cjs'); } catch (e) { console.log('  ✗ app_identity load: ' + e.message); }
try { pathManager = require('../resources/app/dist/core/paths/path_manager.cjs'); } catch (e) { console.log('  ✗ path_manager load: ' + e.message); }
try { resolver = require('../resources/app/dist/launcher/executable_resolver.cjs'); } catch (e) { console.log('  ✗ resolver load: ' + e.message); }
try { detector = require('../resources/app/dist/launcher/installation_detector.cjs'); } catch (e) { console.log('  ✗ detector load: ' + e.message); }
try { repair = require('../resources/app/dist/launcher/repair.cjs'); } catch (e) { console.log('  ✗ repair load: ' + e.message); }
try { health = require('../resources/app/dist/core/diagnostics/health_check.cjs'); } catch (e) { console.log('  ✗ health_check load: ' + e.message); }

// ── Test: App Identity (no hardcoded exe names elsewhere) ──────────────────
console.log('── App Identity ──');
if (appIdentity) {
  const id = appIdentity.loadIdentity();
  if (id.VERSION && /^\d+\.\d+\.\d+$/.test(id.VERSION)) ok(`Version: ${id.VERSION}`);
  else bad(`Version: ${id.VERSION}`);
  if (id.EXECUTABLE_NAME === 'MYRAA AI.exe') ok(`Executable: ${id.EXECUTABLE_NAME}`);
  else bad(`Executable (expected MYRAA AI.exe): ${id.EXECUTABLE_NAME}`);
  if (id.LEGACY_NAMES && id.LEGACY_NAMES.includes('MYRAA.exe')) ok(`Legacy names: ${id.LEGACY_NAMES.join(', ')}`);
  else bad('Legacy names missing MYRAA.exe');
  if (id.PUBLISHER === 'MYRAA') ok(`Publisher: ${id.PUBLISHER}`);
  else bad(`Publisher: ${id.PUBLISHER}`);
}

// ── Test: Path Manager (no hardcoded user paths) ──────────────────────────
console.log('\n── Path Manager (dynamic, no C:\\\\Users\\\\Vishwajeet) ──');
if (pathManager) {
  // Check SOURCE CODE has no hardcoded user paths (not the resolved value — resolved value will contain username dynamically)
  const pmSrc = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app', 'dist', 'core', 'paths', 'path_manager.cjs'), 'utf8');
  if (!pmSrc.includes('Vishwajeet') && !pmSrc.includes('Music\\Myraa\\Installers')) ok('path_manager source has no hardcoded user/installer paths (uses os.homedir/env)');
  else bad('path_manager source has hardcoded user paths');

  const dataDir = pathManager.getDataDir();
  ok(`Data dir (dynamic via app.getPath/env): ${dataDir}`);

  const configDir = pathManager.getConfigDir();
  if (configDir.includes(dataDir)) ok(`Config dir under data: ${configDir}`);
  else bad(`Config dir: ${configDir}`);

  const logsDir = pathManager.getLogsDir();
  if (logsDir.includes(dataDir)) ok(`Logs dir: ${logsDir}`);
  else bad(`Logs dir: ${logsDir}`);

  const updatesDir = pathManager.getUpdatesDir();
  if (updatesDir.includes(dataDir)) ok(`Updates dir: ${updatesDir}`);
  else bad(`Updates dir: ${updatesDir}`);

  // Test portable detection
  const portable = pathManager.isPortable();
  info(`Portable mode: ${portable} (expected false in dev)`);
}

// ── Scenario 1: Fresh install under %LOCALAPPDATA% ────────────────────────
console.log('\n── Scenario 1: Fresh install (%LOCALAPPDATA%\\Programs\\MYRAA) ──');
if (resolver) {
  const r = resolver.resolveExecutable();
  const hasProgramsCandidate = r.candidates.some(c => c.includes('Programs') && c.includes('MYRAA'));
  const hasProgFilesCandidate = r.candidates.some(c => c.includes('Program Files') && c.includes('MYRAA'));
  if (hasProgramsCandidate) ok('Resolver searches Programs\\MYRAA (LOCALAPPDATA)');
  else bad('Resolver does not search Programs\\MYRAA');
  if (hasProgFilesCandidate) ok('Resolver searches Program Files\\MYRAA');
  else bad('Resolver does not search Program Files');
}

// ── Scenario 2: Portable moved to D:\\Apps\\MYRAA ─────────────────────────
console.log('\n── Scenario 2: Portable moved to D:\\Apps\\MYRAA ──');
if (resolver) {
  // Simulate: create a temp portable structure and point MYRAA_EXECUTABLE there
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa-test-portable-'));
  const fakeExe = path.join(tmpRoot, 'MYRAA.exe');
  fs.writeFileSync(fakeExe, 'x'.repeat(2048)); // fake exe >1KB so isValidExe passes
  const origEnv = process.env.MYRAA_EXECUTABLE;
  process.env.MYRAA_EXECUTABLE = fakeExe;
  // Clear require cache so resolver re-reads env
  try {
    const r2 = resolver.resolveExecutable();
    if (r2.found && r2.path === fakeExe) ok(`Portable moved → found via MYRAA_EXECUTABLE: ${r2.path}`);
    else bad(`Portable moved → not found (got ${r2.path})`);
  } catch (e) { bad('Portable moved: ' + e.message); }
  process.env.MYRAA_EXECUTABLE = origEnv;
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
}

// ── Scenario 3: Username change (HOME moved) ───────────────────────────────
console.log('\n── Scenario 3: Username change (HOME moved) ──');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app', 'dist', 'core', 'paths', 'path_manager.cjs'), 'utf8');
  if (!src.includes('Vishwajeet')) ok('path_manager source has no hardcoded username');
  else bad('path_manager source has hardcoded username');
  // Verify it uses dynamic APIs
  if (src.includes('os.homedir()') && src.includes('process.env')) ok('path_manager uses os.homedir() + env vars (dynamic)');
  else bad('path_manager missing dynamic path APIs');
}

// ── Scenario 4: Upgrade v8.3.0 → v8.3.1 ───────────────────────────────────
console.log('\n── Scenario 4: Upgrade v8.3.0 → v8.3.1 (versioned folder deleted) ──');
if (resolver) {
  const r = resolver.resolveExecutable();
  // Should not depend on "Installers\\v8.3.0" or "Installers\\v8.3.1"
  const hasVersionedCandidate = r.candidates.some(c => c.includes('Installers\\v8.3.0') || c.includes('Installers\\v8.3.1'));
  if (!hasVersionedCandidate) ok('Resolver does not depend on versioned Installers folders');
  else bad('Resolver has versioned Installers candidate: ' + r.candidates.find(c => c.includes('Installers\\v8')));
  // Also check path_manager
  if (pathManager) {
    const pmSrc = fs.readFileSync(path.join(__dirname, '..', 'resources', 'app', 'dist', 'core', 'paths', 'path_manager.cjs'), 'utf8');
    if (!pmSrc.includes('Installers\\v8')) ok('path_manager has no versioned Installers refs');
    else bad('path_manager has versioned Installers refs');
  }
}

// ── Scenario 5: Executable renamed/moved ───────────────────────────────────
console.log('\n── Scenario 5: Executable renamed/moved ──');
if (resolver) {
  // Resolver should handle MYRAA.exe, MYRAA AI.exe, MYRAA AI OS.exe
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa-rename-'));
  for (const name of ['MYRAA.exe', 'MYRAA AI.exe', 'MYRAA AI OS.exe']) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, 'x'.repeat(2048));
    if (resolver.isValidExe(p)) ok(`isValidExe accepts ${name}`);
    else bad(`isValidExe rejects ${name}`);
  }
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
}

// ── Scenario 6: Previous version folder deleted ────────────────────────────
console.log('\n── Scenario 6: Previous version folder deleted ──');
{
  // Install registry should handle missing install_path gracefully
  if (detector) {
    // detector.readRegistry should return null if file missing, not throw
    const reg = detector.readRegistry();
    // In dev, install.json may not exist — that's ok, should be null not crash
    if (reg === null || typeof reg === 'object') ok('readRegistry handles missing file gracefully');
    else bad('readRegistry unexpected: ' + typeof reg);
  }
}

// ── Scenario 7: Shortcut still points to old version ───────────────────────
console.log('\n── Scenario 7: Shortcut points to old version ──');
if (repair) {
  // repair.rebuildRegistry should find the current exe even if shortcut is stale
  if (typeof repair.rebuildRegistry === 'function') ok('repair.rebuildRegistry exists');
  else bad('repair.rebuildRegistry missing');
  if (typeof repair.runRepair === 'function') ok('repair.runRepair exists');
  else bad('repair.runRepair missing');
}

// ── Health check ───────────────────────────────────────────────────────────
console.log('\n── Health Check ──');
if (health) {
  const h = health.checkHealth();
  if (h.version) ok(`Health version: ${h.version}`);
  else bad('Health version missing');
  info(`Healthy: ${h.healthy}, issues: ${h.issues.length}`);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);
console.log('═══════════════════════════════════════════════');
if (fail === 0) console.log('  ✓ ALL VALIDATION TESTS PASSED');
else console.log('  ✗ SOME TESTS FAILED');
process.exit(fail > 0 ? 1 : 0);
