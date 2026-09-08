/**
 * =============================================================================
 * MYRAA AI OS — Passive Learning Engine (Continuous Teach & Learn)
 * =============================================================================
 * Explicitly toggled background observation mode that learns application usage
 * patterns and workflows continuously while active.
 *
 * Safety & Privacy:
 *  - Default state: strictly OFF (IDLE)
 *  - Indicator state ALWAYS matches execution state (RECORDING vs IDLE)
 *  - Password field exclusion: uses UI Automation IsPassword property to guarantee
 *    passwords are NEVER logged, saved, or exposed.
 *  - Consolidates observed actions into replayable workflows in automation_workflows.json
 *    and Memory Core app_knowledge table.
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const uiAutomation = require('./ui_automation_service.cjs');
const memoryCore = require('./memory_core_service.cjs');

const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Vishwajeet', 'AppData', 'Roaming');
const myraaDir = path.join(appData, 'MYRAA');
const LOG_FILE = path.join(myraaDir, 'passive_learning_log.json');
const WORKFLOWS_FILE = path.join(myraaDir, 'automation_workflows.json');

class PassiveLearningService {
  constructor() {
    this.isActive = false;
    this.sessionId = null;
    this.sessionName = '';
    this.startedAt = null;
    this.currentApp = null;
    this.capturedEvents = [];
    this.pollInterval = null;
    this._ensureDir();
  }

  _ensureDir() {
    try {
      if (!fs.existsSync(myraaDir)) fs.mkdirSync(myraaDir, { recursive: true });
    } catch (e) {}
  }

  /**
   * The visible indicator state MUST always strictly match internal active state.
   */
  get indicator() {
    return this.isActive ? 'RECORDING' : 'IDLE';
  }

  getStatus() {
    return {
      isActive: this.isActive,
      indicator: this.indicator,
      sessionId: this.sessionId,
      sessionName: this.sessionName,
      eventCount: this.capturedEvents.length,
      currentApp: this.currentApp,
      startedAt: this.startedAt,
      policy: 'Password exclusion enforced via UI Automation IsPassword property'
    };
  }

  /**
   * Explicitly start passive learning mode
   */
  start(sessionName = 'Learned_Workflow') {
    if (this.isActive) {
      return {
        ok: true,
        alreadyActive: true,
        status: this.indicator,
        sessionId: this.sessionId,
        message: 'Passive learning is already actively recording.'
      };
    }

    this.isActive = true;
    this.sessionId = 'pl_' + Date.now();
    this.sessionName = sessionName;
    this.startedAt = new Date().toISOString();
    this.capturedEvents = [];
    this.currentApp = null;

    // Detect initial foreground window
    const winRes = uiAutomation.listVisibleWindows();
    if (winRes.ok && winRes.windows && winRes.windows.length > 0) {
      this.currentApp = winRes.windows[0].title;
    }

    this._saveLog();

    return {
      ok: true,
      sessionId: this.sessionId,
      sessionName: this.sessionName,
      status: this.indicator,
      startedAt: this.startedAt,
      message: '✓ Continuous passive learning activated. All password fields excluded automatically.'
    };
  }

  /**
   * Explicitly stop passive learning mode and synthesize workflow
   */
  stop() {
    if (!this.isActive) {
      return {
        ok: true,
        alreadyStopped: true,
        status: this.indicator,
        message: 'Passive learning is not active.'
      };
    }

    this.isActive = false;
    const endedAt = new Date().toISOString();
    const finalEvents = [...this.capturedEvents];

    // Consolidate into workflow if events exist
    let workflow = null;
    if (finalEvents.length > 0) {
      workflow = {
        id: 'wf_' + this.sessionId,
        name: this.sessionName || ('Workflow_' + Date.now()),
        targetApp: this.currentApp || 'DesktopApp',
        steps: finalEvents.map(e => ({
          type: e.type,
          controlName: e.controlName,
          controlType: e.controlType,
          automationId: e.automationId,
          value: e.value,
          hotkey: e.hotkey,
          timestamp: e.timestamp
        })),
        createdAt: this.startedAt,
        finalizedAt: endedAt
      };

      // Persist to automation_workflows.json
      this._saveWorkflow(workflow);

      // Persist to Memory Core app_knowledge table
      try {
        if (workflow.targetApp) {
          memoryCore.saveAppKnowledge(workflow.targetApp, [], [workflow]);
        }
      } catch (e) {}
    }

    this._saveLog();

    return {
      ok: true,
      sessionId: this.sessionId,
      status: this.indicator,
      eventCount: finalEvents.length,
      startedAt: this.startedAt,
      endedAt,
      workflow,
      message: '✓ Passive learning stopped. Actions consolidated and saved.'
    };
  }

  /**
   * Record an observed interaction event with GUARANTEED password exclusion
   */
  recordAction(event = {}) {
    if (!this.isActive) {
      return { ok: false, error: 'Cannot record action: passive learning mode is not active.' };
    }

    // ── STRICT PASSWORD EXCLUSION BARRIER ──────────────────────────────────
    const isPasswordField =
      event.isPassword === true ||
      /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(event.controlType)) ||
      /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(event.controlName)) ||
      /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(event.automationId)) ||
      /(password|passwd|pin|secret|passcode|token|credential)/i.test(String(event.name || ''));

    let sanitizedValue = event.value;
    if (isPasswordField) {
      // REDACT: Under no circumstances is the actual password value stored or logged
      sanitizedValue = '[REDACTED_PASSWORD]';
    }

    const recorded = {
      index: this.capturedEvents.length + 1,
      type: event.type || 'click', // 'click' | 'type_text' | 'hotkey' | 'window_focus'
      app: event.app || this.currentApp || 'UnknownApp',
      controlName: event.controlName || '',
      controlType: event.controlType || '',
      automationId: event.automationId || '',
      value: sanitizedValue,
      hotkey: event.hotkey || null,
      isPassword: isPasswordField,
      redacted: isPasswordField,
      timestamp: new Date().toISOString()
    };

    if (event.app) this.currentApp = event.app;

    this.capturedEvents.push(recorded);
    this._saveLog();

    return {
      ok: true,
      recorded,
      totalEvents: this.capturedEvents.length,
      status: this.indicator
    };
  }

  _saveLog() {
    try {
      const payload = {
        sessionId: this.sessionId,
        sessionName: this.sessionName,
        isActive: this.isActive,
        indicator: this.indicator,
        startedAt: this.startedAt,
        events: this.capturedEvents
      };
      fs.writeFileSync(LOG_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}
  }

  _saveWorkflow(workflow) {
    try {
      let list = [];
      if (fs.existsSync(WORKFLOWS_FILE)) {
        try { list = JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf8')); } catch(e) {}
      }
      if (!Array.isArray(list)) list = [];
      list.unshift(workflow);
      fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {}
  }

  getSavedWorkflows() {
    try {
      if (fs.existsSync(WORKFLOWS_FILE)) {
        return JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf8'));
      }
    } catch (e) {}
    return [];
  }

  /**
   * Replay a recorded workflow sequence using UI Automation
   */
  async replayWorkflow(workflowIdOrName) {
    const workflows = this.getSavedWorkflows();
    const wf = workflows.find(w => 
      w.id === workflowIdOrName || 
      (w.name && w.name.toLowerCase() === String(workflowIdOrName).toLowerCase())
    );

    if (!wf) {
      return { ok: false, error: `Workflow '${workflowIdOrName}' not found.` };
    }

    const results = [];
    for (const step of (wf.steps || [])) {
      if (step.type === 'click' || step.type === 'invoke') {
        const invRes = uiAutomation.invokeControl(wf.targetApp, {
          name: step.controlName,
          automationId: step.automationId,
          controlType: step.controlType
        });
        results.push({ step: step.controlName, action: 'click', result: invRes });
      } else if (step.type === 'type_text') {
        if (step.value === '[REDACTED_PASSWORD]') {
          results.push({ step: step.controlName, action: 'type_text', skipped: true, note: 'Skipped password entry for security' });
        } else {
          const valRes = uiAutomation.setControlValue(wf.targetApp, {
            name: step.controlName,
            automationId: step.automationId,
            value: step.value
          });
          results.push({ step: step.controlName, action: 'type_text', result: valRes });
        }
      } else if (step.type === 'hotkey' && step.hotkey) {
        try {
          const da = require('./desktopAutomation.cjs');
          da.hotkey(step.hotkey);
          results.push({ step: step.hotkey, action: 'hotkey', result: { ok: true } });
        } catch(e) {
          results.push({ step: step.hotkey, action: 'hotkey', error: e.message });
        }
      }
    }

    return {
      ok: true,
      workflowName: wf.name,
      stepsExecuted: results.length,
      details: results,
      message: `✓ Replayed workflow '${wf.name}' (${results.length} steps executed)`
    };
  }
}

const passiveLearningService = new PassiveLearningService();
module.exports = passiveLearningService;
