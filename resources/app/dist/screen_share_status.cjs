'use strict';
/**
 * Screen Sharing State Detection — OBSERVATION ONLY.
 * Never enables sharing. Windows does not expose a reliable cross-app sharing
 * flag, so actual sharing is always NOT_VERIFIED unless a vendor indicator is
 * observed. Candidate windows are reported with evidence, not as proof.
 */

let uia = null;
try { uia = require('./ui_automation_service.cjs'); } catch (e) { uia = null; }

const CANDIDATES = [
  [/(zoom|zoom meetings)/i, 'Zoom'],
  [/(microsoft teams|teams)/i, 'Microsoft Teams'],
  [/(google meet|meet - )/i, 'Google Meet (browser tab)'],
  [/(obs studio)/i, 'OBS Studio'],
  [/(anydesk)/i, 'AnyDesk'],
  [/(teamviewer)/i, 'TeamViewer'],
  [/(quicktime|screen recording)/i, 'Possible recording tool'],
];

function status() {
  const out = {
    ok: true,
    service: 'screen-share-status',
    sharingState: 'NOT_VERIFIED',
    neverEnablesSharing: true,
    reason: 'No verified Windows or vendor API is connected; visual candidates are observations only.',
    observed: [],
  };
  if (!uia) { out.error = 'UIA service unavailable'; return out; }
  try {
    const r = uia.listVisibleWindows();
    const windows = Array.isArray(r) ? r : ((r && r.windows) || []);
    for (const w of windows) {
      const text = `${w.title || ''} ${w.processName || ''}`;
      for (const [re, label] of CANDIDATES) {
        if (re.test(text)) {
          out.observed.push({ label, title: w.title, process: w.processName, handle: w.handle, evidence: 'window title/process match' });
          break;
        }
      }
    }
    out.observedCount = out.observed.length;
    out.note = out.observed.length
      ? 'Meeting/recording applications are open. This does NOT prove that screen sharing is active.'
      : 'No known meeting or recording application window was observed.';
  } catch (e) { out.error = e.message; }
  return out;
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(status()));
  return router;
}

module.exports = { STATUS: { ok: true, service: 'screen-share-status', neverEnablesSharing: true }, status, createRouter };
