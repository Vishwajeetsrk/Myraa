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
const { spawnSync } = require('child_process');
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
