'use strict';
/* ===========================================================================
 * MYRAA — Self-Repair System
 * ---------------------------------------------------------------------------
 * Repairs broken installs: missing exe, moved folder, broken registry,
 * broken shortcuts, invalid cache. Never deletes user data without confirm.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

function repairShortcuts(executablePath) {
  if (!executablePath || !fs.existsSync(executablePath)) return { ok: false, reason: 'no executable' };
  if (process.platform !== 'win32') return { ok: true, skipped: 'not windows' };

  const results = [];
  try {
    const { execSync } = require('child_process');
    const home = require('os').homedir();
    const desktop = path.join(home, 'Desktop');
    const startMenu = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MYRAA AI');

    // Repair via PowerShell shortcut creation (stable: shortcut → launcher or exe)
    const psScript = `
      $WshShell = New-Object -comObject WScript.Shell
      $targets = @("${desktop.replace(/"/g, '""')}\\MYRAA AI.lnk", "${startMenu.replace(/"/g, '""')}\\MYRAA AI.lnk")
      foreach ($lnk in $targets) {
        try {
          $dir = Split-Path $lnk -Parent
          if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
          $s = $WshShell.CreateShortcut($lnk)
          $s.TargetPath = "${executablePath.replace(/"/g, '""')}"
          $s.WorkingDirectory = "${path.dirname(executablePath).replace(/"/g, '""')}"
          $s.IconLocation = "${executablePath.replace(/"/g, '""')}"
          $s.Description = "MYRAA AI Desktop Assistant"
          $s.Save()
          Write-Output "OK:$lnk"
        } catch { Write-Output "FAIL:$lnk" }
      }
    `;
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, { encoding: 'utf8', timeout: 8000 });
    for (const line of out.split('\n')) {
      if (line.startsWith('OK:')) results.push({ path: line.slice(3).trim(), ok: true });
      else if (line.startsWith('FAIL:')) results.push({ path: line.slice(5).trim(), ok: false });
    }
  } catch (e) {
    return { ok: false, error: e.message, results };
  }
  return { ok: true, results };
}

function clearInvalidCache() {
  const pm = require('../core/paths/path_manager.cjs');
  let cleared = 0;
  try {
    const fs2 = require('fs');
    const cacheDir = pm.getCacheDir();
    if (fs2.existsSync(cacheDir)) {
      // Only clear known invalid cache files, not user data
      const invalidPatterns = ['.cache-invalid', 'corrupted', '.tmp'];
      for (const entry of fs2.readdirSync(cacheDir)) {
        for (const pat of invalidPatterns) {
          if (entry.includes(pat)) {
            try { fs2.rmSync(path.join(cacheDir, entry), { recursive: true, force: true }); cleared++; } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}
  return { cleared };
}

function rebuildRegistry(executablePath) {
  if (!executablePath) {
    const { resolveExecutable } = require('./executable_resolver.cjs');
    const r = resolveExecutable();
    if (!r.found) return { ok: false, reason: 'no executable found to rebuild registry' };
    executablePath = r.path;
  }
  const { writeRegistry } = require('./installation_detector.cjs');
  const { loadIdentity } = require('../core/config/app_identity.cjs');
  const id = loadIdentity();
  const { detectInstallType } = require('./installation_detector.cjs');
  const installPath = path.dirname(executablePath);
  const ok = writeRegistry({
    app_name: id.APP_NAME,
    product_name: id.PRODUCT_NAME,
    version: id.VERSION,
    install_path: installPath,
    executable_path: executablePath,
    install_type: detectInstallType(executablePath),
    repaired_at: new Date().toISOString(),
  });
  return { ok, installPath, executable: executablePath };
}

async function runRepair(opts = {}) {
  const steps = [];
  const log = (msg) => steps.push(`[${new Date().toISOString()}] ${msg}`);

  log('MYRAA Repair started');

  // 1. Find executable
  const { resolveExecutable } = require('./executable_resolver.cjs');
  const resolved = resolveExecutable(opts);
  if (!resolved.found) {
    log('FAIL: executable not found in any candidate location');
    return { ok: false, steps, searched: resolved.candidates.slice(0, 10), hint: 'Browse to MYRAA.exe location or reinstall.' };
  }
  log(`Found executable: ${resolved.path}`);

  // 2. Rebuild registry
  const reg = rebuildRegistry(resolved.path);
  if (reg.ok) log(`Registry rebuilt: ${reg.installPath}`);
  else log(`Registry rebuild failed: ${reg.reason}`);

  // 3. Repair shortcuts
  const sc = repairShortcuts(resolved.path);
  if (sc.ok) log(`Shortcuts repaired: ${(sc.results || []).filter(r => r.ok).length} OK`);
  else log(`Shortcut repair: ${sc.error || sc.reason || 'skipped'}`);

  // 4. Clear invalid cache
  const cc = clearInvalidCache();
  if (cc.cleared > 0) log(`Cleared ${cc.cleared} invalid cache entries`);
  else log('Cache clean');

  log('Repair complete');
  return { ok: true, steps, executable: resolved.path, installPath: path.dirname(resolved.path) };
}

module.exports = { repairShortcuts, clearInvalidCache, rebuildRegistry, runRepair };
