'use strict';
/* ===========================================================================
 * MYRAA — Executable Resolver (finds the real MYRAA exe, no hardcoded paths)
 * ---------------------------------------------------------------------------
 * Searches candidate locations in priority order. Validates each candidate
 * (exists, is file, .exe extension). Never throws Windows "cannot find" dialog.
 * Returns the best match or null (caller shows recovery screen).
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');

function isValidExe(p) {
  try {
    if (!p || typeof p !== 'string') return false;
    if (path.extname(p).toLowerCase() !== '.exe') return false;
    if (!fs.existsSync(p)) return false;
    const stat = fs.statSync(p);
    if (!stat.isFile()) return false;
    if (stat.size < 1024) return false; // too small to be real
    return true;
  } catch (e) { return false; }
}

function resolveExecutable(opts = {}) {
  const candidates = [];
  const seen = new Set();

  function push(p) {
    if (!p || seen.has(p)) return;
    seen.add(p);
    candidates.push(p);
  }

  // ── 1) Explicit overrides ────────────────────────────────────────────────
  if (opts.explicitPath) push(path.resolve(opts.explicitPath));
  if (process.env.MYRAA_EXECUTABLE) push(path.resolve(process.env.MYRAA_EXECUTABLE));

  // ── 2) Stored install registry ───────────────────────────────────────────
  try {
    const pm = require('../core/paths/path_manager.cjs');
    const regPath = pm.getInstallRegistryPath();
    if (fs.existsSync(regPath)) {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      if (reg.executable_path) push(reg.executable_path);
      if (reg.install_path) {
        // Try standard exe name in stored install_path
        const { loadIdentity } = require('../core/config/app_identity.cjs');
        const id = loadIdentity();
        push(path.join(reg.install_path, id.EXECUTABLE_NAME));
        for (const legacy of (id.LEGACY_NAMES || [])) push(path.join(reg.install_path, legacy));
      }
    }
  } catch (e) {}

  // ── 3) Next to launcher / current exe ────────────────────────────────────
  const thisDir = (() => { try { return path.dirname(process.execPath); } catch (e) { return null; } })();
  if (thisDir) {
    try {
      const { loadIdentity } = require('../core/config/app_identity.cjs');
      const id = loadIdentity();
      push(path.join(thisDir, id.EXECUTABLE_NAME));
      for (const legacy of (id.LEGACY_NAMES || [])) push(path.join(thisDir, legacy));
    } catch (e) {}
    // Fallback if app_identity fails
    if (candidates.length === 0) {
      push(path.join(thisDir, 'MYRAA.exe'));
      push(path.join(thisDir, 'MYRAA AI.exe'));
    }
  }

  // ── 4) Next to this module (portable detection) ──────────────────────────
  try {
    const { loadIdentity } = require('../core/config/app_identity.cjs');
    const id = loadIdentity();
    push(path.join(__dirname, '..', '..', '..', id.EXECUTABLE_NAME));
  } catch (e) {
    push(path.join(__dirname, '..', '..', '..', 'MYRAA.exe'));
  }

  // ── 5) Standard install locations (dynamic, no hardcoded username) ───────
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  try {
    const { loadIdentity } = require('../core/config/app_identity.cjs');
    const id = loadIdentity();
    const exeNames = [id.EXECUTABLE_NAME, ...(id.LEGACY_NAMES || [])];
    for (const exe of exeNames) {
      push(path.join(localAppData, 'Programs', 'MYRAA', exe));
      push(path.join(localAppData, 'Programs', id.PRODUCT_NAME, exe));
      push(path.join(programFiles, 'MYRAA', exe));
      push(path.join(programFiles, id.PRODUCT_NAME, exe));
      push(path.join(programFiles, 'MYRAA AI', exe));
      push(path.join(programFiles, 'MYRAA AI OS', exe));
      push(path.join(programFilesX86, 'MYRAA', exe));
    }
  } catch (e) {
    for (const exe of ['MYRAA.exe', 'MYRAA AI.exe', 'MYRAA AI OS.exe']) {
      push(path.join(localAppData, 'Programs', 'MYRAA', exe));
      push(path.join(programFiles, 'MYRAA', exe));
      push(path.join(programFiles, 'MYRAA AI', exe));
    }
  }

  // ── 6) Registry uninstall info (Windows) ─────────────────────────────────
  // We try to read the registry via reg query (no extra deps)
  try {
    const { execSync } = require('child_process');
    const keys = [
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MYRAA',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MYRAA AI',
      'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MYRAA',
      'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MYRAA AI',
    ];
    for (const key of keys) {
      try {
        const out = execSync(`reg query "${key}" /v InstallLocation 2>nul`, { encoding: 'utf8', timeout: 800 });
        const m = out.match(/InstallLocation\s+REG_SZ\s+(.+)/);
        if (m) {
          const loc = m[1].trim();
          const { loadIdentity } = require('../core/config/app_identity.cjs');
          const id = loadIdentity();
          push(path.join(loc, id.EXECUTABLE_NAME));
          for (const legacy of (id.LEGACY_NAMES || [])) push(path.join(loc, legacy));
        }
      } catch (e) {}
      try {
        const out2 = execSync(`reg query "${key}" /v DisplayIcon 2>nul`, { encoding: 'utf8', timeout: 800 });
        const m2 = out2.match(/DisplayIcon\s+REG_SZ\s+(.+)/);
        if (m2) push(m2[1].trim().replace(/"/g, '').split(',')[0].trim());
      } catch (e) {}
    }
  } catch (e) {}

  // ── Validate and return first good candidate ─────────────────────────────
  for (const c of candidates) {
    if (isValidExe(c)) return { found: true, path: c, candidates };
  }
  return { found: false, path: null, candidates };
}

module.exports = { resolveExecutable, isValidExe };
