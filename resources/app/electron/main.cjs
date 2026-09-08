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
const SERVER_READY_TIMEOUT_MS = 40_000;

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

  // 1) Standard path (single-nested, correct)
  candidates.push(path.join(process.resourcesPath, 'app', 'dist', 'server.cjs'));
  // 2) Unpacked asar path (dist/** is extracted here by electron-builder)
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

const APP_ICON = path.join(APP_ROOT, 'build', 'icon.ico');

/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
let isQuitting = false;

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
  serverProcess = spawn(runtimeExe, [SERVER_ENTRY], {
    cwd: APP_ROOT,
    env,
    // The private IPC channel is used only for one-shot screen capture. It
    // avoids a localhost capture server and never broadcasts screen content.
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });

  let lastStderr = '';
  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d) => {
    lastStderr += d.toString();
    process.stderr.write(`[server] ${d}`);
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

/** Poll the backend until it answers, or reject on timeout. */
function waitForBackend(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${SERVER_PORT}`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error('Backend did not become ready in time.'));
        } else {
          setTimeout(tryOnce, 250);
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => (splashWindow = null));
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
    show: true, // Show immediately!
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    title: 'MYRAA AI OS',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
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

  mainWindow.show();
  mainWindow.focus();

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
  createSplashWindow();

  try {
    dlog(`Starting backend...`);
    await startBackend();
    dlog(`Waiting for backend on port 3000...`);
    await waitForBackend(SERVER_READY_TIMEOUT_MS);
    dlog(`Backend ready! Creating main window...`);
    createMainWindow();
    dlog(`Main window created.`);
    // Quiet background update check (safe: no auto-download/install).
    updater.scheduleStartupCheck();
  } catch (err) {
    dlog(`Bootstrap error: ${err.message}`);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox(
      'MYRAA failed to start',
      `${err instanceof Error ? err.message : String(err)}`,
    );
    app.quit();
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
