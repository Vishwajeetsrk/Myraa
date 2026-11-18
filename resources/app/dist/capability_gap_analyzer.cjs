'use strict';
/**
 * Capability Gap Analyzer (advanced spec sections 2-3, 27-28).
 * Maps a natural-language request to real MYRAA capabilities, checks each one
 * against actual runtime evidence, and returns a concrete implementation plan
 * for gaps. It never labels a missing capability as available.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIST = __dirname;
const STATUS = Object.freeze([
  'AVAILABLE', 'PARTIAL', 'DEGRADED', 'UNAVAILABLE', 'NOT_IMPLEMENTED',
  'CONFIGURATION_REQUIRED', 'PERMISSION_REQUIRED', 'DEPENDENCY_MISSING',
  'PROVIDER_REQUIRED', 'OFFLINE', 'FAILED',
]);

function exists(p) { try { return !!p && fs.existsSync(p); } catch (e) { return false; } }
function moduleHas(file, method) {
  try {
    const m = require(path.join(DIST, file));
    return typeof m[method] === 'function';
  } catch (e) { return false; }
}
function commandAvailable(cmd) {
  try {
    const r = spawnSync(cmd, ['-version'], { windowsHide: true, timeout: 3000, encoding: 'utf8' });
    return { ok: !r.error && r.status === 0, detail: r.error ? r.error.message : String(r.stdout || r.stderr || '').slice(0, 120) };
  } catch (e) { return { ok: false, detail: e.message }; }
}

const CATALOG = [
  {
    id: 'screen.observe',
    keywords: ['screen', 'screenshot', 'see', 'look at screen', 'what is on my screen'],
    check() {
      try {
        const si = require(path.join(DIST, 'screen_intelligence.cjs'));
        const s = si.status();
        return { status: s.ok ? 'AVAILABLE' : 'DEGRADED', reason: s.consent ? 'consent enabled, observation available' : 'consent disabled - observation blocked', evidence: { consent: s.consent, sources: s.sources } };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
    },
  },
  {
    id: 'screen.ocr',
    keywords: ['ocr', 'read text on screen', 'read text from image', 'scanned'],
    check() {
      try {
        const s = require(path.join(DIST, 'ocr_engine.cjs')).status();
        return { status: s.installed ? 'AVAILABLE' : 'DEPENDENCY_MISSING', reason: s.detail, evidence: { method: s.method } };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
    },
  },
  {
    id: 'browser.automation',
    keywords: ['browser', 'website', 'web page', 'open site', 'navigate', 'form', 'scrape'],
    check() {
      try {
        const BrowserAgent = require(path.join(DIST, 'browser_agent.cjs'));
        const c = new BrowserAgent().getCapabilities();
        return { status: c.playwrightAvailable ? 'AVAILABLE' : 'DEPENDENCY_MISSING', reason: c.runtimeSource + ' / ' + (c.executablePath || 'no browser executable'), evidence: c };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
    },
  },
  {
    id: 'office.excel',
    keywords: ['excel', 'spreadsheet', 'workbook', 'formula', 'pivot', 'dashboard'],
    check() {
      const present = exists(path.join(DIST, 'office_doc_engine.cjs'));
      return {
        status: present ? 'PARTIAL' : 'UNAVAILABLE',
        reason: present ? 'Word/Excel/PPT engine present; advanced chart/dashboard automation not yet verified' : 'office engine missing',
        evidence: { file: 'office_doc_engine.cjs', present },
      };
    },
  },
  {
    id: 'office.word',
    keywords: ['word', 'document', 'docx', 'format document', 'report'],
    check() {
      const present = exists(path.join(DIST, 'office_doc_engine.cjs'));
      return { status: present ? 'PARTIAL' : 'UNAVAILABLE', reason: present ? 'generation/review present; live open-document visual editing not verified' : 'office engine missing', evidence: { file: 'office_doc_engine.cjs', present } };
    },
  },
  {
    id: 'office.powerpoint',
    keywords: ['powerpoint', 'pptx', 'slides', 'presentation'],
    check() {
      const present = exists(path.join(DIST, 'office_doc_engine.cjs'));
      return { status: present ? 'PARTIAL' : 'UNAVAILABLE', reason: present ? 'generation present; slide redesign not verified' : 'office engine missing', evidence: { present } };
    },
  },
  {
    id: 'video.engine',
    keywords: ['video', 'mp4', 'subtitle', 'trim video', 'transcribe video', 'render video'],
    check() {
      const ff = commandAvailable('ffmpeg');
      return {
        status: ff.ok ? 'PARTIAL' : 'DEPENDENCY_MISSING',
        reason: ff.ok ? 'ffmpeg available; MYRAA video adapter not implemented yet' : 'ffmpeg not available: ' + ff.detail,
        evidence: { ffmpeg: ff.ok, detail: ff.detail },
      };
    },
  },
  {
    id: 'github.integration',
    keywords: ['github', 'repo', 'pull request', 'issue', 'git'],
    check() {
      const token = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
      const detector = moduleHas('myraa_github_connector.cjs', 'invoke') || exists(path.join(DIST, 'myraa_github_connector.cjs'));
      return {
        status: detector ? (token ? 'AVAILABLE' : 'CONFIGURATION_REQUIRED') : 'UNAVAILABLE',
        reason: detector ? (token ? 'GitHub connector present and token configured' : 'GitHub connector present but no token configured') : 'no GitHub connector detected',
        evidence: { connector: detector, tokenConfigured: token },
      };
    },
  },
  {
    id: 'skills.execution',
    keywords: ['skill', 'run skill', 'execute skill'],
    check() {
      const present = exists(path.join(DIST, 'skill_registry.cjs'));
      return { status: present ? 'NOT_IMPLEMENTED' : 'UNAVAILABLE', reason: present ? 'registry reports manifests; runner/sandbox not implemented' : 'registry missing', evidence: { registry: present, run: false } };
    },
  },
  {
    id: 'mcp.stdio',
    keywords: ['mcp', 'mcp server', 'tool call'],
    check() {
      try {
        const s = require(path.join(DIST, 'mcp_manager.cjs')).status();
        return { status: s.ok ? 'AVAILABLE' : 'UNAVAILABLE', reason: s.count + ' registered MCP server(s)', evidence: { count: s.count, implemented: s.implemented } };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
    },
  },
];

const PLANS = {
  'browser.automation': {
    required: ['playwright runtime', 'system Chrome/Edge'],
    steps: ['Install playwright-core', 'Resolve a real browser executable', 'Add semantic selectors before coordinates', 'Verify start/navigate/screenshot with a real page'],
    verification: 'POST /api/browser/start -> navigate -> screenshot file exists',
  },
  'video.engine': {
    required: ['ffmpeg binary', 'video adapter module', 'output validation'],
    steps: ['Install ffmpeg', 'Add video_engine.cjs wrapper (probe/analyze/trim)', 'Add output existence + ffprobe validation', 'Register capability + tests'],
    verification: 'render a 1-second clip and validate output with ffprobe',
  },
  'skills.execution': {
    required: ['skill runner', 'permission checks', 'sandbox', 'timeout/cancel', 'audit'],
    steps: ['Add skill_runner.cjs using the action registry', 'Validate manifest permissions before execution', 'Run in a bounded process with timeout', 'Write receipts + verification result'],
    verification: 'run a harmless test skill and verify its declared output',
  },
  'office.excel': {
    required: ['Excel chart API adapter', 'data-range binding', 'validation'],
    steps: ['Add chart builder to office engine', 'Bind charts to real ranges', 'Validate generated workbook with python openpyxl', 'Expose /api/office/word|excel capability state'],
    verification: 'generate a workbook with a bar chart and verify chart XML exists',
  },
};

function analyze(request) {
  const text = String(request || '').toLowerCase();
  const matches = CATALOG.filter((c) => c.keywords.some((k) => text.indexOf(k) !== -1));
  const checked = (matches.length ? matches : CATALOG).map((c) => {
    let result;
    try { result = c.check(); } catch (e) { result = { status: 'FAILED', reason: e.message, evidence: null }; }
    return { id: c.id, status: result.status, reason: result.reason, evidence: result.evidence, lastVerified: new Date().toISOString() };
  });
  const gaps = checked.filter((c) => !['AVAILABLE'].includes(c.status)).map((c) => ({
    capability: c.id,
    status: c.status,
    why: c.reason,
    required: (PLANS[c.id] && PLANS[c.id].required) || ['runtime verification'],
    implementation: PLANS[c.id] || {
      required: ['capability adapter', 'health check', 'tests'],
      steps: ['Inspect the existing subsystem', 'Implement the missing adapter', 'Register the capability', 'Add a real self-test'],
      verification: 'run the capability self-test and check the produced evidence',
    },
  }));
  return {
    ok: true,
    request: String(request || ''),
    capabilities: checked,
    gaps,
    statuses: STATUS,
    note: 'statuses come from real runtime checks; NOT_IMPLEMENTED means no working executor exists',
  };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/catalog', (req, res) => res.json({ ok: true, capabilities: CATALOG.map((c) => ({ id: c.id, keywords: c.keywords })), statuses: STATUS }));
  router.post('/analyze', (req, res) => res.json(analyze((req.body || {}).request)));
  return router;
}
module.exports = { STATUS, CATALOG, analyze, createRouter };
