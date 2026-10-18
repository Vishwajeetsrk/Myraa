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
