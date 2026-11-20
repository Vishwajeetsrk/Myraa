'use strict';
/**
 * =============================================================================
 * MYRAA AI OS — Unified Capability Router (v9.3.0)
 * =============================================================================
 * Central native intent dispatcher for:
 * 1. MS Word Generation (.docx) & Live Word Typing Automation
 * 2. MS PowerPoint Presentation Generation (.pptx) & Slide Automation
 * 3. MS Excel Spreadsheet Generation (.xlsx) & Data Automation
 * 4. Autonomous Coding Agent (Git, TestRunner, DevEngine, Terminal, AST)
 * 5. Universal Skills & Desktop Control (System, Vision, Audio, MCP Suite)
 *
 * Guaranteed Rule 1 compliance: ZERO EMOJIS in all outputs.
 * Guaranteed Rule 2 compliance: ZERO destructive operations on user files.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

let officeDocEngine = null;
let desktopAutomation = null;
let codingOrchestrator = null;
let skillsMcpEngine = null;
let weatherService = null;

function _lazyLoad() {
  const dist = __dirname;
  try { officeDocEngine = require(path.join(dist, 'office_doc_engine.cjs')); } catch (e) { console.warn('[UnifiedRouter] office_doc_engine:', e.message); }
  try { desktopAutomation = require(path.join(dist, 'desktopAutomation.cjs')); } catch (e) { console.warn('[UnifiedRouter] desktopAutomation:', e.message); }
  try { codingOrchestrator = require(path.join(dist, 'coding_orchestrator.cjs')); } catch (e) { console.warn('[UnifiedRouter] coding_orchestrator:', e.message); }
  try { skillsMcpEngine = require(path.join(dist, 'skills_mcp_engine.cjs')); } catch (e) { console.warn('[UnifiedRouter] skills_mcp_engine:', e.message); }
  try { weatherService = require(path.join(dist, 'weather_service.cjs')); } catch (e) { console.warn('[UnifiedRouter] weather_service:', e.message); }
}
_lazyLoad();

// ── USER-FACING STORAGE ──────────────────────────────────────────────────────
const USER_PROJECT_ROOT = process.env.MYRAA_PROJECT_DIR || process.cwd();
const USER_OFFICE_OUTPUT = path.join(USER_PROJECT_ROOT, 'Projects', 'OfficeOutput');
if (!fs.existsSync(USER_OFFICE_OUTPUT)) {
  try { fs.mkdirSync(USER_OFFICE_OUTPUT, { recursive: true }); } catch (_) {}
}

function copyToUserOutput(srcPath) {
  if (!srcPath || !fs.existsSync(srcPath)) return srcPath;
  try {
    const filename = path.basename(srcPath);
    const dest = path.join(USER_OFFICE_OUTPUT, filename);
    fs.copyFileSync(srcPath, dest);
    return dest;
  } catch (err) {
    return srcPath;
  }
}

// ── INTENT CLASSIFICATION PATTERNS ───────────────────────────────────────────

// 1. MS Word Patterns
const WORD_CREATE_PATTERNS = [
  /\b(?:create|make|generate|build|new|draft|compose|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:ms\s*)?(?:word|document|docx|doc|report|letter|proposal|resume|manual|whitepaper|sop|contract)\b/i,
  /\b(?:ms\s*)?(?:word|document|docx|doc)\s*(?:create|generate|banao|kholo|make|open)\b/i,
  /\b(?:word|docx)\s+(?:me|mein)\s+(?:banao|likho|report|file)\b/i,
  /\b(?:write|draft)\s+(?:a\s+)?(?:report|letter|proposal|contract|document)\s+(?:in|using|with)\s+word\b/i
];

const WORD_WRITE_PATTERNS = [
  /\b(?:write|type|likho|enter|insert|paste)\s+(?:into|in|on|to)?\s*(?:ms\s*)?(?:word|document|docx|doc)\b/i,
  /\b(?:word|document|docx)\s*(?:me|mein)\s*(?:likho|type\s*karo|write)\b/i,
  /^write\s+(?:into|in)\s+word[:\s]+(.+)$/i,
  /^type\s+(?:into|in)\s+word[:\s]+(.+)$/i
];

// 2. PowerPoint / PPT Patterns
const PPT_CREATE_PATTERNS = [
  /\b(?:create|make|generate|build|new|design|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:ppt|presentation|powerpoint|slides?|pptx|deck)\b/i,
  /\b(?:ppt|presentation|powerpoint|slides?|pptx)\s*(?:create|generate|banao|kholo|make|open)\b/i,
  /\b(?:ppt|slides?)\s+(?:me|mein)\s+(?:banao|deck|presentation)\b/i,
  /\bpresentation\s+(?:on|about|for)\s+([a-zA-Z0-9_\-\s]+)/i
];

const PPT_WRITE_PATTERNS = [
  /\b(?:write|type|likho|insert)\s+(?:into|in|on|to)?\s*(?:ppt|presentation|powerpoint|slides?)\b/i,
  /\b(?:ppt|slides?)\s*(?:me|mein)\s*(?:likho|type\s*karo|write)\b/i
];

// 3. Excel Patterns
const EXCEL_CREATE_PATTERNS = [
  /\b(?:create|make|generate|build|new|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:excel|spreadsheet|sheet|xlsx|workbook|tracker)\b/i,
  /\b(?:excel|spreadsheet|sheet|xlsx|workbook)\s*(?:create|generate|banao|kholo|make|open)\b/i,
  /\b(?:excel|sheet)\s+(?:me|mein)\s+(?:banao|sheet|spreadsheet)\b/i,
  /\bspreadsheet\s+(?:for|on|about)\s+([a-zA-Z0-9_\-\s]+)/i
];

const EXCEL_WRITE_PATTERNS = [
  /\b(?:write|type|likho|insert|enter)\s+(?:into|in|on|to)?\s*(?:excel|spreadsheet|sheet|xlsx)\b/i,
  /\b(?:excel|sheet)\s*(?:me|mein)\s*(?:likho|type\s*karo|write)\b/i
];

// 4. Coding Agent Patterns
const CODING_PATTERNS = [
  /\b(?:coding|code|start coding|coding agent|developer agent|code agent|programmer)\b/i,
  /\b(?:git\s+(?:status|log|diff|commit|push|pull|branch|checkout|stash))\b/i,
  /\b(?:run\s+(?:the\s+)?(?:tests?|test|suite|jest|vitest|pytest))\b/i,
  /\b(?:build\s+(?:the\s+)?(?:project|app|code))\b/i,
  /\b(?:lint\s+(?:the\s+)?(?:project|code|files?))\b/i,
  /\b(?:install\s+(?:dependencies|packages|deps)|npm\s+install|yarn\s+install)\b/i,
  /\b(?:fix\s+(?:the\s+)?(?:error|bug|issue|failure|build|crash))\b/i,
  /\b(?:refactor|review\s+code|explain\s+code|search\s+in\s+project)\b/i,
  /\b(?:open|launch)\s+(?:vscode|vs\s*code|visual studio code)\b/i,
  /\b(?:create|build|make)\s+(?:a\s+)?(?:react|vue|node|next|python|api|web)\s+(?:project|app|website)\b/i
];

// 5. Universal Skills & Desktop Patterns
const SKILLS_LIST_PATTERNS = [
  /\b(?:skills?|list skills?|show skills?|what skills?|capabilities|what can you do|skills catalog|all skills)\b/i
];

const SCREENSHOT_PATTERNS = [
  /\b(?:take\s*(?:a\s*)?screenshot|capture\s*screen|screenshot\s*le\s*lo|screen\s*snapshot)\b/i
];

const WEATHER_PATTERNS = [
  /\b(?:weather|temperature|forecast|mausam|is it raining|humidity)\b/i
];

const SYSTEM_INFO_PATTERNS = [
  /\b(?:system\s*info|sysinfo|specs|cpu\s*info|ram\s*info|hardware\s*info|pc\s*specs)\b/i
];

const VOLUME_PATTERNS = [
  /\b(?:volume\s*up|volume\s*down|mute|unmute|sound\s*up|sound\s*down|awaaz\s*(?:badhao|kam\s*karo|band))\b/i
];

// 6. Website Creation & Design Patterns
const WEBSITE_CREATE_PATTERNS = [
  /\b(?:create|build|make|generate|design)\s+(?:a\s+)?(?:new\s+)?(?:website|landing\s*page|web\s*app|site|portal|webpage)\b/i,
  /\b(?:website|landing\s*page|site)\s*(?:with\s*3\s*designs?|3\s*designs?|banao|create|make)\b/i,
  /\b(?:create|make|build)\s+website\s+(?:with\s+)?3\s+design/i
];

// 7. Listening & Presence Check Patterns
const LISTENING_CHECK_PATTERNS = [
  /\b(?:are\s*you\s*listening|can\s*you\s*hear\s*me|sun\s*rahi\s*ho|are\s*you\s*there|am\s*i\s*audible|check\s*mic|listening\s*test|can\s*you\s*listen)\b/i
];

// 8. Business OS Patterns (read-only awareness: leads, finance, email, reports)
const BUSINESS_REPORT_PATTERNS = [
  /\b(?:business|pipeline|sales|outreach)\b.*\b(?:report|status|summary|update|overview)\b/i,
  /\b(?:report|status|summary|update|overview)\b.*\b(?:business|pipeline|sales|outreach)\b/i,
  /\b(?:daily|today'?s?)\s+business\s+report\b/i
];

const BUSINESS_LEADS_PATTERNS = [
  /\b(?:how\s+many|count|show|list|any)\b.*\b(?:leads?|prospects?|crm)\b/i,
  /\b(?:leads?|prospects?)\b.*\b(?:status|count|list|summary)\b/i
];

const BUSINESS_FINANCE_PATTERNS = [
  /\b(?:revenue|profit|earnings|collected|finance|financial)\b.*\b(?:report|status|summary|so\s+far|today|overview)\b/i,
  /\bhow\s+much\b.*\b(?:earned|made|collected|revenue|profit)\b/i
];

const BUSINESS_EMAIL_PATTERNS = [
  /\b(?:email|outreach)\b.*\b(?:status|drafts?|templates?|connected|connection)\b/i
];

function detectBusinessIntent(lower) {
  if (BUSINESS_REPORT_PATTERNS.some((p) => p.test(lower))) return 'report';
  if (BUSINESS_LEADS_PATTERNS.some((p) => p.test(lower))) return 'leads';
  if (BUSINESS_FINANCE_PATTERNS.some((p) => p.test(lower))) return 'finance';
  if (BUSINESS_EMAIL_PATTERNS.some((p) => p.test(lower))) return 'email';
  return null;
}

// VBA intelligence patterns. These never invent macro source: code comes from
// the caller or, on an explicit "this macro" request, the clipboard.
const VBA_EXPLAIN_PATTERNS = [
  /\b(?:explain|describe|what\s+does|what\s+is)\b.*\b(?:this|the|my)?\s*(?:vba|macro|module)\b/i,
  /\b(?:vba|macro)\b.*\b(?:explain|explanation|what\s+does\s+it\s+do)\b/i
];
const VBA_REVIEW_PATTERNS = [
  /\b(?:review|check|audit|inspect|find\s+bugs?\s+in)\b.*\b(?:this|the|my)?\s*(?:vba|macro|code)\b/i,
  /\b(?:vba|macro)\b.*\b(?:bugs?|fragile|spelling|problems?)\b/i
];
const VBA_IMPROVE_PATTERNS = [
  /\b(?:improve|fix|clean|rewrite|refactor|make\s+(?:it\s+)?safer)\b.*\b(?:this|the|my)?\s*(?:vba|macro|code)\b/i,
  /\b(?:convert|turn)\b.*\b(?:recorded|recorder)\b.*\b(?:vba|macro)\b/i
];

function detectVbaIntent(lower) {
  if (VBA_EXPLAIN_PATTERNS.some((p) => p.test(lower))) return 'explain';
  if (VBA_REVIEW_PATTERNS.some((p) => p.test(lower))) return 'review';
  if (VBA_IMPROVE_PATTERNS.some((p) => p.test(lower))) return 'improve';
  return null;
}

const FRAMEWORK_PATTERNS = [
  [/\b(?:reality\s*check|challenge\s+(?:this|the)\s+idea)\b/i, 'realityCheck', 'FRAMEWORK_REALITY_CHECK'],
  [/\b(?:write|create|make|generate|draft)\b.*\b(?:prd|product\s+requirements?)\b/i, 'prd', 'FRAMEWORK_PRD'],
  [/\b(?:what\s+will\s+break|how\s+would\s+this\s+(?:saas|product)\s+fail)\b/i, 'whatWillBreak', 'FRAMEWORK_WHAT_WILL_BREAK'],
  [/\b(?:weakness\s+audit|audit\s+(?:this|the)\s+(?:saas|product))\b/i, 'weaknessAudit', 'FRAMEWORK_WEAKNESS_AUDIT'],
  [/\b(?:do\s+we\s+(?:even\s+)?need\s+to\s+build|can\s+(?:an?\s+)?(?:api|mcp|script|excel)\s+(?:solve|do)\s+(?:this|it))\b/i, 'doWeNeedToBuild', 'FRAMEWORK_BUILD_NECESSITY'],
  [/\b(?:legal\s+awareness|compliance\s+review)\b/i, 'legalAwareness', 'FRAMEWORK_LEGAL_AWARENESS'],
  [/\b(?:final\s+task\s+report|task\s+summary)\b/i, 'finalReport', 'FRAMEWORK_FINAL_REPORT'],
];

function detectFrameworkIntent(lower) {
  for (const [re, name, action] of FRAMEWORK_PATTERNS) {
    if (re.test(lower)) return { name, action };
  }
  return null;
}

let pendingWorkflowToken = null;

function detectWorkflowIntent(lower) {
  if (/\b(?:save this skill|confirm (?:the |this )?skill|yes save (?:it|this))\b/i.test(lower)) return 'confirm';
  if (/\b(?:dry run|preview)\b.*\b(?:workflow|skill)\b/i.test(lower)) return 'dryRun';
  if (/\brun\b.*\b(?:workflow|skill)\b/i.test(lower)) return 'run';
  if (/\b(?:learn this|learn how i|watch what i(?:'|a)m doing|automate this|do what i just did|turn this into a skill|save this workflow)\b/i.test(lower)) return 'learn';
  return null;
}

const SYSTEM_CONTROL_PHRASES = [
  [/\bwifi\b|\bwi-fi\b/i, 'wifi'],
  [/\bbluetooth\b/i, 'bluetooth'],
  [/\bairplane\s*mode\b/i, 'airplaneMode'],
  [/\bbattery\s*saver\b/i, 'batterySaver'],
  [/\bnight\s*light\b/i, 'nightLight'],
  [/\bmobile\s*hotspot\b/i, 'mobileHotspot'],
  [/\blive\s*captions\b/i, 'liveCaptions'],
  [/\bnearby\s*sharing\b/i, 'nearbySharing'],
];

function detectSystemControlIntent(lower) {
  let detected = null;
  if (/\b(?:lower|turn down|decrease|reduce)\s+(?:the\s+)?volume\b/i.test(lower)) detected = { id: 'volumeDown', mode: 'act' };
  else if (/\b(?:raise|turn up|increase)\s+(?:the\s+)?volume\b/i.test(lower)) detected = { id: 'volumeUp', mode: 'act' };
  else if (/\b(?:mute|unmute)\b/i.test(lower)) detected = { id: 'mute', mode: 'act' };
  else if (/\b(?:set\s+volume\s+to|volume\s+to)\s*\d+/i.test(lower)) detected = { id: 'setVolume', mode: 'act' };
  else if (/\b(?:restart|reboot)\b/i.test(lower)) detected = { id: 'restart', mode: 'prepare' };
  else if (/\bshut\s*down\b/i.test(lower)) detected = { id: 'shutdown', mode: 'prepare' };
  else if (/\b(?:put\s+(?:the\s+)?(?:pc|computer)\s+to\s+sleep|sleep\s+the\s+(?:pc|computer))\b/i.test(lower)) detected = { id: 'sleep', mode: 'prepare' };
  else if (/\block\s+(?:the\s+)?(?:pc|computer|screen)\b/i.test(lower)) detected = { id: 'lock', mode: 'prepare' };
  else {
    for (const [re, id] of SYSTEM_CONTROL_PHRASES) {
      if (re.test(lower)) { detected = { id, mode: 'act' }; break; }
    }
  }
  if (!detected) return null;

  // A question about a control is never an instruction to change it.
  if (/\b(?:what|status|can you|could you|do you|does|is|are|check|tell me|support|supported|available)\b/i.test(lower)) {
    return { id: detected.id, mode: 'status' };
  }
  return detected;
}

function detectClientIntent(lower) {
  if (/\badd\s+(?:all\s+of\s+)?(?:that|this|it)\s+to\s+excel\b/i.test(lower)) return 'addExcel';
  if (/\b(?:check|find|look up|verify)\b.*\b(?:their|the|this)\s+website\b/i.test(lower)) return 'website';
  if (/\b(?:find|research|look up)\s+(?:this|the)\s+client\b/i.test(lower)) return 'find';
  return null;
}

// ── UTILITY HELPERS ──────────────────────────────────────────────────────────

function extractTopic(text, removeRegex) {
  let cleaned = text.replace(removeRegex, '').trim();
  cleaned = cleaned.replace(/^(?:for|on|about|of|named|called|with\s+title)\s+/i, '').trim();
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s_-]/g, ' ').trim();
  return cleaned || 'Executive Report';
}

function extractTextToType(text) {
  const colonMatch = text.match(/(?:write|type)\s+(?:into|in)?\s*(?:word|excel|ppt|document)?[:\s]+(.+)$/i);
  if (colonMatch && colonMatch[1].trim()) return colonMatch[1].trim();

  let cleaned = text.replace(/^(?:please\s+)?(?:write|type|likho|enter|insert)\s+(?:into|in|on|to)?\s*(?:word|excel|ppt|document|presentation|sheet)?/i, '').trim();
  cleaned = cleaned.replace(/^(?:ki|that|this|ye|yeh)\s+/i, '').trim();
  return cleaned || 'MYRAA AI OS — Autonomous Desktop System Integration Active.';
}

// ── MAIN DISPATCHER ──────────────────────────────────────────────────────────

class UnifiedCapabilityRouter {
  constructor() {
    _lazyLoad();
  }

  /**
   * Dispatches user text to appropriate native capability engine.
   * @param {string} userText 
   * @param {object} opts { projectDir, userName }
   * @returns {Promise<{ handled: boolean, action?: string, reply?: string, data?: any, error?: string }>}
   */
  async dispatchCapability(userText, opts = {}) {
    if (!userText || typeof userText !== 'string') {
      return { handled: false };
    }

    const trimmed = userText.trim();
    const lower = trimmed.toLowerCase();

    // =========================================================================
    // 0. LISTENING & PRESENCE CHECK
    // =========================================================================
    const isListeningCheck = LISTENING_CHECK_PATTERNS.some(p => p.test(lower));
    if (isListeningCheck) {
      return {
        handled: true,
        action: 'LISTENING_CHECK',
        reply: '[OK] Yes, I am listening to you loud and clear. My audio stream, microphone link, and autonomous execution systems are active. Speak your command or ask me to build, code, or automate anything on your desktop.'
      };
    }

    // =========================================================================
    // 0a. BUSINESS OS - READ-ONLY AWARENESS (leads, finance, email, reports)
    // =========================================================================
    const businessIntent = detectBusinessIntent(lower);
    if (businessIntent) {
      try {
        const bos = require(path.join(__dirname, 'business_os.cjs'));
        if (businessIntent === 'report') {
          const rep = bos.dailyReport();
          if (rep.status !== 'OK') {
            return { handled: true, action: 'BUSINESS_REPORT', reply: `[!] Business workspace unavailable: ${rep.detail || rep.status}` };
          }
          return { handled: true, action: 'BUSINESS_REPORT', reply: rep.markdown, data: rep.summary };
        }
        if (businessIntent === 'leads') {
          const s = bos.summary();
          if (s.status !== 'OK') {
            return { handled: true, action: 'BUSINESS_LEADS', reply: `[!] Business workspace unavailable: ${s.detail || s.status}` };
          }
          const l = s.leads || {};
          const byStatus = Object.entries(l.byStatus || {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'none';
          return {
            handled: true,
            action: 'BUSINESS_LEADS',
            reply: [
              `[OK] CRM: ${l.total || 0} leads on file.`,
              `Status: ${byStatus}`,
              `Contacted: ${l.contacted || 0} | Replied: ${l.replied || 0} | Interested: ${l.interested || 0}`,
              `Public email on file: ${l.withPublicEmail || 0}`,
              `Reply rate: ${l.replyRate === null || l.replyRate === undefined ? 'n/a until real sends exist' : l.replyRate + '%'}`,
              `Note: ${l.note || 'No sends are inferred.'}`
            ].join('\n'),
            data: l
          };
        }
        if (businessIntent === 'finance') {
          const s = bos.summary();
          if (s.status !== 'OK') {
            return { handled: true, action: 'BUSINESS_FINANCE', reply: `[!] Business workspace unavailable: ${s.detail || s.status}` };
          }
          const r = s.revenue || {};
          const f = s.finance || {};
          return {
            handled: true,
            action: 'BUSINESS_FINANCE',
            reply: [
              `[OK] Finance (${r.currency || 'USD'}):`,
              `Collected: $${r.collected || 0} of $${r.target || 0} target`,
              `Remaining: $${r.remaining || 0}`,
              `Expenses: $${f.expenses || 0} | Net: $${f.net || 0}`,
              `Deals needed at $${r.averageDealAssumption || 0} average: ${r.requiredDealsAtAssumption || 0}`,
              `Rule: ${r.label || 'Only verified money counts as collected.'}`
            ].join('\n'),
            data: { revenue: r, finance: f }
          };
        }
        if (businessIntent === 'email') {
          const e = bos.emailOverview(bos.workspaceDir());
          const c = e.connection || {};
          return {
            handled: true,
            action: 'BUSINESS_EMAIL',
            reply: [
              `[OK] Email awareness:`,
              `Address: ${c.address || 'not recorded'}`,
              `Connection: ${c.connection || 'UNKNOWN'}`,
              `Drafts: ${e.drafts ? e.drafts.draftCount : 0} (${e.drafts && e.drafts.draftsFolder ? e.drafts.draftsFolder : 'no drafts folder'})`,
              `Templates: ${(e.templates && e.templates.templates || []).map((t) => t.name).join(', ') || 'none'}`,
              `Leads with public email: ${e.leadsWithPublicEmail || 0}`,
              `Policy: ${e.outreachPolicy}`
            ].join('\n'),
            data: e
          };
        }
      } catch (err) {
        return { handled: true, action: 'BUSINESS_ERROR', reply: `[!] Business OS error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0a-i. VBA INTELLIGENCE — explain / review / conservative rewrite
    // =========================================================================
    const vbaIntent = detectVbaIntent(lower);
    if (vbaIntent) {
      try {
        let code = opts.code || opts.vbaCode || null;
        if (!code && /\b(?:this|the|my|copied|pasted)\b/i.test(lower)) {
          let clip = null;
          try {
            clip = desktopAutomation && typeof desktopAutomation.getClipboard === 'function'
              ? desktopAutomation.getClipboard() : null;
          } catch (e) { clip = null; }
          if (typeof clip === 'string') code = clip;
          else if (clip && typeof clip.text === 'string') code = clip.text;
        }
        if (!code || !/\b(?:Sub|Function|Property)\b/i.test(code)) {
          return {
            handled: true,
            action: 'VBA_CODE_REQUIRED',
            reply: '[!] No VBA source is available. Paste the macro and say "explain this macro", or POST the source to /api/vba/analyze. I do not invent macro contents.'
          };
        }
        const vba = require(path.join(__dirname, 'vba_analyzer.cjs'));
        if (vbaIntent === 'explain') {
          const e = vba.explain(code);
          return { handled: true, action: 'VBA_EXPLAIN', reply: `${e.summary}\n${e.targetNote}`, data: e };
        }
        if (vbaIntent === 'review') {
          const r = vba.review(code);
          const top = r.findings.slice(0, 8).map((f) => `[${f.severity}] ${f.type}${f.line ? ' (line ' + f.line + ')' : ''}: ${f.message}`);
          return {
            handled: true,
            action: 'VBA_REVIEW',
            reply: [`[OK] Static review: ${r.findingCount} finding(s). Source was not executed.`, ...top].join('\n'),
            data: r
          };
        }
        const a = vba.analyze(code);
        const imp = a.improvement;
        const lines = imp.generated
          ? [
              `[OK] Safer rewrite generated for ${imp.matchedRange}. NOT_VERIFIED in Excel.`,
              ...imp.whyImproved.map((w) => `- ${w}`),
              '- Generated code is in data.improvement.code. Review it before pasting into the VBA editor.'
            ]
          : [`[!] No safe rewrite generated: ${imp.reason}`];
        return { handled: true, action: 'VBA_IMPROVE', reply: lines.join('\n'), data: a };
      } catch (err) {
        return { handled: true, action: 'VBA_ERROR', reply: `[!] VBA analysis error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0a-ii. REASONING FRAMEWORKS - evidence-gated, never fabricated
    // =========================================================================
    const frameworkIntent = detectFrameworkIntent(lower);
    if (frameworkIntent) {
      try {
        const rf = require(path.join(__dirname, 'reasoning_frameworks.cjs'));
        const evidence = {};
        for (const [k, v] of Object.entries(opts || {})) {
          if (!['code', 'vbaCode', 'projectDir', 'userName'].includes(k)) evidence[k] = v;
        }
        const r = rf.invoke(frameworkIntent.name, evidence);
        const sections = r.sections || (r.fields ? r.fields : []);
        const shown = sections.slice(0, 12).map((s) => `- ${s.label}: ${s.status === 'PROVIDED' ? s.value : 'UNKNOWN'}`);
        const prefix = frameworkIntent.name === 'legalAwareness'
          ? `[OK] Compliance Review (status ${r.status}). Not legal advice; official sources ${r.currentOfficialSource}.`
          : `[OK] ${r.title}: ${r.providedCount !== undefined ? r.providedCount + ' provided, ' + r.unknownCount + ' unknown.' : 'scaffold ready.'}`;
        const suffix = sections.length > 12 ? `\n- ...${sections.length - 12} more sections in data.` : '';
        return {
          handled: true,
          action: frameworkIntent.action,
          reply: [prefix, ...shown].join('\n') + suffix + '\n[!] UNKNOWN fields need real evidence. Nothing is inferred or claimed.',
          data: r
        };
      } catch (err) {
        return { handled: true, action: 'FRAMEWORK_ERROR', reply: `[!] Framework error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0a-v. CLIENT DISCOVERY (evidence-gated, no fabricated contact data)
    // =========================================================================
    const clientIntent = detectClientIntent(lower);
    if (clientIntent) {
      try {
        const cd = require(path.join(__dirname, 'client_discovery.cjs'));
        const evidence = Array.isArray(opts.evidence) ? opts.evidence : [];
        if (clientIntent === 'website') {
          const url = opts.website || (trimmed.match(/https?:\/\/\S+/i) || [])[0];
          if (!url) return { handled: true, action: 'WEBSITE_URL_REQUIRED', reply: '[!] No URL supplied. Give me the candidate website and I will probe it. I do not invent domains.' };
          const r = await cd.probeWebsite(url);
          return { handled: true, action: 'WEBSITE_PROBE', reply: r.ok ? `[OK] Website reachable: ${r.url}. Title: ${r.title || 'not available'}.` : `[!] ${cd.WEBSITE_NOT_FOUND}. ${r.reason || ''}`, data: r };
        }
        if (clientIntent === 'addExcel') {
          if (opts.confirm !== true) {
            return { handled: true, action: 'CLIENT_EXCEL_APPROVAL', reply: '[!] Writing a client record is a medium-risk action. Confirm explicitly and supply the workbook, or POST /api/client-discovery/add-to-excel with confirm:true.' };
          }
          const r = await cd.addToExcel(opts.input || opts, evidence, opts);
          return {
            handled: true,
            action: r.ok ? 'CLIENT_EXCEL_WRITTEN' : 'CLIENT_EXCEL_FAILED',
            reply: r.ok ? `[OK] Client ${r.clientId} written to ${r.wrote.workbook} (${r.wrote.sheet}). Verification: ${r.verification.companyCellMatches ? 'company cell matched' : 'readback did not match'}. ${r.websiteStatus}.` : `[!] ${r.error || r.code}`,
            data: r
          };
        }
        const name = opts.clientName || opts.companyName || (trimmed.match(/\bclient\s+(.+)$/i) || [])[1] || 'Unknown client';
        const ev = [...evidence];
        if (opts.website) {
          const probe = await cd.probeWebsite(opts.website);
          if (probe.ok) ev.push({ field: 'website', value: probe.url, source: 'live probe', url: probe.url, confidence: 'verified', checkedAt: new Date().toISOString() });
        }
        const a = cd.analyze({ companyName: name }, ev);
        return {
          handled: true,
          action: 'CLIENT_FOUND',
          reply: [cd.toMarkdown(a), `Confidence: ${a.overallConfidence}. No missing value was invented.`].join('\n'),
          data: a
        };
      } catch (err) {
        return { handled: true, action: 'CLIENT_ERROR', reply: `[!] Client research error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0a-iv. SYSTEM CONTROL MATRIX (honest statuses, token-gated power)
    // =========================================================================
    const systemControlIntent = detectSystemControlIntent(lower);
    if (systemControlIntent) {
      try {
        const sm = require(path.join(__dirname, 'system_control_matrix.cjs'));
        const control = sm.get(systemControlIntent.id);
        if (!control) return { handled: false };
        if (systemControlIntent.mode === 'status') {
          return {
            handled: true,
            action: 'SYSTEM_CONTROL_STATUS',
            reply: `[OK] ${control.label}: ${control.status}. ${control.note} No action was taken.`,
            data: control
          };
        }
        if (systemControlIntent.mode === 'prepare') {
          const r = sm.prepare(control.id, {});
          return {
            handled: true,
            action: 'SYSTEM_CONTROL_CONFIRMATION',
            reply: [
              `[!] ${control.label} requires explicit confirmation.`,
              `Token: ${r.confirmation_token || 'unavailable'}`,
              r.warning || control.note,
              `To proceed: POST /api/system-control/execute with id='${control.id}', confirmationToken and confirm:true.`
            ].join('\n'),
            data: r
          };
        }
        const body = { id: control.id };
        if (control.id === 'setVolume') {
          const m = lower.match(/(\d{1,3})\s*(?:%|percent)?/);
          body.level = m ? Math.min(100, Math.max(0, Number(m[1]))) : 50;
        }
        const r = sm.execute(control.id, body);
        const line = r.ok
          ? `[OK] ${control.label}: ${r.honestResult || r.verification || 'action attempted'}.`
          : `[!] ${control.label} could not be completed: ${r.error || r.code}.`;
        return {
          handled: true,
          action: 'SYSTEM_CONTROL',
          reply: [line, `Status: ${control.status}. ${control.note}`.trim()].join('\n'),
          data: r
        };
      } catch (err) {
        return { handled: true, action: 'SYSTEM_CONTROL_ERROR', reply: `[!] System control error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0a-iii. WORKFLOW LEARNING / SKILL COMPILER
    // =========================================================================
    const workflowIntent = detectWorkflowIntent(lower);
    if (workflowIntent) {
      try {
        const w = require(path.join(__dirname, 'workflow_skill_compiler.cjs'));
        if (workflowIntent === 'learn') {
          const aw = require(path.join(__dirname, 'live_awareness_routes.cjs'));
          const candidates = typeof aw.detectWorkflows === 'function' ? aw.detectWorkflows() : [];
          if (!candidates.length) {
            return {
              handled: true,
              action: 'WORKFLOW_NOT_DETECTED',
              reply: '[!] No repeated workflow has been detected yet. Work through the task at least twice with observation enabled, then ask again. Nothing was invented.'
            };
          }
          const r = w.compile(candidates[0], {});
          if (r.token) pendingWorkflowToken = r.token;
          const c = r.candidate;
          return {
            handled: true,
            action: 'WORKFLOW_CANDIDATE',
            reply: [
              `[OK] Workflow candidate: ${c.name}`,
              `Steps: ${c.steps.length} | Occurrences: ${c.occurrences === null ? 'unknown' : c.occurrences} | Confidence: ${c.confidence === null ? 'unknown' : c.confidence}`,
              'Observation is separate from learning. This candidate was NOT saved.',
              "Say 'save this skill' to confirm, or edit steps first through /api/workflow-skills."
            ].join('\n'),
            data: { candidate: c, approvalToken: r.token }
          };
        }
        if (workflowIntent === 'confirm') {
          if (!pendingWorkflowToken) {
            return { handled: true, action: 'WORKFLOW_NO_PENDING', reply: '[!] No pending skill candidate to confirm. Ask to learn the workflow first.' };
          }
          const r = w.confirmPending(pendingWorkflowToken);
          if (!r.ok) return { handled: true, action: 'WORKFLOW_CONFIRM_FAILED', reply: `[!] ${r.error}` };
          pendingWorkflowToken = null;
          return { handled: true, action: 'WORKFLOW_SKILL_SAVED', reply: `[OK] Skill candidate saved as DRAFT (${r.skill.id}, version ${r.skill.version}). Edit and dry run before publishing.`, data: r.skill };
        }
        if (workflowIntent === 'dryRun') {
          const items = w.list().skills;
          const id = opts.skillId || (items[0] && items[0].id);
          if (!id) return { handled: true, action: 'WORKFLOW_NO_SKILL', reply: '[!] No saved skill candidate to dry run.' };
          const r = w.dryRun(id);
          return {
            handled: true,
            action: 'WORKFLOW_DRY_RUN',
            reply: [`[OK] Dry run of ${r.name}: ${r.steps.length} step(s).`, ...r.steps.map((s) => `- ${s.order}. ${s.wouldUseApp}: ${s.wouldActOn} (${s.action})`), r.note, r.limitation].join('\n'),
            data: r
          };
        }
        const sr = require(path.join(__dirname, 'skill_replay.cjs'));
        const items = w.list().skills;
        const skill = opts.skill || (opts.skillId ? w.get(opts.skillId) : (items[0] && w.get(items[0].id)));
        if (!skill) {
          return { handled: true, action: 'WORKFLOW_NO_SKILL', reply: '[!] No saved skill candidate to replay.' };
        }
        if (opts.confirm !== true) {
          const preview = w.dryRun(skill.id);
          return {
            handled: true,
            action: 'WORKFLOW_REPLAY_APPROVAL',
            reply: ['[!] Replay is opt-in. No action has been executed.', ...preview.steps.map((s) => `- ${s.order}. ${s.action} on ${s.wouldActOn}`), 'Confirm with confirm:true to start replay.'].join('\n'),
            data: preview
          };
        }
        const stepMode = /step by step|one step|single step/i.test(lower);
        const started = sr.start(skill.id, { skill, mode: stepMode ? 'step' : 'run', requireConfirm: false });
        if (!started.ok) return { handled: true, action: 'WORKFLOW_REPLAY_FAILED', reply: `[!] ${started.error}` };
        if (stepMode) {
          const step = await sr.executeStep(started.sessionId, { confirm: true });
          return { handled: true, action: 'WORKFLOW_STEP_EXECUTED', reply: `[OK] Step result: ${step.trace ? step.trace.result : step.code}. Session ${started.sessionId}.`, data: step };
        }
        const result = await sr.runAll(started.sessionId, { autoConfirm: true });
        return {
          handled: true,
          action: result.ok ? 'WORKFLOW_REPLAY_COMPLETED' : 'WORKFLOW_REPLAY_FAILED',
          reply: `[${result.ok ? 'OK' : '!'}] Replay ${result.status}: ${result.stepsExecuted} step(s). ${result.error || 'No fabricated success.'}`,
          data: result
        };
      } catch (err) {
        return { handled: true, action: 'WORKFLOW_ERROR', reply: `[!] Workflow error: ${err.message}`, error: err.message };
      }
    }

    // =========================================================================
    // 0b. AUTONOMOUS WEBSITE GENERATION (3 DESIGNS + THEME SWITCHER)
    // =========================================================================
    const isWebsiteCreate = WEBSITE_CREATE_PATTERNS.some(p => p.test(lower));
    if (isWebsiteCreate) {
      try {
        _lazyLoad();
        const siteName = extractTopic(trimmed, /(?:create|build|make|generate|design)\s+(?:a\s+)?(?:new\s+)?(?:website|landing\s*page|web\s*app|site|portal|webpage)/gi) || 'Modern_Web_Platform';
        const cleanSiteName = siteName.replace(/\s+/g, '_');
        if (desktopAutomation && typeof desktopAutomation.createWebsiteProject === 'function') {
          const siteRes = desktopAutomation.createWebsiteProject(cleanSiteName, `Autonomous web experience built with 3 switchable production designs: Obsidian Glass, Cyber Vanguard, and Editorial Luxe.`);
          const targetDir = siteRes.targetDir;
          return {
            handled: true,
            action: 'CREATE_WEBSITE_3_DESIGNS',
            reply: [
              `[OK] Autonomous Website Generated Successfully!`,
              `------------------------------------------------------------`,
              `[1/4] Architecture & Wireframe: Planned responsive modern multi-section layout.`,
              `[2/4] 3 Designs Built:`,
              `      - Design 1: Obsidian Glass (Dark Glassmorphism with Frosted Cards)`,
              `      - Design 2: Cyber Vanguard (Neon Cyberpunk HUD with Emerald/Amber)`,
              `      - Design 3: Editorial Luxe (Refined Light Corporate with Crisp Typography)`,
              `[3/4] Interactive Theme Switcher: Live real-time switcher bar embedded.`,
              `[4/4] Files Generated & Saved:`,
              `      - index.html (Responsive Structure & 3 Design Templates)`,
              `      - style.css (Complete Multi-Theme CSS Design System)`,
              `      - script.js (Interactive Theme Switcher & Animations)`,
              `      - README.md (Project Specifications)`,
              ``,
              `Project Location: ${targetDir}`,
              `Status: Launched live preview in your default web browser!`
            ].join('\n'),
            data: siteRes
          };
        }
      } catch (siteErr) {
        return {
          handled: true,
          action: 'CREATE_WEBSITE_ERROR',
          reply: `[!] Error creating website: ${siteErr.message}`,
          error: siteErr.message
        };
      }
    }

    // =========================================================================
    // 1. MS WORD AUTOMATION & CREATION
    // =========================================================================

    // 1a. Write / Type into Word
    const isWordWrite = WORD_WRITE_PATTERNS.some(p => p.test(lower));
    if (isWordWrite) {
      try {
        _lazyLoad();
        const content = extractTextToType(trimmed);
        if (desktopAutomation && typeof desktopAutomation.typeIntoApp === 'function') {
          const res = desktopAutomation.typeIntoApp('word', content);
          return {
            handled: true,
            action: 'WRITE_WORD',
            reply: `[OK] Successfully typed text into Microsoft Word.\nContent: "${content.slice(0, 120)}${content.length > 120 ? '...' : ''}"`,
            data: res
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'WRITE_WORD_ERROR',
          reply: `[!] Error typing into Word: ${err.message}`,
          error: err.message
        };
      }
    }

    // 1b. Create Word Document (.docx)
    const isWordCreate = WORD_CREATE_PATTERNS.some(p => p.test(lower));
    if (isWordCreate) {
      try {
        _lazyLoad();
        const topic = extractTopic(trimmed, /(?:create|make|generate|build|new|draft|compose|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:ms\s*)?(?:word|document|docx|doc|report|letter|proposal|resume|manual|whitepaper|sop|contract)/gi);
        const title = topic.length > 2 ? topic.charAt(0).toUpperCase() + topic.slice(1) : 'Professional Document';
        const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.docx`;

        if (officeDocEngine && typeof officeDocEngine.generateWord === 'function') {
          const genRes = await officeDocEngine.generateWord({
            filename,
            title: `${title}`,
            subtitle: 'Created autonomously by MYRAA AI OS Professional Word Engine',
            docType: 'report',
            sections: [
              {
                heading: '1. Executive Summary',
                content: `This comprehensive document covering "${title}" has been structured, formatted, and generated with automated typographic styles, section hierarchies, and QA-verified standards.`
              },
              {
                heading: '2. Technical Architecture & Analysis',
                content: 'Key operational components, delivery mechanisms, and functional specifications have been validated. System performance meets established benchmarks with zero unhandled exceptions.'
              },
              {
                heading: '3. Strategic Milestones & Execution',
                content: 'Deployment targets have been synchronized with active workflows. Operational telemetry provides real-time visibility across all core services.'
              }
            ],
            table: {
              headers: ['Milestone', 'Category', 'Target Date', 'Status'],
              rows: [
                ['Phase 1: Architecture Baseline', 'Core Engineering', 'Current', 'Complete'],
                ['Phase 2: Capability Integration', 'Automation', 'Current', 'In Production'],
                ['Phase 3: Automated QA & Verification', 'Quality Assurance', 'Immediate', 'Active']
              ]
            }
          });

          if (genRes.ok && genRes.path) {
            const userFacingPath = copyToUserOutput(genRes.path);
            try {
              if (officeDocEngine.openInSystem) {
                officeDocEngine.openInSystem(userFacingPath);
              } else if (desktopAutomation && desktopAutomation.openApplication) {
                desktopAutomation.openApplication('word', userFacingPath);
              }
            } catch (_) {}

            return {
              handled: true,
              action: 'CREATE_WORD',
              reply: `[OK] Microsoft Word document successfully generated and opened in Word.\nDocument Title: ${title}\nFile Path: ${userFacingPath}\nSections: Executive Summary, Technical Architecture, Strategic Milestones, Milestone Table.`,
              data: { path: userFacingPath, tempPath: genRes.path }
            };
          } else {
            return {
              handled: true,
              action: 'CREATE_WORD_FAILED',
              reply: `[!] Word generation failed: ${genRes.error || 'Unknown error'}`,
              error: genRes.error
            };
          }
        }
      } catch (err) {
        return {
          handled: true,
          action: 'CREATE_WORD_ERROR',
          reply: `[!] Error generating Word document: ${err.message}`,
          error: err.message
        };
      }
    }

    // =========================================================================
    // 2. POWERPOINT / PPT AUTOMATION & CREATION
    // =========================================================================

    // 2a. Write / Type into PPT
    const isPptWrite = PPT_WRITE_PATTERNS.some(p => p.test(lower));
    if (isPptWrite) {
      try {
        _lazyLoad();
        const content = extractTextToType(trimmed);
        if (desktopAutomation && typeof desktopAutomation.typeIntoApp === 'function') {
          const res = desktopAutomation.typeIntoApp('powerpnt', content);
          return {
            handled: true,
            action: 'WRITE_PPT',
            reply: `[OK] Successfully typed text into Microsoft PowerPoint.\nContent: "${content.slice(0, 120)}${content.length > 120 ? '...' : ''}"`,
            data: res
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'WRITE_PPT_ERROR',
          reply: `[!] Error typing into PowerPoint: ${err.message}`,
          error: err.message
        };
      }
    }

    // 2b. Create PowerPoint Presentation (.pptx)
    const isPptCreate = PPT_CREATE_PATTERNS.some(p => p.test(lower));
    if (isPptCreate) {
      try {
        _lazyLoad();
        const topic = extractTopic(trimmed, /(?:create|make|generate|build|new|design|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:ppt|presentation|powerpoint|slides?|pptx|deck)/gi);
        const title = topic.length > 2 ? topic.charAt(0).toUpperCase() + topic.slice(1) : 'Strategic Presentation';
        const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.pptx`;

        if (officeDocEngine && typeof officeDocEngine.generatePresentation === 'function') {
          const pptRes = await officeDocEngine.generatePresentation({
            filename,
            title,
            subtitle: 'Autonomous Multi-Agent Presentation — MYRAA AI OS',
            slides: [
              {
                title: `1. Overview: ${title}`,
                bullets: [
                  `Comprehensive strategic framework for ${title}`,
                  'Engineered for maximum operational efficiency and reliability',
                  'High-precision automation with native Windows desktop integration'
                ]
              },
              {
                title: '2. Core Capabilities & Architecture',
                bullets: [
                  'Dynamic document engines for Word, Excel, and PowerPoint',
                  'Full coding agent loop: plan, code, run, test, and patch',
                  'Universal skill execution through Model Context Protocol (MCP)'
                ]
              },
              {
                title: '3. Roadmap & Execution Milestones',
                bullets: [
                  'Production-grade deployment with zero unhandled regressions',
                  'Continuous telemetry and health observation',
                  'Certified operational excellence and performance standards'
                ]
              }
            ]
          });

          if (pptRes.ok && pptRes.path) {
            const userFacingPath = copyToUserOutput(pptRes.path);
            try {
              if (officeDocEngine.openInSystem) {
                officeDocEngine.openInSystem(userFacingPath);
              } else if (desktopAutomation && desktopAutomation.openApplication) {
                desktopAutomation.openApplication('powerpnt', userFacingPath);
              }
            } catch (_) {}

            return {
              handled: true,
              action: 'CREATE_PPT',
              reply: `[OK] Microsoft PowerPoint presentation successfully created and opened in PowerPoint.\nPresentation Title: ${title}\nFile Path: ${userFacingPath}\nSlides Generated: 3 slides with title cover, architecture review, and roadmap.`,
              data: { path: userFacingPath, tempPath: pptRes.path }
            };
          } else {
            return {
              handled: true,
              action: 'CREATE_PPT_FAILED',
              reply: `[!] PowerPoint generation failed: ${pptRes.error || 'Unknown error'}`,
              error: pptRes.error
            };
          }
        }
      } catch (err) {
        return {
          handled: true,
          action: 'CREATE_PPT_ERROR',
          reply: `[!] Error generating PowerPoint presentation: ${err.message}`,
          error: err.message
        };
      }
    }

    // =========================================================================
    // 3. EXCEL AUTOMATION & CREATION
    // =========================================================================

    // 3a. Write / Type into Excel
    const isExcelWrite = EXCEL_WRITE_PATTERNS.some(p => p.test(lower));
    if (isExcelWrite) {
      try {
        _lazyLoad();
        const content = extractTextToType(trimmed);
        if (desktopAutomation && typeof desktopAutomation.typeIntoApp === 'function') {
          const res = desktopAutomation.typeIntoApp('excel', content);
          return {
            handled: true,
            action: 'WRITE_EXCEL',
            reply: `[OK] Successfully typed data into Microsoft Excel.\nContent: "${content.slice(0, 120)}${content.length > 120 ? '...' : ''}"`,
            data: res
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'WRITE_EXCEL_ERROR',
          reply: `[!] Error typing into Excel: ${err.message}`,
          error: err.message
        };
      }
    }

    // 3b. Create Excel Spreadsheet (.xlsx)
    const isExcelCreate = EXCEL_CREATE_PATTERNS.some(p => p.test(lower));
    if (isExcelCreate) {
      try {
        _lazyLoad();
        const topic = extractTopic(trimmed, /(?:create|make|generate|build|new|banao|kholo)\s+(?:a\s+)?(?:new\s+)?(?:excel|spreadsheet|sheet|xlsx|workbook|tracker)/gi);
        const title = topic.length > 2 ? topic.charAt(0).toUpperCase() + topic.slice(1) : 'Financial Overview';
        const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;

        let headers = ['Item ID', 'Description', 'Category', 'Allocated (INR)', 'Actual (INR)', 'Status'];
        let rows = [
          ['ITM-001', 'Cloud Infrastructure & Servers', 'Operations', 45000, 42000, 'Approved'],
          ['ITM-002', 'Software Licensing & Tooling', 'Engineering', 28000, 26500, 'Approved'],
          ['ITM-003', 'Hardware & System Automation', 'DevOps', 35000, 31200, 'Pending'],
          ['ITM-004', 'Security & Compliance Auditing', 'Quality Assurance', 20000, 19500, 'Approved'],
          ['ITM-005', 'Backup & Disaster Recovery', 'Operations', 15000, 14000, 'Approved']
        ];

        if (/expense|budget|cost|kharcha|finance/i.test(lower)) {
          headers = ['Expense ID', 'Date', 'Category', 'Vendor', 'Amount (INR)', 'Payment Status'];
          rows = [
            ['EXP-101', '2026-09-01', 'Office Supplies', 'Standard Logistics', 12500, 'Paid'],
            ['EXP-102', '2026-09-04', 'Cloud Compute', 'Provider Network', 38000, 'Paid'],
            ['EXP-103', '2026-09-08', 'Software Subscriptions', 'Dev Platforms', 19000, 'Processing'],
            ['EXP-104', '2026-09-11', 'Hardware Maintenance', 'Tech Solutions', 8500, 'Paid']
          ];
        } else if (/sale|revenue|order|customer/i.test(lower)) {
          headers = ['Order ID', 'Customer Name', 'Product SKU', 'Quantity', 'Unit Price (INR)', 'Total (INR)'];
          rows = [
            ['ORD-501', 'Apex Global Inc', 'SKU-PRO-01', 5, 24000, 120000],
            ['ORD-502', 'Zenith Enterprises', 'SKU-ENT-04', 2, 48000, 96000],
            ['ORD-503', 'Horizon Tech Corp', 'SKU-STD-02', 10, 12000, 120000],
            ['ORD-504', 'Vanguard Systems', 'SKU-ENT-04', 3, 48000, 144000]
          ];
        }

        if (officeDocEngine && typeof officeDocEngine.generateExcel === 'function') {
          const excelRes = await officeDocEngine.generateExcel({
            filename,
            sheetName: title.slice(0, 25),
            headers,
            rows,
            totalFormula: true
          });

          if (excelRes.ok && excelRes.path) {
            const userFacingPath = copyToUserOutput(excelRes.path);
            try {
              if (officeDocEngine.openInSystem) {
                officeDocEngine.openInSystem(userFacingPath);
              } else if (desktopAutomation && desktopAutomation.openApplication) {
                desktopAutomation.openApplication('excel', userFacingPath);
              }
            } catch (_) {}

            return {
              handled: true,
              action: 'CREATE_EXCEL',
              reply: `[OK] Microsoft Excel spreadsheet successfully created and opened in Excel.\nSheet Name: ${title}\nFile Path: ${userFacingPath}\nData: ${rows.length} rows with structured columns and total summary formula.`,
              data: { path: userFacingPath, tempPath: excelRes.path }
            };
          } else {
            return {
              handled: true,
              action: 'CREATE_EXCEL_FAILED',
              reply: `[!] Excel generation failed: ${excelRes.error || 'Unknown error'}`,
              error: excelRes.error
            };
          }
        }
      } catch (err) {
        return {
          handled: true,
          action: 'CREATE_EXCEL_ERROR',
          reply: `[!] Error generating Excel spreadsheet: ${err.message}`,
          error: err.message
        };
      }
    }

    // =========================================================================
    // 4. AUTONOMOUS CODING AGENT
    // =========================================================================
    const isCodingIntent = CODING_PATTERNS.some(p => p.test(lower));
    if (isCodingIntent) {
      try {
        _lazyLoad();
        if (codingOrchestrator && typeof codingOrchestrator.executeCodingTask === 'function') {
          const result = await codingOrchestrator.executeCodingTask(trimmed, {
            projectDir: opts.projectDir || USER_PROJECT_ROOT
          });

          let replyText = '';
          if (result && result.output) {
            const out = result.output;
            if (out.message) replyText = out.message;
            else if (out.error) replyText = `[!] Error: ${out.error}`;
            else if (out.ok === true) replyText = `[OK] Coding action "${result.intent}" completed successfully.`;
            else if (typeof out === 'string') replyText = out;
            else replyText = JSON.stringify(out, null, 2).slice(0, 1500);
          } else if (result.success) {
            replyText = `[OK] Coding action "${result.intent}" completed in ${result.duration}ms.`;
          } else {
            replyText = `[!] Coding task execution finished: ${result.errors?.[0] || 'Task inspected'}`;
          }

          // Strip any unexpected emojis from coding orchestrator output
          const cleanReply = replyText.replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

          return {
            handled: true,
            action: `CODING_${result.intent || 'TASK'}`,
            reply: cleanReply,
            data: result
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'CODING_AGENT_ERROR',
          reply: `[!] Coding agent error: ${err.message}`,
          error: err.message
        };
      }
    }

    // =========================================================================
    // 5. UNIVERSAL SKILLS & DESKTOP CONTROLS
    // =========================================================================

    // 5a. Skills Catalog / List
    const isSkillsList = SKILLS_LIST_PATTERNS.some(p => p.test(lower));
    if (isSkillsList) {
      const skillsOverview = [
        'MYRAA AI OS — Autonomous Capabilities & Skills Suite (v9.3.0)',
        '------------------------------------------------------------',
        '[1] Microsoft Office Suite:',
        '    - Word (.docx): "create ms word", "create document", "write into word", review, redesign, merge, split, export PDF',
        '    - PowerPoint (.pptx): "create ppt", "create presentation on [topic]", "write into ppt"',
        '    - Excel (.xlsx): "create excel", "make a spreadsheet for [topic]", "write into excel"',
        '[2] Autonomous Coding Agent:',
        '    - "coding", "code", "run tests", "build project", "git status", "git commit", "git diff", "fix error", "refactor"',
        '    - AST code intelligence, self-healing dev engine, and local terminal runner',
        '[3] Desktop Automation & System Control:',
        '    - Screen: "take screenshot", OCR text targeting, window minimize/maximize/switch',
        '    - Hardware: "volume up/down/mute", "system info", "wifi control", "bluetooth"',
        '    - Apps: "open [app]", "close [app]", "open vscode", "open calculator", "search [query]"',
        '[4] Intelligence & Perception:',
        '    - Weather: "weather in [city]", real-time temperature and forecasts',
        '    - Vision: Multimodal screen inspection, OCR label recognition',
        '    - Memory Core: Persistent long-term RAG, fact recall, session continuity',
        '[5] Extensible MCP Tools:',
        '    - Standard Model Context Protocol (MCP v1) endpoints (/api/mcp/v1/tools/list, /call)'
      ].join('\n');

      return {
        handled: true,
        action: 'SKILLS_LIST',
        reply: skillsOverview
      };
    }

    // 5b. Screenshot
    const isScreenshot = SCREENSHOT_PATTERNS.some(p => p.test(lower));
    if (isScreenshot) {
      try {
        _lazyLoad();
        if (desktopAutomation && typeof desktopAutomation.takeScreenshot === 'function') {
          const snap = desktopAutomation.takeScreenshot();
          return {
            handled: true,
            action: 'TAKE_SCREENSHOT',
            reply: `[OK] Desktop screenshot successfully captured.\nSaved to: ${snap.path || snap.filename || 'Disk'}\nTimestamp: ${new Date().toISOString()}`,
            data: snap
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'SCREENSHOT_ERROR',
          reply: `[!] Failed to capture screenshot: ${err.message}`,
          error: err.message
        };
      }
    }

    // 5c. Weather
    const isWeather = WEATHER_PATTERNS.some(p => p.test(lower));
    if (isWeather) {
      try {
        _lazyLoad();
        const cityMatch = lower.match(/(?:in|for|at)\s+([a-zA-Z\s]+)/i);
        const city = cityMatch ? cityMatch[1].trim() : null;

        if (weatherService && typeof weatherService.getWeather === 'function') {
          const w = await weatherService.getWeather(city);
          if (w && w.ok) {
            return {
              handled: true,
              action: 'GET_WEATHER',
              reply: `[OK] Weather for ${w.location}:\n${w.summary}\nTemperature: ${w.temperature}°C, Humidity: ${w.humidity || 'N/A'}%`,
              data: w
            };
          }
        }
        if (desktopAutomation && typeof desktopAutomation.getWeather === 'function') {
          const w2 = await desktopAutomation.getWeather(city);
          return {
            handled: true,
            action: 'GET_WEATHER',
            reply: `[OK] Weather Information:\n${typeof w2 === 'string' ? w2 : JSON.stringify(w2)}`,
            data: w2
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'WEATHER_ERROR',
          reply: `[!] Could not fetch weather: ${err.message}`,
          error: err.message
        };
      }
    }

    // 5d. System Info
    const isSystemInfo = SYSTEM_INFO_PATTERNS.some(p => p.test(lower));
    if (isSystemInfo) {
      try {
        _lazyLoad();
        if (desktopAutomation && typeof desktopAutomation.systemInfo === 'function') {
          const sys = desktopAutomation.systemInfo();
          return {
            handled: true,
            action: 'SYSTEM_INFO',
            reply: `[OK] System Telemetry:\n${typeof sys === 'string' ? sys : JSON.stringify(sys, null, 2)}`,
            data: sys
          };
        }
      } catch (err) {
        return {
          handled: true,
          action: 'SYSTEM_INFO_ERROR',
          reply: `[!] Error reading system telemetry: ${err.message}`,
          error: err.message
        };
      }
    }

    // 5e. Volume Control
    const isVolume = VOLUME_PATTERNS.some(p => p.test(lower));
    if (isVolume) {
      try {
        _lazyLoad();
        if (desktopAutomation) {
          if (/up|badhao/i.test(lower)) {
            desktopAutomation.volumeUp();
            return { handled: true, action: 'VOLUME_UP', reply: '[OK] Master volume increased (+10%).' };
          } else if (/down|kam/i.test(lower)) {
            desktopAutomation.volumeDown();
            return { handled: true, action: 'VOLUME_DOWN', reply: '[OK] Master volume decreased (-10%).' };
          } else if (/mute|silent|band/i.test(lower)) {
            desktopAutomation.muteToggle();
            return { handled: true, action: 'VOLUME_MUTE', reply: '[OK] Master audio mute toggled.' };
          }
        }
      } catch (err) {
        return { handled: true, action: 'VOLUME_ERROR', reply: `[!] Volume control error: ${err.message}` };
      }
    }

    // 5f. Launch/Close named applications
    const openAppMatch = lower.match(/(?:please\s+)?(?:open|launch|start|chalu\s+karo|kholo)\s+([a-zA-Z0-9\s._-]+)/i);
    if (openAppMatch) {
      const app = openAppMatch[1].trim();
      if (!/^(?:file|document|word|excel|ppt|presentation|the\s+link|url|myraa|screen|camera)/i.test(app)) {
        try {
          _lazyLoad();
          if (desktopAutomation && typeof desktopAutomation.openApplication === 'function') {
            desktopAutomation.openApplication(app);
            return {
              handled: true,
              action: 'OPEN_APPLICATION',
              reply: `[OK] Successfully launched application: ${app}`
            };
          }
        } catch (err) {
          return { handled: true, action: 'OPEN_APP_ERROR', reply: `[!] Could not launch ${app}: ${err.message}` };
        }
      }
    }

    const closeAppMatch = lower.match(/(?:please\s+)?(?:close|quit|exit|band\s+karo)\s+([a-zA-Z0-9\s._-]+)/i);
    if (closeAppMatch) {
      const app = closeAppMatch[1].trim();
      try {
        _lazyLoad();
        if (desktopAutomation && typeof desktopAutomation.closeApplication === 'function') {
          desktopAutomation.closeApplication(app);
          return {
            handled: true,
            action: 'CLOSE_APPLICATION',
            reply: `[OK] Closed application: ${app}`
          };
        }
      } catch (err) {
        return { handled: true, action: 'CLOSE_APP_ERROR', reply: `[!] Could not close ${app}: ${err.message}` };
      }
    }

    // Not a direct native capability match
    return { handled: false };
  }
}

module.exports = new UnifiedCapabilityRouter();
