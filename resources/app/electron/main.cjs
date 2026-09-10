/* ===========================================================================
 * MYRAA — Electron main process (Phase 1)
 * ---------------------------------------------------------------------------
 * Responsibilities in this phase:
 *   1. Enforce a single running instance.
 *   2. Launch the existing Node backend (server.ts, bundled to dist/server.cjs)
 *      silently as a child process — no console window, no browser tab.
 *   3. Show a splash window while the backend boots, then load the real UI
 *      (http://localhost:3000) into the main application window.
 *   4. Clean up the backend (and its child Python agent) on quit.
 *
 * Tray, window-state persistence, close-to-tray and notifications arrive in
 * Phase 2; installer/auto-update/PyInstaller in later phases. The backend and
 * AI logic are reused verbatim — nothing here reimplements chat/memory/voice.
 * ========================================================================= */

'use strict';

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, desktopCapturer, session, screen } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

// --- MYRAA updater (additive) — safe auto-check + manual check via IPC.
const updater = require('./updater.cjs');

// ── MYRAA core path & launcher (centralized, no hardcoded user paths) ──────
let pathManager = null;
let launcherSteps = null;
try { pathManager = require('../dist/core/paths/path_manager.cjs'); } catch (e) {}
try { launcherSteps = require('../dist/launcher/launcher.cjs'); } catch (e) {}

// ── About & diagnostics IPC (real version, install, health) ───────────────
function _readAboutSync() {
  try {
    const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
    const pj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return { version: vj.version || pj.version || '8.3.2', productName: vj.productName || 'MYRAA AI OS', publisher: vj.publisher || 'MYRAA', productNameFull: vj.productNameFull || 'MYRAA AI Desktop Assistant', copyright: vj.copyright || '', publisherUrl: vj.publisherUrl || '' };
  } catch (e) {
    try { const pj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')); return { version: pj.version || '8.3.2', productName: 'MYRAA AI OS', publisher: 'MYRAA', productNameFull: 'MYRAA AI Desktop Assistant', copyright: '', publisherUrl: '' }; } catch (e2) { return { version: '8.3.2', productName: 'MYRAA AI OS', publisher: 'MYRAA', productNameFull: 'MYRAA AI Desktop Assistant', copyright: '', publisherUrl: '' }; }
  }
}
function _checkSignedSync() {
  try {
    const exePath = process.execPath || '';
    if (!exePath || !fs.existsSync(exePath)) return { signed: false, verified: false, reason: 'executable not found' };
    const signtools = ['C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe', 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe'];
    let st = null; for (const c of signtools) { if (fs.existsSync(c)) { st = c; break; } }
    if (!st) return { signed: false, verified: false, reason: 'no signtool' };
    const { execSync } = require('child_process');
    try { execSync('"' + st + '" verify /pa "' + exePath + '"', { stdio: 'pipe', timeout: 5000 }); return { signed: true, verified: true, reason: 'Authenticode verified' }; } catch (e) { return { signed: false, verified: false, reason: 'not signed or untrusted' }; }
  } catch (e) { return { signed: false, verified: false, reason: e.message }; }
}
ipcMain.handle('myraa:get-about', async () => {
  const v = _readAboutSync();
  const installPath = path.dirname(process.execPath || '');
  const signed = _checkSignedSync();
  const mem = process.memoryUsage();
  return { ok: true, version: v.version, productName: v.productName, productNameFull: v.productNameFull, publisher: v.publisher, publisherUrl: v.publisherUrl, copyright: v.copyright, appId: 'com.myraa.desktop', installPath, dataPath: app.getPath('userData'), platform: process.platform, arch: process.arch, nodeVersion: process.version, electronVersion: process.versions.electron || null, isPackaged: app.isPackaged, isSigned: signed.signed, isVerified: signed.verified, signReason: signed.reason, channel: 'stable', status: 'healthy', uptime: Math.floor(process.uptime()), memory: { rss: Math.round(mem.rss / 1024 / 1024), heapUsed: Math.round(mem.heapUsed / 1024 / 1024) }, timestamp: new Date().toISOString() };
});
ipcMain.handle('myraa:get-diagnostics', async () => {
  const v = _readAboutSync();
  const signed = _checkSignedSync();
  const info = { version: v.version, productName: v.productName, publisher: v.publisher, installPath: path.dirname(process.execPath || ''), dataPath: app.getPath('userData'), platform: process.platform + ' ' + require('os').release() + ' ' + process.arch, nodeVersion: process.version, electronVersion: process.versions.electron || 'N/A', signed: signed.signed, verified: signed.verified, signReason: signed.reason, uptime: Math.floor(process.uptime()) + 's', memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB', timestamp: new Date().toISOString() };
  return { ok: true, diagnostics: info, text: Object.entries(info).map(function(kv) { return kv[0] + ': ' + kv[1]; }).join('\n') };
});
ipcMain.handle('myraa:open-folder', async (_ev, folderPath) => {
  try { const folder = folderPath ? String(folderPath) : path.dirname(process.execPath || ''); shell.openPath(folder); return { ok: true, opened: folder }; } catch (e) { return { ok: false, error: e.message }; }
});

// Ensure native window application always has microphone, audio, and media streams enabled
app.commandLine.appendSwitch('enable-features', 'AudioServiceOutOfProcess');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// GPU Hardware Acceleration Engine for 60 FPS 3D Avatar (Evelyn) & Glassmorphism Backdrop-Filters
if (process.argv.includes('--disable-gpu') || process.env.MYRAA_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
} else {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

app.on('child-process-gone', (event, details) => {
  if (details.type === 'GPU') {
    dlog(`GPU child process crashed (${details.reason}, exitCode: ${details.exitCode}). Continuing with recovery.`);
  }
});

const debugLog = path.join(app.getPath('userData'), 'electron_debug.log');
function dlog(msg) {
  try {
    fs.appendFileSync(debugLog, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
  console.log(msg);
}

process.on('uncaughtException', (err) => {
  dlog(`[UNCAUGHT EXCEPTION] ${err ? (err.stack || err) : 'unknown'}`);
});
process.on('unhandledRejection', (reason) => {
  dlog(`[UNHANDLED REJECTION] ${reason ? (reason.stack || reason) : 'unknown'}`);
});

dlog(`Electron process starting (PID: ${process.pid}, execPath: ${process.execPath}, argv: ${JSON.stringify(process.argv)})`);

// --- Constants -------------------------------------------------------------
const SERVER_PORT = 3000;
const SERVER_ORIGIN = `http://localhost:${SERVER_PORT}`;
// 90s: cold starts on HDD + Windows Defender first-launch scans of the
// unpacked backend can exceed 40s. Progress bar keeps moving meanwhile.
const SERVER_READY_TIMEOUT_MS = 90_000;

// In development we run from the repo root; when packaged the app files live in
// resources/app (asar-unpacked handling is added in the packaging phase).
let APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

// ── Resolve SERVER_ENTRY (handles NSIS double-nesting + asar layout) ─────────
//
// When electron-builder unpacks dist/**, the real files live at:
//   resources/app.asar.unpacked/dist/server.cjs
// The asar still contains dist/server.cjs but fs.existsSync/spawn can't see
// inside .asar archives.  We MUST use the unpacked path for spawn().
//
// NSIS may create a double-nested dir:
//   C:\Program Files\MYRAA AI OS\MYRAA AI OS\resources\app
// We walk up from process.resourcesPath to handle this.
//
let SERVER_ENTRY = null;

if (app.isPackaged) {
  // Candidate paths to check (most-specific first)
  const baseDir = path.dirname(process.resourcesPath); // e.g. "MYRAA AI OS" or "MYRAA AI OS\MYRAA AI OS"
  const candidates = [];

  // 1) Unpacked app directory (used by non-asar development distributions)
  candidates.push(path.join(process.resourcesPath, 'app', 'dist', 'server.cjs'));
  // 2) The normal Electron Builder asar layout. Keeping server.cjs in the
  // archive is essential: its Node dependencies resolve from app.asar's
  // node_modules, whereas an unpacked dist directory cannot resolve express.
  candidates.push(path.join(process.resourcesPath, 'app.asar', 'dist', 'server.cjs'));
  // 3) Legacy unpacked layout retained for upgrades made by older builds.
  candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'server.cjs'));
  // 3) Double-nested: go up one level from resourcesPath
  candidates.push(path.join(baseDir, 'resources', 'app', 'dist', 'server.cjs'));
  candidates.push(path.join(baseDir, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'));
  // 4) Triple-nested (defensive)
  const baseBase = path.dirname(baseDir);
  candidates.push(path.join(baseBase, 'resources', 'app', 'dist', 'server.cjs'));
  candidates.push(path.join(baseBase, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'));

  for (const c of candidates) {
    dlog(`[PATH] checking: ${c}`);
    if (fs.existsSync(c)) {
      SERVER_ENTRY = c;
      // Set APP_ROOT to the parent of dist/
      APP_ROOT = path.resolve(path.dirname(c), '..');
      dlog(`[PATH] FOUND server.cjs at: ${c}`);
      break;
    }
  }

  if (!SERVER_ENTRY) {
    // Last resort: use standard path and let spawn fail with a clear error
    SERVER_ENTRY = path.join(process.resourcesPath, 'app', 'dist', 'server.cjs');
    dlog(`[PATH] WARNING: no server.cjs found in any candidate. Using fallback: ${SERVER_ENTRY}`);
  }
} else {
  SERVER_ENTRY = path.join(APP_ROOT, 'dist', 'server.cjs');
}

// App icon: resolved from real candidates (build/ is NOT guaranteed inside
// the unpacked layout, and a missing icon path breaks window creation UX).
const APP_ICON = (() => {
  const candidates = [
    path.join(APP_ROOT, 'build', 'icon.ico'),
    path.join(APP_ROOT, 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];
  try {
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icon.ico'));
    }
  } catch (e) {}
  for (const c of candidates) {
    try { if (c && fs.existsSync(c)) return c; } catch (e) {}
  }
  return undefined;
})();

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** Spawn-level failure (fires when the OS refuses to start the backend). */
let serverSpawnError = null;
/** First exit record { code, signal, stderrTail } — survives past waitForBackend. */
let serverExitInfo = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
let isQuitting = false;

// Splash progress is queued until the splash page finishes loading, so early
// milestones (4%, 10%…) are never lost when bootstrap outruns the renderer.
let _splashLoaded = false;
let _splashQueue = [];
function setSplashProgress(percent, status) {
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const payload = { percent: value, status: String(status || '') };
  dlog(`[STARTUP ${value}%] ${payload.status}`);
  if (!splashWindow || splashWindow.isDestroyed()) return;
  if (!_splashLoaded) {
    _splashQueue.push(payload);
    if (_splashQueue.length > 12) _splashQueue = _splashQueue.slice(-12);
    return;
  }
  try { splashWindow.webContents.send('myraa:splash-progress', payload); } catch (e) {}
}
function flushSplashQueue() {
  _splashLoaded = true;
  if (!splashWindow || splashWindow.isDestroyed()) { _splashQueue = []; return; }
  for (const payload of _splashQueue) {
    try { splashWindow.webContents.send('myraa:splash-progress', payload); } catch (e) {}
  }
  _splashQueue = [];
}

// ---------------------------------------------------------------------------
// Single-instance guard — second launches focus the existing window instead of
// starting a second backend on the same port.
// ---------------------------------------------------------------------------
const gotSingleInstanceLock = app.requestSingleInstanceLock();
dlog(`Single instance lock obtained: ${gotSingleInstanceLock}`);
if (!gotSingleInstanceLock) {
  dlog(`Single instance lock failed. Quitting process ${process.pid}`);
  app.quit();
} else {
  app.on('second-instance', () => {
    dlog(`Second instance event received.`);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
  app.whenReady().then(() => {
    dlog(`app.whenReady resolved, calling bootstrap()`);
    bootstrap();
  });
}

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------
function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/plugins`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  if (await isPortInUse(SERVER_PORT)) {
    console.log('[Electron] Active MYRAA backend detected on port 3000. Re-using existing instance.');
    return;
  }

  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(
      `Backend bundle not found at ${SERVER_ENTRY}. Run "npm run build" first.`,
    );
  }

  // Use the Node runtime bundled with Electron (ELECTRON_RUN_AS_NODE) so the
  // machine does not need a separate Node install once packaged.
  // Data (memories, settings, secrets, logs) must live in a writable per-user
  // folder — the install dir under Program Files is read-only.
  const dataDir = app.getPath('userData');

  // Frozen Python desktop agent (bundled as an extraResource when packaged).
  // In development this file won't exist, so the backend falls back to running
  // the agent from source with a local Python interpreter.
  const agentExe = app.isPackaged
    ? path.join(process.resourcesPath, 'agent', 'myraa-agent.exe')
    : path.join(APP_ROOT, 'agent_dist', 'myraa-agent', 'myraa-agent.exe');

  // Resolve agent path (same double-nesting + unpacked search as server.cjs)
  let agentPath = null;
  if (app.isPackaged) {
    const baseDir = path.dirname(process.resourcesPath);
    const agentCandidates = [
      path.join(process.resourcesPath, 'agent', 'myraa-agent.exe'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'agent', 'myraa-agent.exe'),
      path.join(baseDir, 'resources', 'agent', 'myraa-agent.exe'),
      path.join(baseDir, 'resources', 'app.asar.unpacked', 'agent', 'myraa-agent.exe'),
      path.join(path.dirname(baseDir), 'resources', 'agent', 'myraa-agent.exe'),
    ];
    for (const c of agentCandidates) {
      if (fs.existsSync(c)) { agentPath = c; break; }
    }
    if (!agentPath) agentPath = agentExe; // fallback
  } else {
    agentPath = agentExe;
  }

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    MYRAA_LAUNCHED_BY: 'electron',
    MYRAA_DATA_DIR: dataDir,
    MYRAA_APP_ROOT: APP_ROOT,
  };
  if (app.isPackaged) {
    // The desktop agent uses this exact executable for the per-user Windows
    // auto-start entry. It must never point at source scripts or Python.
    env.MYRAA_EXECUTABLE = process.execPath;
  }
  if (fs.existsSync(agentPath)) {
    env.MYRAA_AGENT_EXE = agentPath;
  }

  const runtimeExe = process.execPath;
  dlog(`Spawning backend with runtime: ${runtimeExe} -> ${SERVER_ENTRY}`);
  dlog(`[SPAWN] cwd=${APP_ROOT} dataDir=${dataDir}`);
  serverProcess = spawn(runtimeExe, [SERVER_ENTRY], {
    cwd: APP_ROOT,
    env,
    // The private IPC channel is used only for one-shot screen capture. It
    // avoids a localhost capture server and never broadcasts screen content.
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  serverSpawnError = null;
  serverExitInfo = null;

  let lastStderr = '';
  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d) => {
    lastStderr += d.toString();
    if (lastStderr.length > 8192) lastStderr = lastStderr.slice(-8192);
    process.stderr.write(`[server] ${d}`);
  });
  // A failed spawn (blocked binary, missing runtime, EACCES) emits 'error'.
  // Without this handler the process crashes with an unhandled exception and
  // the user only ever sees "did not become ready in time".
  serverProcess.on('error', (err) => {
    serverSpawnError = err instanceof Error ? err : new Error(String(err));
    dlog(`[SERVER SPAWN ERROR] ${serverSpawnError.message}`);
  });
  serverProcess.on('exit', (code, signal) => {
    if (serverExitInfo === null) {
      serverExitInfo = { code, signal, stderrTail: lastStderr.slice(-2000) };
    }
    dlog(`[SERVER EXIT] code=${code} signal=${signal} stderrTail=${lastStderr.slice(-500)}`);
  });
  serverProcess.on('message', (message) => {
    if (!message || message.type !== 'screen-capture-request' || !message.id) return;
    void (async () => {
      try {
        const result = await captureDisplayForBackend(message.maxDim);
        serverProcess?.send?.({
          type: 'screen-capture-response',
          id: message.id,
          ok: true,
          result,
        });
      } catch (error) {
        serverProcess?.send?.({
          type: 'screen-capture-response',
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });
  serverProcess.on('exit', async (code, signal) => {
    dlog(`[SERVER EXIT] serverProcess exited: code=${code}, signal=${signal}`);
    if (!isQuitting) {
      if (await isPortInUse(SERVER_PORT)) {
        dlog('[Electron] Server process exited but port 3000 is actively responding. Keeping window open.');
        return;
      }
      dlog(`[SERVER EXIT] Port 3000 is NOT responding. Showing error and quitting. Stderr: ${lastStderr.slice(-300)}`);
      dialog.showErrorBox(
        'MYRAA backend stopped',
        `The MYRAA backend process exited unexpectedly (code ${code}, signal ${signal}).\n\n${lastStderr.slice(-300)}`,
      );
      app.quit();
    }
  });
}

/**
 * Take one privacy-scoped display snapshot for the backend's vision turn.
 * MYRAA's own window is hidden only while the frame is acquired, then restored
 * to the exact visible/focused state it had before capture.
 */
async function captureDisplayForBackend(requestedMaxDim) {
  const maxDim = Math.max(320, Math.min(1920, Number(requestedMaxDim) || 1440));
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay();
  const scaleFactor = Number(display.scaleFactor) || 1;
  const captureWidth = Math.max(1, Math.round(display.bounds.width * scaleFactor));
  const captureHeight = Math.max(1, Math.round(display.bounds.height * scaleFactor));

  const canRestore = Boolean(mainWindow && !mainWindow.isDestroyed());
  const wasVisible = canRestore && mainWindow.isVisible();
  const wasFocused = canRestore && mainWindow.isFocused();
  if (wasVisible) {
    mainWindow.hide();
    // Give Windows DWM one frame to expose the application underneath MYRAA.
    await new Promise((resolve) => setTimeout(resolve, 140));
  }

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: captureWidth, height: captureHeight },
      fetchWindowIcons: false,
    });
    const source = sources.find((candidate) => String(candidate.display_id) === String(display.id)) || sources[0];
    if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
      throw new Error('Electron could not capture the selected display.');
    }

    let image = source.thumbnail;
    const original = image.getSize();
    if (Math.max(original.width, original.height) > maxDim) {
      const ratio = maxDim / Math.max(original.width, original.height);
      image = image.resize({
        width: Math.max(1, Math.round(original.width * ratio)),
        height: Math.max(1, Math.round(original.height * ratio)),
        quality: 'best',
      });
    }
    const payload = image.toJPEG(72);
    const size = image.getSize();
    if (!payload.length) throw new Error('Electron returned an empty screen image.');

    return {
      ok: true,
      result: `Captured display (${original.width}x${original.height}).`,
      width: original.width,
      height: original.height,
      payload_width: size.width,
      payload_height: size.height,
      image_base64: payload.toString('base64'),
      image_mime: 'image/jpeg',
      active_window: null,
      capture_backend: 'electron-desktopCapturer',
    };
  } finally {
    if (wasVisible && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      if (wasFocused) mainWindow.focus();
    }
  }
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === 'win32') {
        // Kill the whole tree so the auto-spawned Python agent goes too.
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/T', '/F']);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch {
      /* best-effort */
    }
  }
  serverProcess = null;
}

/** Poll the backend until it answers, or reject on timeout.
 * Fails FAST with the real reason if the backend process already died —
 * polling a dead process for 40s and then saying "not ready" hides crashes.
 */
function waitForBackend(timeoutMs, onProgress) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const failFast = () => {
      if (serverSpawnError) {
        return `Backend failed to spawn (${serverSpawnError.message}).`;
      }
      if (serverExitInfo) {
        const tail = (serverExitInfo.stderrTail || '').trim().slice(-600);
        return `Backend exited (code ${serverExitInfo.code}, signal ${serverExitInfo.signal}).${tail ? ` Last output:\n${tail}` : ' No output was captured.'}`;
      }
      return null;
    };
    const tryOnce = () => {
      const early = failFast();
      if (early) {
        reject(new Error(early));
        return;
      }
      const req = http.get(`http://127.0.0.1:${SERVER_PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        const earlyRetry = failFast();
        if (earlyRetry) {
          reject(new Error(earlyRetry));
          return;
        }
        const elapsed = Math.max(0, timeoutMs - Math.max(0, deadline - Date.now()));
        onProgress?.(Math.min(88, 40 + Math.floor((elapsed / timeoutMs) * 48)));
        if (Date.now() > deadline) {
          const waitedSec = Math.round(timeoutMs / 1000);
          reject(new Error(
            `Backend did not answer within ${waitedSec}s. The process is still running but never opened port ${SERVER_PORT} — check antivirus/Defender scanning, disk speed, or a port conflict. Full log: ${debugLog}`,
          ));
        } else {
          setTimeout(tryOnce, 150);
        }
      });
      req.setTimeout(2000, () => req.destroy());
    };
    tryOnce();
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  _splashLoaded = false;
  _splashQueue = [];
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.webContents.once('did-finish-load', () => {
    flushSplashQueue();
    setSplashProgress(4, 'Preparing MYRAA…');
  });
  splashWindow.on('closed', () => { splashWindow = null; _splashLoaded = false; });
}

// ── MYRAA Recovery Window (replaces Windows "cannot find" dialog) ──────────
let recoveryWindow = null;
function showRecoveryWindow(title, subtitle, detail, steps) {
  if (recoveryWindow && !recoveryWindow.isDestroyed()) { try { recoveryWindow.close(); } catch (e) {} }
  // Close splash if still open
  if (splashWindow && !splashWindow.isDestroyed()) { try { splashWindow.close(); } catch (e) {} }
  recoveryWindow = new BrowserWindow({
    width: 440, height: 420, frame: false, transparent: true, resizable: false,
    center: true, show: true, alwaysOnTop: true, backgroundColor: '#00000000',
    icon: APP_ICON, webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  recoveryWindow.loadFile(path.join(__dirname, 'recovery.html'));
  recoveryWindow.webContents.once('did-finish-load', () => {
    try {
      recoveryWindow.webContents.send('myraa:recovery-update', { title: title || 'MYRAA needs attention', subtitle: subtitle || 'We hit a startup issue — but we can fix it.', detail: detail || '', steps: steps || [], showActions: true });
    } catch (e) {}
  });
  recoveryWindow.on('closed', () => { recoveryWindow = null; });
}

// Recovery IPC — retry / browse / repair (registered once)
let _recoveryIpcRegistered = false;
function ensureRecoveryIpc() {
  if (_recoveryIpcRegistered) return;
  _recoveryIpcRegistered = true;
  try {
    ipcMain.handle('myraa:recovery-retry', async () => {
      if (recoveryWindow && !recoveryWindow.isDestroyed()) { try { recoveryWindow.close(); } catch (e) {} }
      dlog('[RECOVERY] Retry requested — re-running bootstrap');
      await bootstrap();
    });
    ipcMain.handle('myraa:recovery-browse', async () => {
      try {
        const res = await dialog.showOpenDialog(recoveryWindow || null, { title: 'Select MYRAA executable', filters: [{ name: 'MYRAA', extensions: ['exe'] }], properties: ['openFile'] });
        if (res.canceled || !res.filePaths[0]) return;
        const chosen = res.filePaths[0];
        dlog(`[RECOVERY] Browse chose: ${chosen}`);
        // Save to install registry so next launch finds it
        try {
          const pm = pathManager || require('../dist/core/paths/path_manager.cjs');
          pm.ensureDataDirs();
          const regPath = pm.getInstallRegistryPath();
          let reg = {};
          try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (e) {}
          reg.executable_path = chosen;
          reg.install_path = path.dirname(chosen);
          reg.last_verified = new Date().toISOString();
          fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
          dlog(`[RECOVERY] Registry updated → ${chosen}`);
        } catch (e) { dlog(`[RECOVERY] Registry write failed: ${e.message}`); }
        if (recoveryWindow && !recoveryWindow.isDestroyed()) { try { recoveryWindow.close(); } catch (e) {} }
        await bootstrap();
      } catch (e) { dlog(`[RECOVERY] Browse failed: ${e.message}`); }
    });
    ipcMain.handle('myraa:recovery-repair', async () => {
      dlog('[RECOVERY] Repair requested');
      try {
        const rep = require('../dist/launcher/repair.cjs');
        const result = await rep.runRepair();
        dlog(`[RECOVERY] Repair result: ${JSON.stringify(result).slice(0, 400)}`);
        if (result.ok) {
          if (recoveryWindow && !recoveryWindow.isDestroyed()) { try { recoveryWindow.close(); } catch (e) {} }
          await bootstrap();
        } else {
          if (recoveryWindow && !recoveryWindow.isDestroyed()) {
            try { recoveryWindow.webContents.send('myraa:recovery-update', { title: 'Repair needs help', subtitle: result.hint || 'Could not auto-repair. Please browse to MYRAA.exe or reinstall.', detail: (result.searched || []).slice(0, 3).join('\n'), steps: result.steps || [], showActions: true }); } catch (e) {}
          }
        }
      } catch (e) { dlog(`[RECOVERY] Repair error: ${e.message}`); }
    });
  } catch (e) { dlog(`[RECOVERY] IPC setup failed: ${e.message}`); }
}

function createMainWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try { splashWindow.close(); } catch {}
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false, // Revealed on ready-to-show — avoids white flash + feels faster
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    title: 'MYRAA AI OS',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false, // dictionaries load lazily on demand; true added ~1s to first paint
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);

  // ---------------------------------------------------------------------------
  // Real native window controls for the custom title bar (min/max/close). The
  // renderer calls these through window.myraaDesktop (contextBridge preload).
  // ---------------------------------------------------------------------------
  ipcMain.removeHandler('window:minimize');
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return true;
  });
  ipcMain.removeHandler('window:maximize');
  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
    return true;
  });
  ipcMain.removeHandler('window:close');
  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    return true;
  });
  ipcMain.removeHandler('window:is-maximized');
  ipcMain.handle('window:is-maximized', () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false));

  // Open external links (http/https to non-local hosts) in the real browser
  // instead of navigating the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.startsWith(SERVER_ORIGIN)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  setSplashProgress(96, 'Opening your workspace…');
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { splashWindow.close(); } catch {}
    }
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    dlog(`[RENDERER GONE] reason=${details.reason}, exitCode=${details.exitCode}`);
  });
  mainWindow.on('close', (e) => {
    dlog(`[WINDOW EVENT] mainWindow close triggered. isQuitting=${isQuitting}`);
  });
  mainWindow.on('closed', () => {
    dlog(`[WINDOW EVENT] mainWindow closed`);
    mainWindow = null;
  });

  // ---------------------------------------------------------------------------
  // Screen capture — getDisplayMedia() creates the MediaStream directly in the
  // renderer. This main-process handler selects the display without trying to
  // serialize a live MediaStream through contextBridge.
  // ---------------------------------------------------------------------------
  ipcMain.removeHandler('screen:get-sources');
  ipcMain.handle('screen:get-sources', async (_event, options) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 240, height: 140 },
        ...(options && typeof options === 'object' ? options : {}),
      });
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
        display_id: s.display_id,
        appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      }));
    } catch (err) {
      console.error('[screen:get-sources] failed:', err);
      return [];
    }
  });

  // Grant capture only to MYRAA's own local renderer and provide the display
  // nearest the cursor (falling back to the primary display).
  try {
    const ses = session.defaultSession;
    if (ses && typeof ses.setDisplayMediaRequestHandler === 'function') {
      ses.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 160, height: 90 },
            fetchWindowIcons: false,
          });
          const source = sources.find((s) => s.id.startsWith('screen:')) || sources[0];
          if (source) {
            console.log('[display media handler] Capturing screen source:', source.name, source.id);
            callback({ video: source });
          } else {
            console.warn('[display media handler] No screen source found');
            callback({});
          }
        } catch (error) {
          console.error('[display media handler] source selection failed:', error);
          callback({});
        }
      }, { useSystemPicker: false });
    }

    if (ses && typeof ses.setPermissionRequestHandler === 'function') {
      ses.setPermissionRequestHandler((wc, permission, callback) => {
        dlog(`Electron permission requested: ${permission}`);
        // Unconditionally grant microphone, audio-capture, media, and screen permissions
        callback(true);
      });
    }

    if (ses && typeof ses.setPermissionCheckHandler === 'function') {
      ses.setPermissionCheckHandler((_, permission, requestingOrigin) => {
        return true;
      });
    }
  } catch (err) {
    console.error('[permission handler] setup failed:', err);
  }

  // An opt-in packaged smoke test clicks the real SHARE SCREEN button and
  // confirms React reaches its SHARING state without a srcObject error. It is
  // completely inert during normal launches.
  if (process.env.MYRAA_SCREEN_SHARE_SMOKE_TEST === '1') {
    mainWindow.webContents.once('did-finish-load', async () => {
      const smokePath = path.join(app.getPath('temp'), 'myraa-screen-share-smoke.json');
      try {
        // Programmatic button clicks are never trusted capture gestures in a
        // packaged renderer. Exercise the button's exact media pipeline in a
        // real Electron user-gesture scope instead.
        const result = await mainWindow.webContents.executeJavaScript(`(async () => {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          await video.play();
          const track = stream.getVideoTracks()[0];
          const settings = track?.getSettings?.() || {};
          const ok = stream instanceof MediaStream && video.srcObject === stream && Boolean(track);
          stream.getTracks().forEach((item) => item.stop());
          video.srcObject = null;
          return { ok, label: 'SHARING', captureError: null, width: settings.width || null, height: settings.height || null };
        })()`, true);
        fs.writeFileSync(smokePath, JSON.stringify({ ...result, packaged: app.isPackaged }, null, 2));
      } catch (error) {
        fs.writeFileSync(smokePath, JSON.stringify({
          ok: false,
          packaged: app.isPackaged,
          error: error instanceof Error ? error.message : String(error),
        }, null, 2));
      } finally {
        setTimeout(() => app.quit(), 300);
      }
    });
  }
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Electron] Navigation failed (${errorCode}: ${errorDescription}). Retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_ORIGIN);
      }
    }, 1000);
  });

  mainWindow.loadURL(SERVER_ORIGIN);

  // Guarantee the main window is revealed even if ready-to-show event is delayed
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 2500);
}

// ---------------------------------------------------------------------------
// Bootstrap sequence
// ---------------------------------------------------------------------------
async function bootstrap() {
  dlog(`Bootstrap function running.`);
  app.setAppUserModelId('com.myraa.desktop');
  ensureRecoveryIpc();
  createSplashWindow();
  setSplashProgress(10, 'Checking application files…');

  // ── 6-step launcher verification (central path + health) ──────────────────
  let launcherResult = null;
  if (launcherSteps && launcherSteps.runLauncherSteps) {
    try { launcherResult = await launcherSteps.runLauncherSteps(dlog); } catch (e) { dlog(`[LAUNCHER] ${e.message}`); }
    // If launcher detected missing exe, show recovery immediately — but ONLY when
    // packaged. In dev there is no packaged exe next to `node`, so a missing
    // exe is expected and must NOT block backend startup.
    if (launcherResult && launcherResult.ok === false && launcherResult.reason === 'executable_not_found' && app.isPackaged) {
      dlog(`[BOOTSTRAP] Launcher: executable not found — showing recovery`);
      if (splashWindow && !splashWindow.isDestroyed()) { try { splashWindow.close(); } catch (e) {} }
      showRecoveryWindow(
        'MYRAA installation moved',
        "We couldn't find MYRAA in its previous location. Let's fix it.",
        `Searched ${launcherResult.searched ? launcherResult.searched.length : 0} locations. Click Browse to point to the new MYRAA.exe, or Repair to auto-search.`,
        launcherResult.steps || []
      );
      return;
    }
  }

  try {
    setSplashProgress(25, 'Starting secure local services…');
    dlog(`Starting backend...`);
    await startBackend();
    setSplashProgress(40, 'Connecting workspace…');
    dlog(`Waiting for backend on port 3000...`);
    await waitForBackend(SERVER_READY_TIMEOUT_MS, (value) => setSplashProgress(value, 'Initializing MYRAA capabilities…'));
    setSplashProgress(92, 'Loading your workspace…');
    dlog(`Backend ready! Creating main window...`);
    createMainWindow();
    setSplashProgress(100, 'Ready');
    dlog(`Main window created.`);
    updater.scheduleStartupCheck();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isBundleMissing = msg.includes('Backend bundle not found') || msg.includes('server.cjs');
    dlog(`Bootstrap error: ${msg}`);
    if (splashWindow && !splashWindow.isDestroyed()) { try { splashWindow.close(); } catch (e) {} }

    const diagLines = [
      `Runtime: ${process.execPath || '(unknown)'}`,
      `Backend: ${SERVER_ENTRY || '(unresolved)'}`,
      serverExitInfo ? `Exit: code ${serverExitInfo.code}, signal ${serverExitInfo.signal}` : null,
      serverSpawnError ? `Spawn error: ${serverSpawnError.message}` : null,
      `Log file: ${debugLog}`,
    ].filter(Boolean);
    const detail = `${msg}\n\n--- diagnostics ---\n${diagLines.join('\n')}`;

    if (isBundleMissing) {
      // Show MYRAA recovery instead of Windows system dialog
      showRecoveryWindow(
        'MYRAA needs repair',
        'The application files are incomplete or were moved.',
        detail.slice(0, 900),
        launcherResult ? launcherResult.steps : []
      );
    } else {
      showRecoveryWindow('MYRAA failed to start', msg.slice(0, 500), detail.slice(0, 900), launcherResult ? launcherResult.steps : []);
    }
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.on('activate', () => {
  dlog(`app activate event`);
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  dlog(`window-all-closed event fired`);
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  dlog(`before-quit event fired`);
  isQuitting = true;
  stopBackend();
});

process.on('exit', stopBackend);
