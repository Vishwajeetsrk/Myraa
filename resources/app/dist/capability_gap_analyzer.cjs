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
    id: 'business.operations',
    keywords: ['business', 'leads', 'crm', 'pipeline', 'revenue', 'profit', 'invoices', 'proposal', 'outreach', 'business report'],
    check() {
      try {
        const bos = require(path.join(DIST, 'business_os.cjs'));
        const s = bos.summary();
        if (s.status !== 'OK') {
          return { status: 'DEGRADED', reason: s.detail || 'business workspace not readable', evidence: { workspace: s.workspace || null } };
        }
        return {
          status: 'AVAILABLE',
          reason: `read-only business workspace: ${s.leadCount} leads, collected $${s.revenue.collected} of $${s.revenue.target}`,
          evidence: { workspace: s.workspace, leadCount: s.leadCount, revenue: s.revenue, blockers: s.blockers.length, warnings: s.warnings.length },
        };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
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
      try {
        const vs = require(path.join(DIST, 'video_engine.cjs')).status();
        return {
          status: vs.ok ? 'PARTIAL' : vs.status,
          reason: vs.ok
            ? 'ffmpeg/ffprobe verified; probe/analyze(scene+silence)/trim/concat/edit/thumbnail implemented with ffprobe output validation; vision/ASR and subtitles NOT_IMPLEMENTED'
            : vs.reason,
          evidence: { ffmpeg: vs.ffmpeg, ffprobe: vs.ffprobe, limitations: vs.limitations },
        };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
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
      try {
        const rs = require(path.join(DIST, 'skill_runner.cjs')).status();
        return {
          status: rs.ok ? 'PARTIAL' : 'UNAVAILABLE',
          reason: rs.ok
            ? rs.executable + ' of ' + rs.discovered + ' skills have real scripts; bounded execution with redacted receipts and a real approval gate works; install/update/remove and instruction-only execution remain NOT_IMPLEMENTED'
            : 'skill runner unavailable',
          evidence: { discovered: rs.discovered, executable: rs.executable, instructionOnly: rs.instructionOnly, receipts: rs.receipts },
        };
      } catch (e) { return { status: 'UNAVAILABLE', reason: e.message, evidence: null }; }
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
  {
    id: 'connector.oauth',
    keywords: ['oauth', 'gmail', 'google calendar', 'microsoft graph', 'salesforce', 'canva', 'figma', 'connect my account', 'sign in to'],
    check() {
      const configured = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GOOGLE_CLIENT_ID || process.env.MSGRAPH_CLIENT_ID);
      return {
        status: 'NOT_IMPLEMENTED',
        reason: configured
          ? 'credentials are present in env but no OAuth authorization/callback/token-refresh flow is implemented; env keys are not OAuth'
          : 'no OAuth flow implemented; only env-key connectors exist',
        evidence: { envCredentialPresent: configured, oauthFlow: false, tokenStore: false },
      };
    },
  },
  {
    id: 'mcp.http',
    keywords: ['mcp http', 'http transport', 'mcp resources', 'mcp prompts', 'remote mcp'],
    check() {
      try {
        const s = require(path.join(DIST, 'mcp_manager.cjs')).status();
        const impl = s.implemented || {};
        const available = impl.http === true;
        return {
          status: available ? 'AVAILABLE' : 'NOT_IMPLEMENTED',
          reason: available ? 'http transport reports implemented' : 'only stdio transport is implemented; resources/prompts/http are not',
          evidence: { implemented: impl },
        };
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
    required: ['vision model adapter', 'ASR transcription adapter', 'approval gate + render receipts'],
    steps: ['Add frame-sampling vision adapter for object/UI detection', 'Add ASR adapter for speech-to-text', 'Generate subtitles from transcript and wire into the edit pipeline', 'Add approval-gated render with output receipts'],
    verification: 'analyze a real clip and verify transcript/labels against known ground truth',
    note: 'core ffmpeg engine (probe/scene+silence analysis/trim/concat/edit/thumbnail with ffprobe validation) is already implemented',
  },
  'skills.execution': {
    required: ['install/update/remove lifecycle', 'self-test per skill', 'instruction-only execution adapter'],
    steps: ['Add install/update/remove with signature + dependency checks', 'Add a declarative self-test to each executable skill manifest', 'Define an honest execution mode for instruction-only skills', 'Wire skill receipts into the activity center'],
    verification: 'install a skill, run its self-test, execute it, verify declared output, then remove it cleanly',
    note: 'bounded runner with allowlisted interpreters, sanitised env, timeout, redacted receipts and real approval gating is already implemented',
  },
  'office.excel': {
    required: ['Excel chart API adapter', 'data-range binding', 'validation'],
    steps: ['Add chart builder to office engine', 'Bind charts to real ranges', 'Validate generated workbook with python openpyxl', 'Expose /api/office/word|excel capability state'],
    verification: 'generate a workbook with a bar chart and verify chart XML exists',
  },
  'connector.oauth': {
    required: ['OAuth client credentials', 'callback receiver', 'encrypted token store', 'refresh/revoke'],
    steps: ['Register OAuth app per provider and collect client credentials', 'Implement PKCE authorization + local callback receiver', 'Store tokens encrypted via secure_vault (never in React)', 'Add health check, refresh and revoke flows', 'Mark connector connected only after a real API call succeeds'],
    verification: 'complete an authorization flow and verify a real provider API returns 200 with no token in logs or UI',
  },
  'mcp.http': {
    required: ['HTTP transport client', 'auth', 'per-server/tool permissions', 'resources/prompts handlers'],
    steps: ['Add HTTP/SSE transport to mcp_stdio_client abstraction', 'Add per-server auth + timeouts + retries', 'Implement resources/list + prompts/list behind explicit permissions', 'Add health checks and audit trail', 'Keep all tool invocation approval-gated'],
    verification: 'connect to a real HTTP MCP server, list tools/resources/prompts and invoke one approved tool',
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

// ---------------------------------------------------------------- capability metadata (Phase A)
// Curated, reviewed - no arbitrary repository is granted execution privileges.
const META = Object.freeze({
  'screen.observe': { risk: 'LOW', requiresApproval: false, alternatives: ['window metadata only', 'OCR-only mode'], complexity: 'low', safeToAutoImplement: true, reusable: ['screen_intelligence.cjs', 'ui_automation_service.cjs'] },
  'screen.ocr': { risk: 'LOW', requiresApproval: false, setup: 'install tesseract.js / system tesseract', alternatives: ['vision model OCR', 'application text API'], complexity: 'medium', safeToAutoImplement: true, reusable: ['ocr_engine.cjs'] },
  'browser.automation': { risk: 'MEDIUM', requiresApproval: false, setup: 'playwright-core + browser executable', alternatives: ['CDP over existing Chrome'], complexity: 'low', safeToAutoImplement: true, reusable: ['browser_agent.cjs'] },
  'office.excel': { risk: 'MEDIUM', requiresApproval: true, setup: 'chart adapter + validation', alternatives: ['python openpyxl generation', 'Excel COM automation'], complexity: 'high', safeToAutoImplement: false, reusable: ['office_doc_engine.cjs', 'file_intelligence pipeline'], packages: ['exceljs'] },
  'office.word': { risk: 'MEDIUM', requiresApproval: true, alternatives: ['docx library generation', 'Word COM automation'], complexity: 'high', safeToAutoImplement: false, reusable: ['office_doc_engine.cjs', 'application_adapters.cjs'], packages: ['docx'] },
  'office.powerpoint': { risk: 'MEDIUM', requiresApproval: true, alternatives: ['pptxgenjs generation'], complexity: 'high', safeToAutoImplement: false, reusable: ['office_doc_engine.cjs'], packages: ['pptxgenjs'] },
  'video.engine': { risk: 'MEDIUM', requiresApproval: true, setup: 'ASR adapter + vision adapter', alternatives: ['whisper.cpp local ASR', 'frame-sampling vision model'], complexity: 'high', safeToAutoImplement: false, reusable: ['video_engine.cjs'], packages: ['ffmpeg'] },
  'github.integration': { risk: 'MEDIUM', requiresApproval: false, setup: 'GITHUB_TOKEN or OAuth app credentials', alternatives: ['git CLI for local operations'], complexity: 'medium', safeToAutoImplement: false, reusable: ['myraa_github_connector.cjs', 'git_service.cjs'] },
  'skills.execution': { risk: 'MEDIUM', requiresApproval: true, setup: 'signature verification + dependency resolver', alternatives: ['read-only instruction skills'], complexity: 'high', safeToAutoImplement: false, reusable: ['skill_registry.cjs', 'skill_runner.cjs', 'approval_manager.cjs'] },
  'mcp.stdio': { risk: 'LOW', requiresApproval: false, alternatives: [], complexity: 'low', safeToAutoImplement: true, reusable: ['mcp_manager.cjs', 'mcp_stdio_client.cjs'] },
  'connector.oauth': { risk: 'HIGH', requiresApproval: true, setup: 'OAuth client id/secret + callback + encrypted token store', alternatives: ['user-supplied personal access token via env'], complexity: 'high', safeToAutoImplement: false, reusable: ['connector_registry.cjs', 'secure_vault.cjs'] },
  'mcp.http': { risk: 'MEDIUM', requiresApproval: true, setup: 'HTTP transport + auth + per-server permissions', alternatives: ['stdio transport for local servers'], complexity: 'high', safeToAutoImplement: false, reusable: ['mcp_manager.cjs', 'mcp_stdio_client.cjs'] },
});

const UNSAFE = /(delete\s+(all|everything|system)|format\s+(drive|disk|c:)|wipe\s+(disk|drive)|exfiltrat|disable\s+(security|antivirus)|send\s+(credentials|passwords)\s+to)/i;

function checkOne(id) {
  const c = CATALOG.find((x) => x.id === id);
  if (!c) return { id, status: 'UNKNOWN', reason: 'capability not in catalog', evidence: null };
  try {
    const r = c.check();
    return { id, status: r.status, reason: r.reason, evidence: r.evidence, lastVerified: new Date().toISOString() };
  } catch (e) { return { id, status: 'FAILED', reason: e.message, evidence: null, lastVerified: new Date().toISOString() }; }
}

function gapDetails(id) {
  const c = CATALOG.find((x) => x.id === id);
  if (!c) return { ok: false, code: 'CAPABILITY_NOT_FOUND' };
  const checked = checkOne(id);
  const m = META[id] || {};
  const plan = PLANS[id] || {
    required: ['capability adapter', 'health check', 'integration test'],
    steps: ['Inspect the existing subsystem', 'Implement the missing adapter', 'Register with the capability registry', 'Add a real self-test and verify evidence'],
    verification: 'run the capability self-test and check the produced evidence',
  };
  return {
    ok: true,
    capability: id,
    status: checked.status,
    reason: checked.reason,
    evidence: checked.evidence,
    dependencies: (plan.required || []).concat(m.setup ? [m.setup] : []),
    availableAlternatives: m.alternatives || [],
    implementationPlan: plan.steps || [],
    verification: plan.verification,
    estimatedComplexity: m.complexity || 'medium',
    requiresUserAction: Boolean(m.setup || m.requiresApproval),
    safeToAutoImplement: m.safeToAutoImplement !== false,
    risk: m.risk || 'LOW',
    requiresApproval: Boolean(m.requiresApproval),
    reusableSystems: m.reusable || [],
    candidatePackages: m.packages || [],
    candidateRepos: m.repos || [],
    note: 'candidate packages/repos are curated and reviewed; nothing is installed or executed automatically',
  };
}

function canDo(request) {
  const text = String(request || '');
  if (!text.trim()) return { ok: true, verdict: 'UNKNOWN', reason: 'no request supplied' };
  if (UNSAFE.test(text)) return { ok: true, verdict: 'UNSAFE', reason: 'request matches a prohibited destructive/credential pattern; no action will be taken' };
  const a = analyze(text);
  if (!a.capabilities.length) return { ok: true, verdict: 'UNKNOWN', reason: 'no capability could be mapped to this request', request: text };
  const order = { AVAILABLE: 0, PARTIAL: 1, DEGRADED: 2, CONFIGURATION_REQUIRED: 3, DEPENDENCY_MISSING: 4, PROVIDER_REQUIRED: 5, OFFLINE: 6, PERMISSION_REQUIRED: 7, NOT_IMPLEMENTED: 8, UNAVAILABLE: 9, FAILED: 10 };
  const primary = [...a.capabilities].sort((x, y) => (order[x.status] ?? 11) - (order[y.status] ?? 11))[0];
  const m = META[primary.id] || {};
  let verdict;
  if (primary.status === 'AVAILABLE') verdict = 'YES';
  else if (['NOT_IMPLEMENTED', 'UNAVAILABLE', 'FAILED'].includes(primary.status)) verdict = 'NO_YET';
  else if (primary.status === 'PARTIAL' || primary.status === 'DEGRADED') verdict = 'PARTIAL';
  else if (primary.status === 'PERMISSION_REQUIRED' || m.requiresApproval) verdict = 'YES_WITH_APPROVAL';
  else if (['CONFIGURATION_REQUIRED', 'DEPENDENCY_MISSING', 'PROVIDER_REQUIRED', 'OFFLINE'].includes(primary.status)) verdict = 'YES_WITH_SETUP';
  else verdict = 'NO_YET';
  const gap = gapDetails(primary.id);
  return {
    ok: true,
    verdict,
    request: text,
    capability: primary.id,
    status: primary.status,
    reason: primary.reason,
    requiresApproval: verdict === 'YES_WITH_APPROVAL',
    requiresSetup: verdict === 'YES_WITH_SETUP',
    gap: verdict === 'NO_YET' || verdict === 'YES_WITH_SETUP' ? gap : null,
    note: 'verdict derives from runtime health checks, never from UI labels',
  };
}

function createImplementationTask(id, opts = {}) {
  const g = gapDetails(id);
  if (!g.ok) return g;
  if (!g.safeToAutoImplement) {
    return { ok: false, code: 'APPROVAL_REQUIRED', capability: id, reason: 'this capability is not safe to auto-implement; user approval and dependency changes are required', gap: g };
  }
  // Creates a DURABLE TASK describing the work. It does not install or execute anything.
  try {
    const tasks = require(path.join(DIST, 'task_engine.cjs'));
    const t = tasks.create({
      goal: 'Implement capability: ' + id,
      agent: 'Capability Intelligence',
      tools: g.reusableSystems,
      steps: g.implementationPlan,
    });
    if (!t || t.ok === false) return { ok: false, code: 'TASK_CREATE_FAILED', detail: t && t.error, gap: g };
    return {
      ok: true,
      taskId: t.task && t.task.id || null,
      capability: id,
      status: 'QUEUED',
      plan: g.implementationPlan,
      verification: g.verification,
      note: 'durable task created; implementation, dependency installation and registration still require execution and verification',
    };
  } catch (e) {
    return { ok: false, code: 'TASK_ENGINE_UNAVAILABLE', detail: e.message, plan: g.implementationPlan };
  }
}

function selfTest() {
  const results = CATALOG.map((c) => {
    const r = checkOne(c.id);
    return { capability: c.id, status: r.status, passed: STATUS.includes(r.status) && r.status !== 'FAILED', reason: r.reason };
  });
  return {
    ok: true,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
    note: 'self-test runs every capability health check; failures are reported, not hidden',
  };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/catalog', (req, res) => res.json({ ok: true, capabilities: CATALOG.map((c) => ({ id: c.id, keywords: c.keywords })), statuses: STATUS }));
  router.post('/analyze', (req, res) => res.json(analyze((req.body || {}).request)));
  router.post('/can-do', (req, res) => res.json(canDo((req.body || {}).request)));
  router.get('/gaps', (req, res) => {
    const a = analyze((req.query || {}).request || '');
    res.json({ ok: true, gaps: a.gaps.map((g) => gapDetails(g.capability)).filter((g) => g.ok) });
  });
  router.get('/gap/:id', (req, res) => {
    const g = gapDetails(req.params.id);
    res.status(g.ok ? 200 : 404).json(g);
  });
  router.get('/plan/:id', (req, res) => {
    const g = gapDetails(req.params.id);
    res.status(g.ok ? 200 : 404).json(g.ok ? {
      ok: true, capability: g.capability, required: g.dependencies, alternatives: g.availableAlternatives,
      plan: g.implementationPlan, verification: g.verification, complexity: g.estimatedComplexity,
      reusableSystems: g.reusableSystems, candidatePackages: g.candidatePackages, candidateRepos: g.candidateRepos,
      security: 'no repository/package is installed or executed without user approval and review',
    } : g);
  });
  router.post('/task/:id', (req, res) => {
    const r = createImplementationTask(req.params.id, req.body || {});
    res.status(r.ok ? 200 : 403).json(r);
  });
  router.get('/self-test', (req, res) => res.json(selfTest()));
  return router;
}
module.exports = { STATUS, CATALOG, META, analyze, canDo, gapDetails, createImplementationTask, selfTest, createRouter };
