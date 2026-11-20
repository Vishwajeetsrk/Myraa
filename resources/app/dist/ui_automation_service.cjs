/**
 * =============================================================================
 * MYRAA AI OS — UI Automation Service (v1.0 APEX)
 * =============================================================================
 * Semantic control of desktop applications using native Windows UI Automation
 * (IUIAutomation / System.Windows.Automation).
 *
 * Capabilities:
 *  - listVisibleWindows()           -> list all interactive desktop windows
 *  - getAppControlMap(target, max)  -> structured control map (buttons, menus, edits, tabs)
 *  - invokeControl(target, query)   -> click/invoke element semantically with fallback
 *  - setControlValue(target, query) -> set text in control (with password handling)
 *  - Fallback to OCR / Screen Vision if UI Automation tree is unavailable
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync, execFile } = require('child_process');
const memoryCore = require('./memory_core_service.cjs');
const visualComputer = require('./visual_computer_control.cjs');

const RUNNER_SCRIPT = path.join(__dirname, 'ui_automation_runner.ps1');

class UIAutomationService {

  _runPowerShell(command, ...params) {
    try {
      if (!fs.existsSync(RUNNER_SCRIPT)) {
        return { ok: false, error: `Runner script not found: ${RUNNER_SCRIPT}` };
      }

      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', RUNNER_SCRIPT,
        '-Command', command
      ];
      params.forEach((p, idx) => {
        args.push(`-Param${idx + 1}`, String(p !== undefined && p !== null ? p : ''));
      });

      const res = spawnSync('powershell.exe', args, {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      });

      if (res.error) {
        return { ok: false, error: res.error.message };
      }

      const stdout = (res.stdout || '').trim();
      if (!stdout) {
        return { ok: false, error: (res.stderr || '').trim() || 'No output from UI automation runner' };
      }

      try {
        const parsed = JSON.parse(stdout);
        return parsed;
      } catch (parseErr) {
        return { ok: false, raw: stdout, error: parseErr.message };
      }
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * Async runner for long UIA calls (element search, focus, monitors) so HTTP
   * handlers do not block the Node event loop with spawnSync.
   */
  _runPowerShellAsync(command, ...params) {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(RUNNER_SCRIPT)) {
          return resolve({ ok: false, error: `Runner script not found: ${RUNNER_SCRIPT}` });
        }
        const args = [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', RUNNER_SCRIPT,
          '-Command', command
        ];
        params.forEach((p, idx) => {
          args.push(`-Param${idx + 1}`, String(p !== undefined && p !== null ? p : ''));
        });
        execFile('powershell.exe', args, {
          encoding: 'utf8',
          timeout: 45000,
          windowsHide: true,
          maxBuffer: 16 * 1024 * 1024
        }, (err, stdout, stderr) => {
          if (err) return resolve({ ok: false, error: err.message, stderr: String(stderr || '').slice(0, 500) });
          const text = String(stdout || '').trim();
          if (!text) return resolve({ ok: false, error: String(stderr || '').trim() || 'No output from UI automation runner' });
          try { resolve(JSON.parse(text)); }
          catch (parseErr) { resolve({ ok: false, raw: text.slice(0, 2000), error: parseErr.message }); }
        });
      } catch (err) {
        resolve({ ok: false, error: err.message || String(err) });
      }
    });
  }

  /**
   * List all visible top-level windows on the interactive user desktop
   */
  listVisibleWindows() {
    const res = this._runPowerShell('list_windows');
    if (Array.isArray(res)) {
      return { ok: true, windows: res };
    }
    if (res && res.windows) return res;
    return { ok: true, windows: [] };
  }

  /**
   * True foreground window with process, class, bounds, state, monitor.
   */
  async getForegroundWindow() {
    const res = await this._runPowerShellAsync('foreground');
    return res && res.ok ? res : { ok: false, error: (res && res.error) || 'foreground window unavailable', window: null };
  }

  /**
   * All monitors with bounds and working area. Real WinForms screen data.
   */
  async getMonitors() {
    const res = await this._runPowerShellAsync('monitors');
    return res && res.ok ? res : { ok: false, error: (res && res.error) || 'monitor enumeration unavailable', monitors: [] };
  }

  /**
   * Focused UI Automation element plus selected text (passwords are redacted).
   */
  async getFocusedElement() {
    const res = await this._runPowerShellAsync('focused');
    return res && res.ok ? res : { ok: false, error: (res && res.error) || 'focused element unavailable', element: null };
  }

  /**
   * Semantic screen search across all top-level windows using UIA names,
   * automation ids and class names. Read-only.
   */
  async findElement(query, maxResults = 10) {
    const q = String(query || '').trim();
    if (!q) return { ok: false, code: 'VALIDATION', error: 'query is required' };
    const max = Math.min(25, Math.max(1, Number(maxResults) || 10));
    const res = await this._runPowerShellAsync('find_element', q, String(max));
    if (!res || res.ok === false) return { ok: false, error: (res && res.error) || 'element search failed', matches: [] };
    return { ok: true, query: q, matches: res.matches || [], count: (res.matches || []).length, source: 'ui_automation.find_element' };
  }

  /**
   * Resolve a window by handle, process name, class name, or title fragment.
   * Returns AMBIGUOUS with candidates instead of guessing when several match.
   */
  resolveWindow(query) {
    const q = String(query || '').trim();
    if (!q) return { ok: false, code: 'VALIDATION', error: 'window query is required' };
    const listed = this.listVisibleWindows();
    const windows = (listed && listed.windows) || [];
    if (!windows.length) return { ok: false, code: 'UNAVAILABLE', error: 'no visible windows returned by UI Automation' };

    if (/^\d+$/.test(q)) {
      const byHandle = windows.find((w) => String(w.handle) === q);
      if (byHandle) return { ok: true, window: byHandle, method: 'handle' };
    }

    const ql = q.toLowerCase();
    const exactProcess = windows.filter((w) => String(w.processName || '').toLowerCase() === ql);
    if (exactProcess.length === 1) return { ok: true, window: exactProcess[0], method: 'processName' };

    const exactClass = windows.filter((w) => String(w.className || '').toLowerCase() === ql);
    if (exactClass.length === 1) return { ok: true, window: exactClass[0], method: 'className' };

    const exactTitle = windows.filter((w) => String(w.title || '').toLowerCase() === ql);
    if (exactTitle.length === 1) return { ok: true, window: exactTitle[0], method: 'title-exact' };

    const partial = windows.filter((w) => {
      const hay = `${w.title || ''} ${w.processName || ''} ${w.className || ''}`.toLowerCase();
      return hay.includes(ql);
    });
    if (partial.length === 1) return { ok: true, window: partial[0], method: 'title-partial' };

    if (partial.length > 1) {
      const notMinimized = partial.filter((w) => w.state !== 'minimized');
      const pool = notMinimized.length ? notMinimized : partial;
      if (pool.length === 1) return { ok: true, window: pool[0], method: 'title-partial-unique-visible' };
      const foreground = pool.find((w) => w.isForeground);
      if (foreground && pool.filter((w) => String(w.processName) === String(foreground.processName)).length === 1) {
        return { ok: true, window: foreground, method: 'foreground-process' };
      }
      return {
        ok: false,
        code: 'AMBIGUOUS',
        error: `multiple windows match "${q}"`,
        candidates: pool.slice(0, 8).map((w) => ({ title: w.title, processName: w.processName, handle: w.handle, state: w.state }))
      };
    }

    return { ok: false, code: 'NOT_FOUND', error: `no visible window matches "${q}"` };
  }

  /**
   * Safe window actions. `close` requires explicit confirmation because it can
   * discard unsaved work.
   */
  async windowAction(handle, action, opts = {}) {
    const allowed = new Set(['activate', 'minimize', 'maximize', 'restore', 'move', 'move-resize', 'close']);
    const act = String(action || '').trim();
    if (!allowed.has(act)) return { ok: false, code: 'VALIDATION', error: `action must be one of: ${[...allowed].join(', ')}` };
    if (!handle) return { ok: false, code: 'VALIDATION', error: 'window handle is required' };
    if (act === 'close' && opts.confirm !== true) {
      return { ok: false, code: 'APPROVAL_REQUIRED', error: 'closing a window can discard unsaved work; pass confirm:true after the user approves' };
    }
    const x = Number.isFinite(Number(opts.x)) ? Number(opts.x) : 0;
    const y = Number.isFinite(Number(opts.y)) ? Number(opts.y) : 0;
    const w = Number.isFinite(Number(opts.width)) ? Number(opts.width) : 0;
    const h = Number.isFinite(Number(opts.height)) ? Number(opts.height) : 0;
    if ((act === 'move' || act === 'move-resize') && (!w || !h)) {
      return { ok: false, code: 'VALIDATION', error: 'width and height are required for move/move-resize' };
    }
    const res = await this._runPowerShellAsync('window_action', String(handle), act, String(x), String(y), String(w), String(h));
    return res || { ok: false, error: 'window action failed' };
  }

  /**
   * Resolve and activate a window by handle/process/title. Never guesses when
   * multiple windows match.
   */
  async activateWindow(query) {
    const r = this.resolveWindow(query);
    if (!r.ok) return r;
    const res = await this.windowAction(r.window.handle, 'activate');
    return { ...res, resolved: { title: r.window.title, processName: r.window.processName, handle: r.window.handle, method: r.method } };
  }

  /**
   * Move a resolved window onto a monitor. Defaults to a centered 80% window on
   * the target monitor's working area.
   */
  async moveWindowToMonitor(query, monitorIndex = 0, opts = {}) {
    const r = this.resolveWindow(query);
    if (!r.ok) return r;
    const m = await this.getMonitors();
    if (!m.ok) return m;
    const idx = Number(monitorIndex) || 0;
    const mon = (m.monitors || [])[idx];
    if (!mon) return { ok: false, code: 'NOT_FOUND', error: `monitor ${idx} not found`, monitors: (m.monitors || []).length };
    const wa = mon.workingArea || mon.bounds;
    const full = opts.fullscreen === true;
    const width = full ? wa.width : Math.max(320, Math.floor(wa.width * 0.8));
    const height = full ? wa.height : Math.max(240, Math.floor(wa.height * 0.8));
    const x = full ? wa.x : wa.x + Math.floor((wa.width - width) / 2);
    const y = full ? wa.y : wa.y + Math.floor((wa.height - height) / 2);
    const res = await this.windowAction(r.window.handle, 'move-resize', { x, y, width, height });
    return { ...res, resolved: { title: r.window.title, handle: r.window.handle }, monitor: { index: idx, device: mon.device } };
  }

  /**
   * Extract structured control map for a running application
   */
  async getAppControlMap(appNameOrTitle, maxElements = 150) {
    if (!appNameOrTitle) return { ok: false, error: 'App name or title is required' };

    const res = this._runPowerShell('get_controls', appNameOrTitle, String(maxElements));
    
    // Check if UI Automation returned controls
    if (res && res.ok && Array.isArray(res.controls) && res.controls.length >= 2) {
      // Filter named controls and interactive controls for clean summary
      const namedControls = res.controls.filter(c => c.name || c.automationId);
      
      // Persist to Memory Core app_knowledge table
      try {
        memoryCore.saveAppKnowledge(appNameOrTitle, namedControls.slice(0, 50), []);
      } catch (e) {}

      return {
        ok: true,
        source: 'ui_automation',
        target: appNameOrTitle,
        totalControls: res.controls.length,
        namedCount: namedControls.length,
        controls: res.controls
      };
    }

    // FALLBACK: Screen Vision / OCR if app exposes no accessibility tree
    try {
      const ocrRes = await visualComputer.captureAndAnalyze(
        `List visible buttons, menus, and text fields in the "${appNameOrTitle}" window.`
      );
      return {
        ok: true,
        source: 'screen_vision_fallback',
        target: appNameOrTitle,
        controls: [],
        visionAnalysis: ocrRes.analysis || ocrRes.message || 'Vision fallback active',
        note: 'UI Automation tree not available or sparse; analyzed via Vision engine.'
      };
    } catch (visionErr) {
      return {
        ok: res.ok || false,
        source: 'ui_automation_sparse',
        target: appNameOrTitle,
        controls: res.controls || [],
        error: res.error || visionErr.message
      };
    }
  }

  /**
   * Activate or click a control semantically by Name, AutomationId, or ControlType
   */
  invokeControl(appNameOrTitle, { name = '', automationId = '', controlType = '' } = {}) {
    if (!appNameOrTitle) return { ok: false, error: 'App name or title is required' };
    if (!name && !automationId && !controlType) {
      return { ok: false, error: 'Must specify at least one search criterion: name, automationId, or controlType' };
    }

    const res = this._runPowerShell('invoke_control', appNameOrTitle, name, automationId, controlType);
    return res;
  }

  /**
   * Set text value into a control (Edit, Document, etc.)
   */
  setControlValue(appNameOrTitle, { name = '', automationId = '', value = '' } = {}) {
    if (!appNameOrTitle) return { ok: false, error: 'App name or title is required' };
    if (!name && !automationId) {
      return { ok: false, error: 'Must specify name or automationId to identify control' };
    }

    const res = this._runPowerShell('set_value', appNameOrTitle, name, automationId, value);
    return res;
  }
}

const uiAutomationService = new UIAutomationService();
module.exports = uiAutomationService;
