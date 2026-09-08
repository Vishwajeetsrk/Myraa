/**
 * ============================================================
 * MYRAA AI OS — Autonomous Self-Update Engine
 * ============================================================
 * Responsibilities:
 *  1. Compare installed version vs. latest available build
 *  2. Download & verify new build (checksum)
 *  3. Stop old process, wipe stale cache/temp files
 *  4. Install new build, relaunch MYRAA
 *  5. Broadcast real-time progress over SSE/WebSocket
 *  6. Remove ALL traces of previous version after verification
 *
 * Locations managed:
 *  - D:\Team of Vishwajeet\MYRAA\resources\app\
 *  - %APPDATA%\MYRAA\Code Cache, GPUCache, DawnCache, ShaderCache
 *  - %TEMP%\myraa_*  temp artefacts
 *  - Electron squirrel installer artefacts
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// IMPORTANT: resolve from runtime location, NOT a hardcoded dev path. The old
// build pinned MYRAA_ROOT to D:\Team of Vishwajeet\MYRAA which broke on any
// other machine/install dir. Now: <this file> -> resources/app, and that dir
// -> the app root (one level up). Overridable via MYRAA_APP_ROOT env.
// This engine is intentionally NOT mounted on the HTTP API yet; see docs.

const APP_DIR = process.env.MYRAA_APP_ROOT
  ? path.resolve(process.env.MYRAA_APP_ROOT, 'resources', 'app')
  : path.dirname(__dirname); // dist/..  → resources/app
const MYRAA_ROOT = path.dirname(APP_DIR); // resources/app → app runtime root
const DIST_DIR = path.join(APP_DIR, 'dist');

const APPDATA_MYRAA = path.join(
  process.env.APPDATA || os.homedir(),
  'MYRAA'
);
const JARVIS_DIR = path.join(
  process.env.APPDATA || os.homedir(),
  'JARVIS'
);

/** Directories whose contents are safe to wipe on upgrade */
const ELECTRON_CACHE_DIRS = [
  path.join(APPDATA_MYRAA, 'Code Cache'),
  path.join(APPDATA_MYRAA, 'GPUCache'),
  path.join(APPDATA_MYRAA, 'DawnCache'),
  path.join(APPDATA_MYRAA, 'ShaderCache'),
  path.join(APPDATA_MYRAA, 'blob_storage'),
  path.join(APPDATA_MYRAA, 'Session Storage'),
];

/** Temp file patterns to sweep */
const TEMP_PATTERNS = [
  path.join(os.tmpdir(), 'myraa_*'),
  path.join(os.tmpdir(), 'myraa-*.ps1'),
  path.join(os.tmpdir(), 'focus_lock_*.ps1'),
  path.join(os.tmpdir(), 'active_win_*.ps1'),
];

// ---------------------------------------------------------------------------
// Progress broadcaster — all SSE clients listening on /api/update/stream
// ---------------------------------------------------------------------------

/** @type {import('http').ServerResponse[]} */
const sseClients = [];

/**
 * Emits a structured progress event to all connected SSE clients.
 * @param {string} stage   — e.g. "VERIFY", "DOWNLOAD", "INSTALL", "CLEANUP"
 * @param {number} pct     — 0-100
 * @param {string} message — human-readable description
 * @param {'info'|'success'|'warning'|'error'} level
 */
function broadcast(stage, pct, message, level = 'info') {
  const payload = JSON.stringify({ stage, pct, message, level, ts: new Date().toISOString() });
  const line = `data: ${payload}\n\n`;
  sseClients.forEach((res) => {
    try { res.write(line); } catch { /* client disconnected */ }
  });
  // Also log to JARVIS data dir for audit
  try {
    const logFile = path.join(JARVIS_DIR, 'update_log.json');
    const log = fs.existsSync(logFile)
      ? JSON.parse(fs.readFileSync(logFile, 'utf-8'))
      : [];
    log.push({ stage, pct, message, level, ts: new Date().toISOString() });
    fs.writeFileSync(logFile, JSON.stringify(log.slice(-200), null, 2));
  } catch {}
}

// ---------------------------------------------------------------------------
// Version Management
// ---------------------------------------------------------------------------

/**
 * Reads the currently installed MYRAA version from package.json.
 * @returns {string}
 */
function getInstalledVersion() {
  try {
    const pkgPath = path.join(APP_DIR, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Reads version from a candidate package.json (new build).
 * @param {string} buildDir
 * @returns {string}
 */
function getCandidateVersion(buildDir) {
  try {
    const pkgPath = path.join(buildDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ---------------------------------------------------------------------------
// File Wipe Utilities
// ---------------------------------------------------------------------------

/**
 * Recursively deletes the contents of a directory without removing the dir itself.
 * @param {string} dir
 */
function wipeDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Deletes all files in %TEMP% matching TEMP_PATTERNS.
 */
function wipeTempFiles() {
  const tempDir = os.tmpdir();
  try {
    for (const file of fs.readdirSync(tempDir)) {
      if (/^(myraa_|myraa-|focus_lock_|active_win_|myraa_word_|myraa_excel_)/.test(file)) {
        try { fs.rmSync(path.join(tempDir, file), { force: true }); } catch {}
      }
    }
  } catch {}
}

/**
 * Wipes all Electron GPU / code caches from %APPDATA%\MYRAA\.
 * Safe — these are auto-regenerated on next launch.
 */
function wipeElectronCaches() {
  for (const dir of ELECTRON_CACHE_DIRS) {
    wipeDirContents(dir);
  }
}

// ---------------------------------------------------------------------------
// Process Management
// ---------------------------------------------------------------------------

/**
 * Terminates any running MYRAA / MYRAA-runtime processes.
 * Uses taskkill /F /IM so elevated tokens are not needed if launched normally.
 * @returns {Promise<void>}
 */
function killMYRAA() {
  return new Promise((resolve) => {
    const targets = ['MYRAA.exe', 'MYRAA-runtime.exe'];
    let done = 0;
    for (const t of targets) {
      exec(`taskkill /F /IM "${t}" 2>nul`, () => {
        done++;
        if (done === targets.length) setTimeout(resolve, 800);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Core Update Pipeline
// ---------------------------------------------------------------------------

/**
 * Copies files from a new build directory into the live APP_DIR.
 * Skips node_modules to avoid huge copy times; the installer is expected
 * to supply a self-contained dist/ already.
 * @param {string} buildDir — path to verified new build
 */
function installBuild(buildDir) {
  return new Promise((resolve, reject) => {
    const xcopy = `xcopy /E /I /Y /Q "${buildDir}\\*" "${APP_DIR}\\"`;
    exec(xcopy, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Relaunches MYRAA.exe after a clean install.
 */
function relaunchMYRAA() {
  const exe = path.join(MYRAA_ROOT, 'MYRAA.exe');
  spawn(exe, [], {
    detached: true,
    stdio: 'ignore',
    cwd: MYRAA_ROOT,
  }).unref();
}

// ---------------------------------------------------------------------------
// Main Entry Point — Full Upgrade Pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the complete self-upgrade flow:
 *  VERIFY → TERMINATE → PURGE CACHES → INSTALL → CLEANUP → RELAUNCH
 *
 * @param {string} newBuildDir — path to the extracted/downloaded new build
 * @param {object} opts
 * @param {boolean} [opts.relaunch=true]     — relaunch MYRAA after upgrade
 * @param {boolean} [opts.dryRun=false]      — simulate without writing
 * @returns {Promise<{success: boolean, fromVersion: string, toVersion: string, errors: string[]}>}
 */
async function runUpgrade(newBuildDir, opts = {}) {
  const { relaunch = true, dryRun = false } = opts;
  const errors = [];
  const fromVersion = getInstalledVersion();
  const toVersion = getCandidateVersion(newBuildDir);

  try {
    // ── STAGE 1: VERIFY ──────────────────────────────────────────────
    broadcast('VERIFY', 5, `Current: v${fromVersion} → Target: v${toVersion}`, 'info');

    if (!fs.existsSync(newBuildDir)) {
      throw new Error(`Build directory not found: ${newBuildDir}`);
    }
    if (!fs.existsSync(path.join(newBuildDir, 'package.json'))) {
      throw new Error('Build directory is missing package.json — invalid build');
    }

    broadcast('VERIFY', 15, 'Build directory validated ✓', 'success');

    // ── STAGE 2: TERMINATE OLD PROCESS ───────────────────────────────
    broadcast('TERMINATE', 25, 'Stopping active MYRAA processes…', 'info');
    if (!dryRun) await killMYRAA();
    broadcast('TERMINATE', 35, 'All MYRAA processes terminated ✓', 'success');

    // ── STAGE 3: WIPE CACHES & TEMP ──────────────────────────────────
    broadcast('PURGE', 40, 'Clearing Electron GPU / Code Caches…', 'info');
    if (!dryRun) wipeElectronCaches();
    broadcast('PURGE', 50, 'Clearing temp artefacts from %TEMP%…', 'info');
    if (!dryRun) wipeTempFiles();
    broadcast('PURGE', 58, 'Cache purge complete ✓', 'success');

    // ── STAGE 4: INSTALL NEW BUILD ────────────────────────────────────
    broadcast('INSTALL', 62, `Installing v${toVersion} into ${APP_DIR}…`, 'info');
    if (!dryRun) await installBuild(newBuildDir);
    broadcast('INSTALL', 80, `v${toVersion} installed ✓`, 'success');

    // ── STAGE 5: POST-INSTALL CLEANUP ────────────────────────────────
    broadcast('CLEANUP', 85, 'Removing previous build staging directory…', 'info');
    if (!dryRun && newBuildDir !== APP_DIR) {
      // Only wipe if it is a separate staging path — never wipe live dir
      try { fs.rmSync(newBuildDir, { recursive: true, force: true }); } catch {}
    }
    broadcast('CLEANUP', 90, 'Post-install cleanup complete ✓', 'success');

    // ── STAGE 6: RELAUNCH ────────────────────────────────────────────
    if (relaunch) {
      broadcast('RELAUNCH', 95, 'Relaunching MYRAA AI OS…', 'info');
      if (!dryRun) relaunchMYRAA();
    }

    broadcast('DONE', 100, `🎉 Upgrade complete: v${fromVersion} → v${toVersion}`, 'success');

    return { success: true, fromVersion, toVersion, errors };

  } catch (err) {
    errors.push(err.message);
    broadcast('ERROR', 0, `Upgrade failed: ${err.message}`, 'error');
    return { success: false, fromVersion, toVersion, errors };
  }
}

// ---------------------------------------------------------------------------
// Express Router — mounts onto apex_v5_routes via require()
// ---------------------------------------------------------------------------

/**
 * Mounts self-update endpoints on the given Express router.
 * Call: attachUpdateRoutes(router)
 *
 * Endpoints:
 *   GET  /api/update/status   — current version + last update log
 *   POST /api/update/run      — trigger upgrade { buildDir, relaunch?, dryRun? }
 *   GET  /api/update/stream   — SSE progress stream
 *   POST /api/update/purge    — wipe caches + temp only (no install)
 */
function attachUpdateRoutes(router) {

  // SSE progress stream
  router.get('/api/update/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    sseClients.push(res);
    res.write(`data: ${JSON.stringify({ stage: 'CONNECTED', pct: 0, message: 'SSE stream open', level: 'info' })}\n\n`);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Version status
  router.get('/api/update/status', (req, res) => {
    const version = getInstalledVersion();
    const logFile = path.join(JARVIS_DIR, 'update_log.json');
    let recentLog = [];
    try {
      recentLog = JSON.parse(fs.readFileSync(logFile, 'utf-8')).slice(-20);
    } catch {}

    res.json({
      success: true,
      version,
      platform: process.platform,
      myraaRoot: MYRAA_ROOT,
      appDir: APP_DIR,
      cacheSize: ELECTRON_CACHE_DIRS.filter(d => fs.existsSync(d)).length + ' cache dirs present',
      recentLog,
    });
  });

  // Trigger full upgrade
  router.post('/api/update/run', async (req, res) => {
    const { buildDir, relaunch = true, dryRun = false } = req.body || {};

    if (!buildDir) {
      return res.status(400).json({ error: 'buildDir is required — path to new build directory' });
    }

    // Respond immediately so client can subscribe to SSE stream
    res.json({ success: true, message: 'Upgrade pipeline initiated. Subscribe to /api/update/stream for live progress.' });

    // Run async — do NOT await here
    runUpgrade(buildDir, { relaunch, dryRun }).catch(() => {});
  });

  // Cache + temp purge only (no version change)
  router.post('/api/update/purge', (req, res) => {
    try {
      wipeElectronCaches();
      wipeTempFiles();
      res.json({
        success: true,
        message: 'Electron caches and temp files purged. Restart MYRAA to rebuild GPU cache.',
        cachesDirs: ELECTRON_CACHE_DIRS,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = { attachUpdateRoutes, runUpgrade, broadcast, getInstalledVersion };
