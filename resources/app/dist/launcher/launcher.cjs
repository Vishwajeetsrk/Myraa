'use strict';
/* ===========================================================================
 * MYRAA — Launcher (6-step startup verification)
 * ---------------------------------------------------------------------------
 * Called from electron/main.cjs bootstrap(). Each step validates and logs.
 * Never shows Windows "cannot find" dialog — shows MYRAA recovery instead.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

async function runLauncherSteps(log) {
  const steps = [];
  function step(n, msg) {
    const line = `[${n}/6] ${msg}`;
    steps.push(line);
    if (log) log(line);
  }

  // ── [1/6] Checking MYRAA installation ───────────────────────────────────
  step(1, 'Checking MYRAA installation');
  const pm = require('../core/paths/path_manager.cjs');
  pm.ensureDataDirs();
  const { loadIdentity } = require('../core/config/app_identity.cjs');
  const id = loadIdentity();
  const health = require('../core/diagnostics/health_check.cjs').writeStartupDiagnostics();
  step(1, `  → ${id.PRODUCT_NAME} v${id.VERSION} — ${health.healthy ? 'healthy' : health.issues.join('; ')}`);

  // ── [2/6] Resolving executable path ──────────────────────────────────────
  step(2, 'Resolving executable path');
  const { resolveExecutable } = require('./executable_resolver.cjs');
  const resolved = resolveExecutable();
  if (!resolved.found) {
    step(2, `  ✗ Not found — searched ${resolved.candidates.length} locations`);
    return { ok: false, reason: 'executable_not_found', searched: resolved.candidates.slice(0, 8), steps };
  }
  step(2, `  ✓ ${resolved.path}`);

  // ── [3/6] Verifying required files ───────────────────────────────────────
  step(3, 'Verifying required files');
  // Check that the backend bundle exists (unpacked path preferred)
  const backendCandidates = (() => {
    try {
      const exeDir = path.dirname(resolved.path);
      // If exe is in e.g. C:\Program Files\MYRAA\MYRAA.exe, resources is sibling
      const resourcesCandidates = [
        path.join(exeDir, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
        path.join(exeDir, 'resources', 'app', 'dist', 'server.cjs'),
        path.join(path.dirname(exeDir), 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
      ];
      return resourcesCandidates;
    } catch (e) { return []; }
  })();
  let backendFound = false;
  for (const c of backendCandidates) {
    if (fs.existsSync(c)) { backendFound = true; step(3, `  ✓ Backend: ${c}`); break; }
  }
  if (!backendFound) {
    // Fallback: check relative to this launcher module (dev mode)
    const devBackend = path.join(__dirname, '..', 'server.cjs');
    if (fs.existsSync(devBackend)) { backendFound = true; step(3, `  ✓ Backend (dev): ${devBackend}`); }
  }
  if (!backendFound) step(3, '  ⚠ Backend bundle not found — will try standard resolution');

  // ── [4/6] Checking configuration ─────────────────────────────────────────
  step(4, 'Checking configuration');
  const { validateInstallation } = require('./installation_detector.cjs');
  const installCheck = validateInstallation();
  if (installCheck.ok) step(4, `  ✓ ${installCheck.installType} at ${installCheck.installPath}`);
  else step(4, `  ⚠ ${installCheck.hint || 'no registry'}`);

  // ── [5/6] Checking updates (non-blocking) ─────────────────────────────────
  step(5, 'Checking updates');
  try {
    // Only check if we have a cached update check result; don't block startup
    step(5, '  → Update check deferred to background (after window ready)');
  } catch (e) { step(5, `  ⚠ ${e.message}`); }

  // ── [6/6] Starting MYRAA ─────────────────────────────────────────────────
  step(6, 'Starting MYRAA');
  step(6, '  ✓ Ready to launch');

  return { ok: true, executable: resolved.path, steps, health };
}

module.exports = { runLauncherSteps };
