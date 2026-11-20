'use strict';
/**
 * MYRAA IDE State — read-only composition of EXISTING sources.
 * No second browser/IDE integration. Git via local CLI, focus via UIA,
 * diagnostics are reported NOT_IMPLEMENTED instead of guessed.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const REPO = process.env.MYRAA_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..');
let uia = null;
try { uia = require('./ui_automation_service.cjs'); } catch (e) { uia = null; }

const IDE_PROCESS = /(code|antigravity|devenv|idea|pycharm|windows terminal|powershell|cmd)/i;

function git(args, timeout = 6000) {
  try {
    const out = execFileSync('git', args, { cwd: REPO, encoding: 'utf8', timeout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, output: String(out || '').trim().slice(0, 20000) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 400) };
  }
}

async function state() {
  const out = {
    ok: true,
    repository: REPO,
    capturedAt: new Date().toISOString(),
    limitations: [
      'Diagnostics/errors and open editor tabs require an IDE extension or API; NOT_IMPLEMENTED here.',
      'Selected text is reported only when the focused element exposes it and is not a password field.',
    ],
  };

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(['rev-parse', '--short', 'HEAD']);
  out.git = {
    branch: branch.ok ? branch.output : null,
    head: head.ok ? head.output : null,
    branchError: branch.error || null,
  };

  const status = git(['status', '--porcelain=v1']);
  const lines = status.ok ? status.output.split('\n').filter(Boolean) : [];
  out.git.changedFileCount = lines.length;
  out.git.sampleChanges = lines.slice(0, 20);

  if (uia) {
    try {
      const fg = await uia.getForegroundWindow();
      const focus = await uia.getFocusedElement();
      const listed = uia.listVisibleWindows();
      const windows = Array.isArray(listed) ? listed : ((listed && listed.windows) || []);
      out.foreground = fg && fg.ok && fg.window ? {
        title: fg.window.title, process: fg.window.processName, handle: fg.window.handle,
      } : null;
      const f = focus && focus.ok && focus.element ? focus.element : null;
      out.focus = f ? {
        name: f.name || null,
        controlType: f.controlType || null,
        windowTitle: f.windowTitle || null,
        isPassword: f.isPassword === true,
        selectedText: f.isPassword === true || !f.hasSelection ? null : String(f.selectedText || '').slice(0, 1000),
        selectionWithheld: f.isPassword === true,
      } : null;
      out.ideWindows = windows.filter((w) => IDE_PROCESS.test(String(w.processName || '')))
        .slice(0, 20)
        .map((w) => ({ title: w.title, process: w.processName, handle: w.handle, state: w.state }));
      out.currentFile = (f && f.windowTitle) || (fg && fg.window && fg.window.title) || null;
    } catch (e) { out.uiError = e.message; }
  } else {
    out.uiError = 'UIA service unavailable';
  }

  out.diagnostics = { status: 'NOT_IMPLEMENTED', reason: 'No IDE extension/API is connected; errors and open tabs are not guessed.' };
  return out;
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json({ ok: true, service: 'ide-state', repository: REPO, mode: 'read-only' }));
  router.get('/state', async (req, res) => {
    try { res.json(await state()); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
  router.get('/git/log', (req, res) => {
    const n = Math.min(50, Math.max(1, Number(req.query.n) || 10));
    const r = git(['log', `-${n}`, '--oneline', '--decorate']);
    res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true, log: r.output.split('\n').filter(Boolean) } : r);
  });
  router.get('/git/diff', (req, res) => {
    const r = git(['diff', '--stat']);
    res.status(r.ok ? 200 : 500).json(r.ok ? { ok: true, diffStat: r.output.slice(0, 20000) } : r);
  });
  return router;
}

module.exports = { STATUS: { ok: true, service: 'ide-state', mode: 'read-only' }, REPO, state, createRouter };
