/**
 * =============================================================================
 * MYRAA AI OS — Skills & MCP (Model Context Protocol) Suite + Mobile Command API
 * =============================================================================
 * Standard MCP v1 Protocol + Extensible Skills Engine + Mobile Remote Bridge
 * =============================================================================
 */

'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const desktop = require('./desktopAutomation.cjs');
const dynamicSkillEngine = require('./dynamic_skill_engine.cjs');
const officeDocEngine = require('./office_doc_engine.cjs');
let graftEngine = null;
try { graftEngine = require('./graft_engine.cjs'); } catch (e) { console.warn('graft_engine:', e.message); }

let visualControl = null;
try { visualControl = require('./visual_computer_control.cjs'); } catch (e) { console.warn('visual_computer_control:', e.message); }

let selfHealingDev = null;
try { selfHealingDev = require('./self_healing_dev_engine.cjs'); } catch (e) { console.warn('self_healing_dev:', e.message); }

let heartbeatEngine = null;
try { heartbeatEngine = require('./heartbeat_memory_engine.cjs'); } catch (e) { console.warn('heartbeat_memory:', e.message); }

let skillDiscovery = null;
try { skillDiscovery = require('./skill_discovery_engine.cjs'); } catch (e) { console.warn('skill_discovery:', e.message); }

let freeApiRegistry = null;
try { freeApiRegistry = require('./free_api_registry.cjs'); } catch (e) { console.warn('free_api_registry:', e.message); }

// ── TOOL RISK MAP ────────────────────────────────────────────────────────────
const TOOL_RISK_MAP = {
  'generate_word': 'MEDIUM', 'generate_excel': 'MEDIUM', 'generate_presentation': 'MEDIUM',
  'read_document': 'LOW', 'simulate_typing': 'MEDIUM',
  'file_search': 'LOW', 'send_file_whatsapp': 'MEDIUM', 'send_file_email': 'MEDIUM',
  'play_media': 'LOW', 'media_control': 'LOW',
  'window_control': 'MEDIUM', 'app_control': 'HIGH', 'mouse_control': 'HIGH',
  'keyboard_control': 'HIGH', 'screen_capture': 'LOW',
  'graft_find_code': 'LOW', 'graft_file_api': 'LOW', 'graft_trace_calls': 'LOW',
  'graft_find_all': 'LOW', 'graft_repo_map': 'LOW', 'graft_check_freshness': 'LOW',
  'computer_screen_find': 'MEDIUM', 'computer_screen_click': 'HIGH',
  'computer_screen_debug': 'LOW', 'computer_smart_type': 'HIGH',
  'dev_self_healing_build': 'HIGH', 'heartbeat_trigger_check': 'LOW',
  'memory_recall': 'LOW', 'memory_remember': 'LOW', 'memory_ingest': 'LOW',
  'free_api_list': 'LOW', 'free_api_call': 'LOW',
};
const RISK_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
function toolRisk(name) {
  if (TOOL_RISK_MAP[name]) return TOOL_RISK_MAP[name];
  if (name.startsWith('skill_')) return 'MEDIUM';
  if (name.startsWith('graft_')) return 'LOW';
  if (name.startsWith('computer_')) return 'HIGH';
  return 'MEDIUM';
}
function isToolAllowed(name, context) {
  const risk = toolRisk(name);
  const rank = RISK_RANK[risk] || 2;
  if (context && context.sensitivityLevel === 'critical' && rank >= 3) return { allowed: false, reason: `${name} is ${risk} risk — blocked at critical sensitivity` };
  return { allowed: true, risk };
}

// ── 1. MCP TOOLS DEFINITIONS ─────────────────────────────────────────────────
const MCP_TOOLS = [
  {
    name: "generate_word",
    description: "Generates a professional Microsoft Word (.docx) document with custom title, sections, and tables",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Desired output document filename (e.g. Report.docx)" },
        title: { type: "string", description: "Main title of the document" },
        subtitle: { type: "string", description: "Subtitle or author header" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              content: { type: "string" }
            }
          }
        },
        table: {
          type: "object",
          properties: {
            headers: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array" } }
          }
        }
      },
      required: ["title"]
    }
  },
  {
    name: "generate_excel",
    description: "Generates a professional Microsoft Excel (.xlsx) spreadsheet with styled headers and formulas",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Desired spreadsheet filename (e.g. Budget.xlsx)" },
        sheetName: { type: "string", description: "Title of the primary worksheet" },
        headers: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array" } }
      },
      required: ["headers", "rows"]
    }
  },
  {
    name: "generate_presentation",
    description: "Generates a professional Microsoft PowerPoint (.pptx) pitch deck with dark modern slides",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Desired presentation filename (e.g. Pitch.pptx)" },
        title: { type: "string", description: "Title of the presentation" },
        subtitle: { type: "string", description: "Subtitle or presenter line" },
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      required: ["title", "slides"]
    }
  },
  {
    name: "read_document",
    description: "Deeply reads and extracts text, paragraphs, tables, and sheets from any Word, Excel, PowerPoint, PDF, or text file",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full disk path of the document to read" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "simulate_typing",
    description: "Simulates keyboard typing into the active application window or target application",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type" },
        targetWindow: { type: "string", description: "Optional window title to focus before typing" }
      },
      required: ["text"]
    }
  },
  {
    name: "file_search",
    description: "Searches local PC files across Documents, Downloads, Desktop, and Workspace",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keyword or filename pattern to search" },
        maxResults: { type: "number", description: "Maximum number of files to return (default 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "send_file_whatsapp",
    description: "Sends or prepares a file to be shared via WhatsApp Web / WhatsApp Desktop",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the file on disk" },
        phone: { type: "string", description: "Optional phone number with country code (e.g. +91...)" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "send_file_email",
    description: "Composes an email with the selected file for vishwajeetsrk@gmail.com",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the file to attach" },
        recipient: { type: "string", description: "Recipient email address (defaults to vishwajeetsrk@gmail.com)" },
        subject: { type: "string", description: "Email subject line" }
      },
      required: ["filePath"]
    }
  },
  {
    name: "play_media",
    description: "Searches and plays a music video, song, or movie on YouTube / local media player",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name of the song, artist, video, or movie" },
        isMovie: { type: "boolean", description: "Set to true if searching for a full movie" }
      },
      required: ["query"]
    }
  },
  {
    name: "media_control",
    description: "Controls PC media playback and volume",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["play_pause", "next", "prev", "volume_up", "volume_down", "mute"],
          description: "Media action to trigger"
        },
        steps: { type: "number", description: "Volume steps (default 2)" }
      },
      required: ["action"]
    }
  },
  {
    name: "window_control",
    description: "Controls desktop application windows (minimize, maximize, close, switch, show desktop)",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["minimize", "maximize", "close", "switch", "show_desktop", "list"],
          description: "Window action"
        },
        target: { type: "string", description: "Window title or process name (optional, defaults to active window)" }
      },
      required: ["action"]
    }
  },
  {
    name: "app_control",
    description: "Launches or closes desktop applications (Chrome, VS Code, Excel, Notepad, Spotify, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["open", "close"], description: "Action" },
        appName: { type: "string", description: "Application name or executable" }
      },
      required: ["action", "appName"]
    }
  },
  {
    name: "mouse_control",
    description: "100% accurate mouse control (move, click, double click, right click, scroll, drag)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["move", "click", "double_click", "right_click", "scroll", "drag", "get_pos"] },
        x: { type: "number", description: "Screen X coordinate" },
        y: { type: "number", description: "Screen Y coordinate" },
        endX: { type: "number", description: "Destination X for drag" },
        endY: { type: "number", description: "Destination Y for drag" },
        deltaY: { type: "number", description: "Scroll delta (-120 is down, 120 is up)" }
      },
      required: ["action"]
    }
  },
  {
    name: "keyboard_control",
    description: "100% accurate keyboard typing and shortcuts (type text, press keys, hotkeys like ctrl+c, alt+tab)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["type", "press_key", "hotkey"] },
        text: { type: "string", description: "Text to type into focused window" },
        key: { type: "string", description: "Special key (enter, esc, tab, space, etc.)" },
        keys: { type: "string", description: "Hotkey combination (e.g. 'ctrl+c', 'alt+tab', 'win+d')" }
      },
      required: ["action"]
    }
  },
  {
    name: "screen_capture",
    description: "Captures a live screenshot of the desktop",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "graft_find_code",
    description: "Searches codebase with Graft AST context graph. Returns ranked symbols with inlined cruxes and exact line ranges.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Plain words or concept describing the code or symbol to find" },
        limit: { type: "number", description: "Maximum number of symbols to return (default 5)" },
        in: { type: "string", description: "Path prefix filter (e.g. 'src/app')" },
        full: { type: "boolean", description: "Return full definition crux instead of compact snippet" }
      },
      required: ["query"]
    }
  },
  {
    name: "graft_file_api",
    description: "Signatures-only skeleton view of a source file (~10x cheaper token cost than whole-file read). Shows every export, class, method, function signature.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative or absolute path of the file to inspect" }
      },
      required: ["path"]
    }
  },
  {
    name: "graft_trace_calls",
    description: "Calculates structural blast radius and call graph edges for a symbol (upstream callers and downstream dependencies) without LLM overhead.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Symbol name or function to trace" },
        depth: { type: "number", description: "Depth of call tree traversal (1-5, default 1)" },
        direction: { type: "string", enum: ["in", "out"], description: "Direction of trace ('in' for callers, 'out' for callees)" }
      },
      required: ["target"]
    }
  },
  {
    name: "graft_find_all",
    description: "Fast regex/text search over indexed AST codebase grouped by enclosing symbol and ranked by architectural coupling score.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern or regular expression" },
        caseSensitive: { type: "boolean", description: "Whether search is case-sensitive" },
        limit: { type: "number", description: "Maximum matches to return (default 50)" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "graft_repo_map",
    description: "Returns architectural repository map with directory clusters, top hub symbols, and degree centrality coupling scores.",
    inputSchema: {
      type: "object",
      properties: {
        maxDirs: { type: "number", description: "Maximum directory clusters to return (default 16)" }
      }
    }
  },
  {
    name: "graft_check_freshness",
    description: "High-speed ~3ms freshness check comparing working tree fingerprint to AST cache to detect code drift.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Optional repository path (defaults to current project root)" }
      }
    }
  },
  {
    name: "computer_screen_find",
    description: "Finds the exact (x, y) center pixel coordinates of any visual element, button, icon, or field on the desktop screen using Gemini Vision.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Visual description of the target element on screen (e.g. 'Blue submit button', 'Chrome close icon')" }
      },
      required: ["description"]
    }
  },
  {
    name: "computer_screen_click",
    description: "Locates a visual element on screen by natural language description using Gemini Vision and clicks it.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Visual description of the target element to click" },
        button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button to click (default left)" },
        clicks: { type: "number", description: "1 for single click, 2 for double click" }
      },
      required: ["description"]
    }
  },
  {
    name: "computer_screen_debug",
    description: "Takes a screenshot of the active on-screen compiler error, terminal traceback, or broken code in VS Code and provides root-cause diagnosis and code fix.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "computer_smart_type",
    description: "Clears input field (Ctrl+A -> Del) and reliably types or clipboard-injects text. Also supports generating mock form data (name, email, phone, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to type into focused field" },
        clearFirst: { type: "boolean", description: "Whether to select all and clear field before typing (default true)" },
        generateMockType: { type: "string", enum: ["name", "first_name", "last_name", "email", "username", "password", "phone", "address", "city", "zip_code"], description: "Optionally auto-generate realistic mock data" }
      }
    }
  },
  {
    name: "dev_self_healing_build",
    description: "Autonomous project builder that plans multi-file software projects, opens them in VS Code, executes the entry point, isolates tracebacks, and self-heals broken files across up to 4 iterations.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Software project goal or feature specification" },
        projectName: { type: "string", description: "Optional folder name inside Projects/" },
        maxAttempts: { type: "number", description: "Max self-healing iterations (default 4)" }
      },
      required: ["goal"]
    }
  },
  {
    name: "heartbeat_trigger_check",
    description: "Triggers a proactive background heartbeat check inspecting system health vitals, background alerts, and distills recent activity into curated long-term memory (MEMORY.md).",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "memory_recall",
    description: "Semantic recall over MYRAA's memory & knowledge base (RAG). Returns top memories with sources and citations for a query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to recall" },
        limit: { type: "number", description: "Max memories (default 4)" }
      },
      required: ["query"]
    }
  },
  {
    name: "memory_remember",
    description: "Store a fact/preference/episode in MYRAA's memory with a taxonomy category.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Memory content" },
        key: { type: "string", description: "Optional stable key" },
        category: { type: "string", description: "preference | identity | episodic | semantic | knowledge | system_fact | location" }
      },
      required: ["text"]
    }
  },
  {
    name: "memory_ingest",
    description: "Chunk and ingest a document/source into the knowledge base with title and optional url.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        text: { type: "string", description: "Source text (auto-chunked to ~512 tokens)" },
        url: { type: "string" }
      },
      required: ["title", "text"]
    }
  },
  {
    name: "free_api_list",
    description: "List all available free public APIs from the public-apis catalog. Returns categories and API IDs.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category (optional)" }
      }
    }
  },
  {
    name: "free_api_call",
    description: "Call a free public API by ID. Covers Animals, Anime, Books, Crypto, Currency, Dev, Entertainment, Environment, Food, Geocoding, Health, Music, Science, Weather, and more.",
    inputSchema: {
      type: "object",
      properties: {
        api_id: { type: "string", description: "API ID from free_api_list (e.g. cat-facts, coingecko, meal-random)" },
        query: { type: "string", description: "Search query parameter (if the API needs one)" },
        status: { type: "string", description: "HTTP status code for http-cat/http-dog" },
        lat: { type: "string", description: "Latitude for weather/geocoding APIs" },
        lon: { type: "string", description: "Longitude for weather/geocoding APIs" },
        weight: { type: "string", description: "Weight in kg for BMI API" },
        height: { type: "string", description: "Height in cm for BMI API" }
      },
      required: ["api_id"]
    }
  }
];

// ── 2. MCP PROTOCOL ENDPOINTS ────────────────────────────────────────────────
router.get('/api/mcp/v1/tools', (req, res) => {
  const dynamicTools = dynamicSkillEngine ? dynamicSkillEngine.getMcpToolDefinitions() : [];
  res.json({ tools: [...MCP_TOOLS, ...dynamicTools] });
});

router.post('/api/mcp/v1/tools/list', (req, res) => {
  const dynamicTools = dynamicSkillEngine ? dynamicSkillEngine.getMcpToolDefinitions() : [];
  res.json({ tools: [...MCP_TOOLS, ...dynamicTools] });
});

router.post('/api/mcp/v1/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body || {};
  try {
    const result = await executeTool(name, args || {});
    res.json({
      content: [
        {
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ],
      isError: !result.ok
    });
  } catch (err) {
    res.status(500).json({
      content: [{ type: "text", text: `Tool error: ${err.message}` }],
      isError: true
    });
  }
});

router.get('/api/mcp/v1/resources', (req, res) => {
  const dynamicTools = dynamicSkillEngine ? dynamicSkillEngine.getMcpToolDefinitions() : [];
  res.json({
    resources: [
      { uri: "resource://desktop/windows", name: "Visible Desktop Windows", mimeType: "application/json" },
      { uri: "resource://desktop/screenshot", name: "Current Desktop Screenshot", mimeType: "image/jpeg" },
      { uri: "resource://myraa/transcripts", name: "Recent Transcripts Log", mimeType: "application/json" },
      { uri: "resource://myraa/plugins", name: "Connected Plugins Fleet", mimeType: "application/json" },
      { uri: "resource://myraa/memory", name: "MYRAA Long-Term Memory & Knowledge (RAG)", mimeType: "application/json" },
      { uri: "resource://myraa/skills", name: "MYRAA Skill Discovery Registry", mimeType: "application/json" },
      { uri: "resource://myraa/permissions", name: "Tool Risk & Permission Map", mimeType: "application/json" },
    ],
    mcpToolsCount: dynamicTools.length + MCP_TOOLS.length,
    skillsCount: dynamicSkillEngine ? dynamicSkillEngine.getCatalog().length : 0,
    discoveryCount: skillDiscovery ? skillDiscovery.getAllSkills().length : 0,
  });
});

// ── 3. TOOL EXECUTION ENGINE ─────────────────────────────────────────────────
async function executeTool(name, args) {
  const perm = isToolAllowed(name, {});
  if (!perm.allowed) return { ok: false, error: perm.reason, tool: name, risk: perm.risk };

  // 1. Office Suite Tools
  if (name === 'generate_word' && officeDocEngine) {
    return await officeDocEngine.generateWord(args);
  }
  if (name === 'generate_excel' && officeDocEngine) {
    return await officeDocEngine.generateExcel(args);
  }
  if (name === 'generate_presentation' && officeDocEngine) {
    return await officeDocEngine.generatePresentation(args);
  }
  if (name === 'read_document' && officeDocEngine) {
    return await officeDocEngine.readDocument(args.filePath);
  }
  if (name === 'simulate_typing' && officeDocEngine) {
    return await officeDocEngine.simulateTyping(args.text, args.targetWindow);
  }

  // 2. Dynamic Cognitive Skills
  if (name.startsWith('skill_') && dynamicSkillEngine) {
    const rawId = name.replace(/^skill_/, '').replace(/_/g, '-');
    return await dynamicSkillEngine.executeSkill(rawId, args.task || args.prompt || '', args.parameters || {});
  }

  // 3. Graft Fast AST Code Intelligence Tools
  if (name.startsWith('graft_') && graftEngine) {
    if (name === 'graft_find_code') {
      const out = graftEngine.findCode(args.query, { limit: args.limit, in: args.in, full: args.full, repoPath: args.repoPath });
      return { ok: true, ...out };
    }
    if (name === 'graft_file_api') {
      const out = graftEngine.getFileApi(args.path || args.filePath || args.file, args.repoPath);
      return { ok: !out.error, ...out };
    }
    if (name === 'graft_trace_calls') {
      const out = graftEngine.traceCalls(args.target || args.symbol, { depth: args.depth, direction: args.direction, repoPath: args.repoPath });
      return { ok: true, ...out };
    }
    if (name === 'graft_find_all') {
      const out = graftEngine.findAll(args.pattern, { caseSensitive: args.caseSensitive, limit: args.limit, repoPath: args.repoPath });
      return { ok: !out.error, ...out };
    }
    if (name === 'graft_repo_map') {
      const out = graftEngine.getRepoMap(args.repoPath, args.maxDirs);
      return { ok: true, ...out };
    }
    if (name === 'graft_check_freshness') {
      const out = graftEngine.checkFreshness(args.repoPath);
      return { ok: true, ...out };
    }
  }

  // 4. Brahma-AI Visual Computer Control & Automation Tools
  if (name === 'computer_screen_find' && visualControl) {
    return await visualControl.screenFind(args.description);
  }
  if (name === 'computer_screen_click' && visualControl) {
    return await visualControl.screenClick(args.description, args);
  }
  if (name === 'computer_screen_debug' && visualControl) {
    return await visualControl.screenDebug();
  }
  if (name === 'computer_smart_type' && visualControl) {
    let toType = args.text;
    if (args.generateMockType) {
      toType = visualControl.generateRandomData(args.generateMockType);
    }
    const res = visualControl.smartType(toType, { clearFirst: args.clearFirst });
    return { ok: true, typedText: toType, ...res };
  }
  if (name === 'dev_self_healing_build' && selfHealingDev) {
    return await selfHealingDev.buildAndSelfHeal(args.goal, args);
  }
  if (name === 'heartbeat_trigger_check' && heartbeatEngine) {
    return await heartbeatEngine.runHeartbeatCycle();
  }

  // 4b. MYRAA Memory & Knowledge (RAG) tools
  let memKb = null;
  try { memKb = require('./memory_kb.cjs').kb; } catch (e) { /* optional */ }
  if (name === 'memory_recall' && memKb) {
    const r = await memKb.retrieve(args.query || args.q || '', { limit: Number(args.limit) || 4 });
    return r;
  }
  if (name === 'memory_remember' && memKb) {
    const r = memKb.remember({ key: args.key, text: args.text, category: args.category || 'preference', metadata: args.metadata });
    return { ok: Boolean(r), saved: r };
  }
  if (name === 'memory_ingest' && memKb) {
    const r = memKb.ingest({ title: args.title, text: args.text, url: args.url, metadata: args.metadata });
    return r;
  }

  // 5. Free Public API Registry
  if (name === 'free_api_list' && freeApiRegistry) {
    const apis = args.category ? freeApiRegistry.list(args.category) : freeApiRegistry.list();
    return { ok: true, count: apis.length, categories: freeApiRegistry.CATEGORIES, apis: apis.map((a) => ({ id: a.id, name: a.name, category: a.category, description: a.description, params: a.params || [] })) };
  }
  if (name === 'free_api_call' && freeApiRegistry) {
    const params = { query: args.query, status: args.status, lat: args.lat, lon: args.lon, weight: args.weight, height: args.height };
    return await freeApiRegistry.execute(args.api_id, params);
  }

  // 6. Hot-loadable Plugins
  if (globalThis.__myraa_pluginMgr) {
    const pluginResult = globalThis.__myraa_pluginMgr.executeTool(name, args);
    if (pluginResult !== null) return pluginResult;
  }

  switch (name) {
    case 'file_search':
      return desktop.searchFiles(args.query, args.maxResults || 10);

    case 'send_file_whatsapp':
      return desktop.sendFileWhatsApp(args.filePath, args.phone || "");

    case 'send_file_email':
      return desktop.sendFileEmail(args.filePath, args.recipient || "vishwajeetsrk@gmail.com", args.subject || "");

    case 'play_media':
      return desktop.searchAndPlayMedia(args.query, Boolean(args.isMovie));

    case 'media_control':
      if (args.action === 'play_pause') return desktop.mediaPlayPause();
      if (args.action === 'next') return desktop.mediaNext();
      if (args.action === 'prev') return desktop.mediaPrevious();
      if (args.action === 'volume_up') return desktop.volumeUp(args.steps || 2);
      if (args.action === 'volume_down') return desktop.volumeDown(args.steps || 2);
      if (args.action === 'mute') return desktop.muteToggle();
      return { ok: false, error: `Unknown media action ${args.action}` };

    case 'window_control':
      if (args.action === 'minimize') return desktop.minimizeWindow(args.target);
      if (args.action === 'maximize') return desktop.maximizeWindow(args.target);
      if (args.action === 'close') return desktop.closeWindow(args.target);
      if (args.action === 'switch') return desktop.switchApplication(args.target);
      if (args.action === 'show_desktop') return desktop.showDesktop();
      if (args.action === 'list') return desktop.listVisibleWindows();
      return { ok: false, error: `Unknown window action ${args.action}` };

    case 'app_control':
      if (args.action === 'open') return desktop.openApplication(args.appName);
      if (args.action === 'close') return desktop.closeApplication(args.appName);
      return { ok: false, error: `Unknown app action ${args.action}` };

    case 'mouse_control':
      if (args.action === 'move') return desktop.moveMouse(args.x, args.y);
      if (args.action === 'click') return desktop.click(args.x, args.y, 'left');
      if (args.action === 'double_click') return desktop.doubleClick(args.x, args.y);
      if (args.action === 'right_click') return desktop.rightClick(args.x, args.y);
      if (args.action === 'scroll') return desktop.scroll(args.deltaY || -120);
      if (args.action === 'drag') return desktop.drag(args.x, args.y, args.endX, args.endY);
      if (args.action === 'get_pos') return desktop.getCursorPosition();
      return { ok: false, error: `Unknown mouse action ${args.action}` };

    case 'keyboard_control':
      if (args.action === 'type') return desktop.typeText(args.text);
      if (args.action === 'press_key') return desktop.pressKey(args.key);
      if (args.action === 'hotkey') return desktop.hotkey(args.keys);
      return { ok: false, error: `Unknown keyboard action ${args.action}` };

    case 'screen_capture':
      return desktop.takeScreenshot();

    default:
      return { ok: false, error: `Unknown tool name: ${name}` };
  }
}

// ── 4. SKILLS REGISTRY (/api/skills) ─────────────────────────────────────────
const SKILLS = [
  {
    id: "skill_find_and_send",
    name: "Find File & Dispatch via WhatsApp / Email",
    description: "Search PC files by name/content and immediately dispatch via WhatsApp or Gmail",
    triggers: ["find file", "send by whatsapp", "send by email", "search file and send"],
    inputs: ["query", "channel", "recipient"]
  },
  {
    id: "skill_media_playback",
    name: "Play Music, Video & Movie Controller",
    description: "Hands-free video, music, and full movie searching and playback on YouTube or local media",
    triggers: ["play music", "play video", "play movie", "youtube", "pause music", "volume up", "volume down"],
    inputs: ["query", "isMovie"]
  },
  {
    id: "skill_desktop_window_control",
    name: "100% Accurate Window & App Controller",
    description: "Open/close apps, minimize, maximize, tile, show desktop, and switch active windows",
    triggers: ["open", "close", "minimize", "maximize", "show desktop", "switch to"],
    inputs: ["action", "target"]
  },
  {
    id: "skill_mouse_keyboard_automation",
    name: "100% Accurate Mouse & Keyboard Automation",
    description: "Type text, press keys, hotkeys, and click anywhere on the screen with precision",
    triggers: ["click here", "click there", "type", "press enter", "hotkey"],
    inputs: ["action", "x", "y", "text", "keys"]
  },
  {
    id: "skill_memory_recall",
    name: "MYRAA Long-Term Memory Recall (RAG)",
    description: "Semantic recall of past preferences, facts, conversations, and ingested knowledge with sources and citations",
    triggers: ["what do you remember", "recall", "do you know", "remember that", "my memory"],
    inputs: ["query", "limit"]
  },
  {
    id: "skill_memory_remember",
    name: "MYRAA Memory Write",
    description: "Persist a preference, fact, or episode so MYRAA recalls it later",
    triggers: ["remember this", "remember that", "note this down", "don't forget"],
    inputs: ["text", "key", "category"]
  }
];

router.get('/api/skills/catalog', (req, res) => {
  const dynamicList = dynamicSkillEngine ? dynamicSkillEngine.getCatalog() : [];
  const discoveryList = skillDiscovery ? skillDiscovery.getAllSkills() : [];
  const discoveryMap = new Map(discoveryList.map((s) => [s.id, s]));
  const merged = dynamicList.map((d) => {
    const disc = discoveryMap.get(d.id);
    return {
      id: d.id, name: d.name, category: d.category, description: d.description,
      risk_level: (disc && disc.risk_level) || 'LOW', status: 'ACTIVE',
      capabilities: (disc && disc.capabilities) || [],
      input_types: (disc && disc.input_types) || ['text'],
      output_types: (disc && disc.output_types) || ['text'],
      source: d.source, version: (disc && disc.version) || '1.0.0',
      instructionLength: d.bodyLength || 0,
    };
  });
  const categories = {};
  for (const s of merged) categories[s.category] = (categories[s.category] || 0) + 1;
  res.json({
    success: true,
    count: merged.length,
    categories,
    tools: TOOL_RISK_MAP,
    baseSkills: SKILLS,
    skills: merged,
  });
});

router.get('/api/mcp/skills', (req, res) => {
  const dynamicList = dynamicSkillEngine ? dynamicSkillEngine.getCatalog() : [];
  const discoveryList = skillDiscovery ? skillDiscovery.getAllSkills() : [];
  const discoveryMap = new Map(discoveryList.map((s) => [s.id, s]));
  const merged = dynamicList.map((d) => {
    const disc = discoveryMap.get(d.id);
    return {
      id: d.id, name: d.name, category: d.category, description: d.description,
      risk_level: (disc && disc.risk_level) || 'LOW',
      capabilities: (disc && disc.capabilities) || [],
      source: d.source,
    };
  });
  res.json({ success: true, count: merged.length, skills: merged, baseSkills: SKILLS });
});

router.post('/api/skills/add', (req, res) => {
  if (!dynamicSkillEngine) return res.status(503).json({ success: false, error: 'Skill engine not initialized' });
  const result = dynamicSkillEngine.addCustomSkill(req.body || {});
  res.json({ success: result.ok, ...result });
});

router.delete('/api/skills/:id', (req, res) => {
  if (!dynamicSkillEngine) return res.status(503).json({ success: false, error: 'Skill engine not initialized' });
  const result = dynamicSkillEngine.deleteCustomSkill(req.params.id);
  res.json({ success: result.ok, ...result });
});

router.post('/api/skills/execute', async (req, res) => {
  const { skillId, params } = req.body || {};
  try {
    let result;
    // Check if dynamic skill
    if (dynamicSkillEngine && dynamicSkillEngine.skillsMap.has(skillId)) {
      result = await dynamicSkillEngine.executeSkill(skillId, params?.task || params?.prompt || '', params || {});
      return res.json({ success: true, result });
    }
    if (skillId === 'skill_find_and_send') {
      const searchRes = desktop.searchFiles(params.query || "", 5);
      if (!searchRes.results || searchRes.results.length === 0) {
        return res.json({ success: false, message: `Could not find any file matching "${params.query}"` });
      }
      const targetFile = searchRes.results[0].path;
      if (params.channel === 'whatsapp') {
        result = desktop.sendFileWhatsApp(targetFile, params.recipient || "");
      } else {
        result = desktop.sendFileEmail(targetFile, params.recipient || "vishwajeetsrk@gmail.com", `Requested File: ${path.basename(targetFile)}`);
      }
      return res.json({ success: true, result, file: targetFile });
    }

    if (skillId === 'skill_media_playback') {
      result = desktop.searchAndPlayMedia(params.query || "", Boolean(params.isMovie));
      return res.json({ success: true, result });
    }

    if (skillId === 'skill_desktop_window_control') {
      if (params.action === 'minimize') result = desktop.minimizeWindow(params.target);
      else if (params.action === 'maximize') result = desktop.maximizeWindow(params.target);
      else if (params.action === 'close') result = desktop.closeWindow(params.target);
      else if (params.action === 'show_desktop') result = desktop.showDesktop();
      else if (params.action === 'open') result = desktop.openApplication(params.target);
      else result = desktop.switchApplication(params.target);
      return res.json({ success: true, result });
    }

    if (skillId === 'skill_mouse_keyboard_automation') {
      if (params.action === 'click') result = desktop.click(params.x, params.y);
      else if (params.action === 'type') result = desktop.typeText(params.text);
      else if (params.action === 'hotkey') result = desktop.hotkey(params.keys);
      return res.json({ success: true, result });
    }

    res.status(400).json({ success: false, error: "Unknown skillId" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4b. SKILL DISCOVERY + PERMISSION CHECK ENDPOINTS ─────────────────────────
router.get('/api/skills/discovery', (req, res) => {
  if (!skillDiscovery) return res.status(503).json({ ok: false, error: 'Skill discovery engine not available' });
  const all = skillDiscovery.getAllSkills();
  const summary = skillDiscovery.getRegistrySummary();
  const catFilter = req.query.category || null;
  const filtered = catFilter ? all.filter((s) => (s.category || '').toLowerCase() === catFilter.toLowerCase()) : all;
  res.json({
    ok: true,
    total: summary.totalSkills,
    categories: summary.categories,
    lastScan: summary.lastScanTime,
    primaryLocation: summary.primaryLocation,
    skills: filtered.map((s) => ({
      id: s.id, name: s.name, title: s.title, category: s.category,
      description: s.description, risk_level: s.risk_level, status: s.status,
      capabilities: s.capabilities, input_types: s.input_types, output_types: s.output_types,
      tools_required: s.tools_required, source: s.source, version: s.version,
      instructionLength: s.instructionLength,
    })),
  });
});

router.get('/api/skills/discovery/search', (req, res) => {
  if (!skillDiscovery) return res.status(503).json({ ok: false, error: 'Skill discovery engine not available' });
  const q = String(req.query.q || req.query.goal || '').trim();
  if (!q) return res.status(400).json({ ok: false, error: 'q (goal) is required' });
  const matched = skillDiscovery.matchSkillsForGoal(q, { limit: Number(req.query.limit) || 5 });
  res.json({
    ok: true,
    query: q,
    matches: matched.map((s) => ({
      id: s.id, name: s.name, category: s.category, description: s.description,
      risk_level: s.risk_level, capabilities: s.capabilities, source: s.source,
    })),
  });
});

router.post('/api/skills/discovery/compose', (req, res) => {
  if (!skillDiscovery) return res.status(503).json({ ok: false, error: 'Skill discovery engine not available' });
  const goal = String((req.body && req.body.goal) || '').trim();
  if (!goal) return res.status(400).json({ ok: false, error: 'goal is required' });
  const plan = skillDiscovery.composeSkillPlan(goal, req.body.context || {});
  res.json({ ok: true, ...plan });
});

router.get('/api/skills/discovery/:id', (req, res) => {
  if (!skillDiscovery) return res.status(503).json({ ok: false, error: 'Skill discovery engine not available' });
  const skill = skillDiscovery.getSkill(req.params.id);
  if (!skill) return res.status(404).json({ ok: false, error: 'Skill not found' });
  const instructions = skillDiscovery.getSkillInstructions(req.params.id);
  res.json({ ok: true, skill, instructionsPreview: instructions ? instructions.slice(0, 2000) : null });
});

router.get('/api/permissions/risk-map', (req, res) => {
  res.json({ ok: true, riskMap: TOOL_RISK_MAP, riskRank: RISK_RANK });
});

router.post('/api/permissions/check', (req, res) => {
  const { tool, sensitivityLevel } = req.body || {};
  if (!tool) return res.status(400).json({ ok: false, error: 'tool name is required' });
  const decision = isToolAllowed(tool, { sensitivityLevel });
  res.json({ ok: true, tool, ...decision });
});

// ── 5. MOBILE REMOTE COMMAND & TELEMETRY API ─────────────────────────────────
router.post('/api/mobile/command', async (req, res) => {
  const { command } = req.body || {};
  if (!command || !command.trim()) {
    return res.status(400).json({ success: false, error: "Empty command" });
  }

  const text = command.toLowerCase().trim();
  let actionTaken = "";

  try {
    // 1. Find file and send by WhatsApp or Email
    if (/find\s+(?:the\s+)?file|search\s+(?:the\s+)?file|send\s+(?:me\s+)?(?:by|via)\s+(?:whatsapp|email)/i.test(text)) {
      const isWhatsapp = /whatsapp/i.test(text);
      const isEmail = /email|gmail/i.test(text);
      // Extract file keyword
      const queryMatch = text.match(/(?:file|find|search|send)\s+([a-zA-Z0-9_\-\.\s]+?)(?:\s+(?:and|to|via|by|with)|\s*$)/i);
      const query = (queryMatch && queryMatch[1]) ? queryMatch[1].replace(/the|file/gi, '').trim() : "document";

      const found = desktop.searchFiles(query, 5);
      if (found.results && found.results.length > 0) {
        const file = found.results[0].path;
        if (isWhatsapp) {
          desktop.sendFileWhatsApp(file);
          actionTaken = `Found "${path.basename(file)}" and opened WhatsApp to send!`;
        } else {
          desktop.sendFileEmail(file, "vishwajeetsrk@gmail.com");
          actionTaken = `Found "${path.basename(file)}" and prepared email to vishwajeetsrk@gmail.com!`;
        }
      } else {
        actionTaken = `Searched PC for "${query}" but found no matching file.`;
      }
      return res.json({ success: true, message: actionTaken });
    }

    // 2. Play Movie or Music
    if (/play\s+(?:movie|video|song|music)|watch\s+movie/i.test(text)) {
      const isMovie = /movie/i.test(text);
      const query = text.replace(/play|movie|video|song|music|watch|on\s+youtube/gi, '').trim();
      desktop.searchAndPlayMedia(query || (isMovie ? "Interstellar" : "Lofi coding music"), isMovie);
      return res.json({ success: true, message: `Playing ${isMovie ? 'movie' : 'media'}: "${query || 'Featured'}" on YouTube` });
    }

    // 3. Media Controls
    if (/pause|resume|next\s+track|previous\s+track|volume\s+up|volume\s+down|mute/i.test(text)) {
      if (/pause|resume/i.test(text)) desktop.mediaPlayPause();
      else if (/next/i.test(text)) desktop.mediaNext();
      else if (/previous|prev/i.test(text)) desktop.mediaPrevious();
      else if (/volume\s+up/i.test(text)) desktop.volumeUp(3);
      else if (/volume\s+down/i.test(text)) desktop.volumeDown(3);
      else if (/mute/i.test(text)) desktop.muteToggle();
      return res.json({ success: true, message: `Media control executed: ${text}` });
    }

    // 4. Window Controls (minimize, maximize, close, show desktop)
    if (/minimize|maximize|close\s+window|show\s+desktop/i.test(text)) {
      if (/minimize\s+all|show\s+desktop/i.test(text)) desktop.showDesktop();
      else if (/minimize/i.test(text)) desktop.minimizeWindow();
      else if (/maximize/i.test(text)) desktop.maximizeWindow();
      else if (/close/i.test(text)) desktop.closeWindow();
      return res.json({ success: true, message: `Window action executed: ${text}` });
    }

    // 5. Open / Close Application
    if (/open\s+|launch\s+|close\s+|quit\s+/i.test(text)) {
      const isClose = /close|quit/i.test(text);
      const app = text.replace(/open|launch|close|quit/gi, '').trim();
      if (isClose) desktop.closeApplication(app);
      else desktop.openApplication(app);
      return res.json({ success: true, message: `${isClose ? 'Closed' : 'Opened'} application: ${app}` });
    }

    // 6. Mouse Click / Coordinates
    if (/click\s+(?:here|there|\d+)/i.test(text)) {
      const coordMatch = text.match(/(\d+)[,\s]+(\d+)/);
      if (coordMatch) {
        const x = parseInt(coordMatch[1], 10);
        const y = parseInt(coordMatch[2], 10);
        desktop.click(x, y);
        return res.json({ success: true, message: `Clicked at coordinates (${x}, ${y})` });
      } else {
        desktop.click();
        return res.json({ success: true, message: "Clicked current mouse position" });
      }
    }

    // 7. Type text
    if (/type\s+|write\s+/i.test(text)) {
      const toType = text.replace(/type|write/gi, '').trim();
      desktop.typeText(toType);
      return res.json({ success: true, message: `Typed into active window: "${toType}"` });
    }

    // Fallback: search web or open URL
    desktop.openWebsite(`https://www.google.com/search?q=${encodeURIComponent(text)}`);
    res.json({ success: true, message: `Searched Google for: "${text}"` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/api/mobile/telemetry', (req, res) => {
  const nets = os.networkInterfaces();
  let lanIp = '127.0.0.1';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
  }

  res.json({
    success: true,
    hostname: os.hostname(),
    platform: os.platform(),
    lanIp,
    mobileUrl: `http://${lanIp}:3000/mobile`,
    uptimeSeconds: Math.round(os.uptime()),
    freeMemMB: Math.round(os.freemem() / (1024 * 1024)),
    totalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
    timestamp: new Date().toISOString()
  });
});

router.get('/api/mobile/screenshot', (req, res) => {
  const snap = desktop.takeScreenshot();
  res.json(snap);
});

module.exports = {
  router,
  executeTool,
  MCP_TOOLS,
  SKILLS
};
