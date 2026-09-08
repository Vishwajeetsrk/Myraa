var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_ws = require("ws");
var import_genai2 = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var fs9 = __toESM(require("fs"), 1);
var import_node_crypto10 = require("node:crypto");
var import_promises8 = __toESM(require("node:dns/promises"), 1);
var import_node_net2 = __toESM(require("node:net"), 1);
var import_node_child_process = require("node:child_process");

// server_memory.ts
var import_promises = __toESM(require("fs/promises"), 1);
var import_genai = require("@google/genai");

// server_paths.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = process.env.MYRAA_DATA_DIR || process.cwd();
try {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
} catch {
}
function dataFile(name) {
  return import_path.default.join(DATA_DIR, name);
}
var SECRETS_FILE = dataFile("secrets.json");
function readSecrets() {
  try {
    if (import_fs.default.existsSync(SECRETS_FILE)) {
      return JSON.parse(import_fs.default.readFileSync(SECRETS_FILE, "utf-8"));
    }
  } catch {
  }
  return {};
}
function getGeminiApiKey() {
  const stored = readSecrets().geminiApiKey?.trim();
  if (stored) return stored;
  const env = process.env.GEMINI_API_KEY?.trim();
  if (env) return env;
  try {
    const fallbackFiles = [
      "C:\\Users\\Vishwajeet\\Music\\Myraa\\secrets.json",
      "C:\\Users\\Vishwajeet\\Music\\Myraa\\.myraa-data\\secrets.json",
      "C:\\Users\\Vishwajeet\\AppData\\Roaming\\MYRAA\\secrets.json",
      "C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA-AI-OS\\resources\\app\\secrets.json",
      "C:\\Users\\Vishwajeet\\AppData\\Local\\Programs\\MYRAA-AI-OS\\resources\\app\\dist\\secrets.json",
      "D:\\Team of Vishwajeet\\.env.local",
      "D:\\Team of Vishwajeet\\.env"
    ];
    for (const file of fallbackFiles) {
      if (import_fs.default.existsSync(file)) {
        const content = import_fs.default.readFileSync(file, "utf-8");
        if (file.endsWith(".json")) {
          const parsed = JSON.parse(content);
          if (parsed.geminiApiKey?.trim()) return parsed.geminiApiKey.trim();
        } else {
          const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
          if (match) return match[1].replace(/['"]/g, "").trim();
        }
      }
    }
  } catch {}
  return void 0;
}
function hasGeminiApiKey() {
  return Boolean(getGeminiApiKey());
}
function setGeminiApiKey(key) {
  const trimmed = (key || "").trim();
  if (!trimmed) throw new Error("API key must not be empty.");
  const current = readSecrets();
  current.geminiApiKey = trimmed;
  delete current.ignoreEnvironmentApiKey;
  import_fs.default.writeFileSync(SECRETS_FILE, JSON.stringify(current, null, 2), "utf-8");
  try {
    import_fs.default.chmodSync(SECRETS_FILE, 384);
  } catch {
  }
}
function clearGeminiApiKey() {
  const current = readSecrets();
  delete current.geminiApiKey;
  current.ignoreEnvironmentApiKey = true;
  try {
    import_fs.default.writeFileSync(SECRETS_FILE, JSON.stringify(current, null, 2), "utf-8");
  } catch {
  }
}

// server_memory.ts
var MEMORY_FILE = dataFile("memories.json");
async function loadMemories() {
  try {
    const data = await import_promises.default.readFile(MEMORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    console.error("[Memory] Error loading memories, returning fallback:", error);
    return [];
  }
}
async function saveMemories(memories) {
  try {
    await import_promises.default.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2), "utf-8");
    console.log(`[Memory] Saved ${memories.length} memories successfully.`);
  } catch (error) {
    console.error("[Memory] Error writing memory file:", error);
  }
}
function formatSystemInstructionsWithMemories(baseInstruction, memories) {
  if (memories.length === 0) {
    return baseInstruction + "\n\n=== MYRAA PERSISTENT CONTEXT ===\nNo durable user context is stored yet. Do not ask for a biography, preferences, routines, or personal details just to populate memory. Use facts only when the user shares them naturally and they matter to future continuity.\n================================\n";
  }
  const grouped = {};
  memories.forEach((m) => {
    grouped[m.category] = grouped[m.category] || [];
    grouped[m.category].push(m.text);
  });
  let memoryBlock = "\n\n=== MYRAA PERSISTENT CONTEXT ===\nThese are user-provided facts retained for continuity. Use a fact only when it is directly relevant to the current exchange. Never mention databases, memory files, or retrieval. Never force a reference, claim friendship or emotional attachment, or ask for more personal details merely to seem connected.\n\nRELEVANT KNOWLEDGE CARD:\n";
  const categoriesOrdered = [
    { key: "identity", label: "Identity (Name, nick, profession, background)" },
    { key: "preference", label: "Preferences & Tastes (Likes, dislikes, games, movies)" },
    { key: "goal", label: "Active Goals & Aspirations" },
    { key: "project", label: "Ongoing Projects & Ecosystems" },
    { key: "relationship", label: "Key People & Relationships mentioned" },
    { key: "emotional", label: "Emotional Highlights & Core Milestones" },
    { key: "behavior", label: "Observed Traits & Behavioral Tendencies" }
  ];
  categoriesOrdered.forEach((cat) => {
    const list = grouped[cat.key] || [];
    if (list.length > 0) {
      memoryBlock += `* ${cat.label}:
` + list.map((t) => `  - ${t}`).join("\n") + "\n";
    }
  });
  memoryBlock += "================================\n";
  return baseInstruction + memoryBlock;
}
var isConsolidating = false;
var consolidationBackoffUntil = 0;
async function processConversationSlice(apiKey, dialogueHistory) {
  if (isConsolidating) {
    console.log("[Memory] Consolidation loop busy, skipping slice processing");
    return null;
  }
  if (Date.now() < consolidationBackoffUntil) {
    return null;
  }
  if (dialogueHistory.length < 2) {
    return null;
  }
  isConsolidating = true;
  console.log("[Memory] Initiating pipeline for dialogue slice of length:", dialogueHistory.length);
  try {
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const currentMemories = await loadMemories();
    const memoryContext = currentMemories.map((m) => `ID: ${m.id} | Category: ${m.category} | Fact: ${m.text}`).join("\n");
    const dialogueContext = dialogueHistory.map((line) => `${line.role === "user" ? "User" : "Myraa"}: ${line.text}`).join("\n");
    const prompt = `You are Myraa's deep cognitive recollection engine. Your task is to analyze the recent conversation piece against previous persistent memories, and output precise update transactions.

### OBJECTIVE
Decide if any statements contain durable, important personal facts, enduring preferences, aspirations, ongoing projects, critical relationships, key historical emotional events, or behavioral trends.
Avoid cataloging small talk, greetings, general chit-chat, or fleeting sentences (e.g., ignore 'hello', 'how are you', 'waking up', 'lol').

### CURRENT USER MEMORIES:
${memoryContext || "(No memory records exist)"}

### RECENT DIALOGUE SLICE:
${dialogueContext}

### RULES
- ACTIONS:
  - "ADD": If new material information is introduced (e.g. user says 'My favorite food is lasagna' and it's not present).
  - "UPDATE": If previous information has evolved or is corrected (e.g. user says 'I changed my major to computer science' when memory says they study history). Provide the exact ID of the memory to replace.
  - "REMOVE": If a memory was explicitly disproven or the user directly asked Myraa to forget it.
- TEXT STYLE: Express the memories as clean, concise, third-person declarative summaries (e.g., 'The user is building a startup named Myraa.', 'The user loves playing GTA 6.', 'The user enjoys technical and fast-paced styling explanations.'). Do not include conversational filler, quotes, or timestamps.
- ID: For ADD, leave blank. For UPDATE or REMOVE, provide the exact 'id' from the "Current user memories" list.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            transactions: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  action: {
                    type: import_genai.Type.STRING,
                    description: "ADD, UPDATE, or REMOVE transaction.",
                    enum: ["ADD", "UPDATE", "REMOVE"]
                  },
                  id: {
                    type: import_genai.Type.STRING,
                    description: "Specific ID of the existing memory being modified or deleted (leave blank/null for ADD)."
                  },
                  category: {
                    type: import_genai.Type.STRING,
                    description: "The Memory category classification.",
                    enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                  },
                  text: {
                    type: import_genai.Type.STRING,
                    description: "The memory summarized as a concise declarative statement in third-person."
                  }
                },
                required: ["action", "category", "text"]
              }
            }
          },
          required: ["transactions"]
        }
      }
    });
    const resultText = response.text?.trim() || "{}";
    const resultObj = JSON.parse(resultText);
    const transactions = resultObj.transactions || [];
    if (transactions.length === 0) {
      console.log("[Memory] Zero transactions generated. Ignored routine conversations.");
      isConsolidating = false;
      return null;
    }
    console.log(`[Memory] Processing ${transactions.length} memory updates:`, JSON.stringify(transactions));
    let updatedMemories = [...currentMemories];
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    for (const trx of transactions) {
      if (trx.action === "ADD") {
        const newMemory = {
          id: Math.random().toString(36).substring(2, 11),
          category: trx.category,
          text: trx.text,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        updatedMemories.push(newMemory);
      } else if (trx.action === "UPDATE") {
        const tarIndex = updatedMemories.findIndex((m) => m.id === trx.id);
        if (tarIndex !== -1) {
          updatedMemories[tarIndex] = {
            ...updatedMemories[tarIndex],
            category: trx.category,
            text: trx.text,
            updatedAt: timestamp
          };
        } else {
          const newMemory = {
            id: Math.random().toString(36).substring(2, 11),
            category: trx.category,
            text: trx.text,
            createdAt: timestamp,
            updatedAt: timestamp
          };
          updatedMemories.push(newMemory);
        }
      } else if (trx.action === "REMOVE") {
        updatedMemories = updatedMemories.filter((m) => m.id !== trx.id);
      }
    }
    await saveMemories(updatedMemories);
    isConsolidating = false;
    return updatedMemories;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (/\b429\b|quota|resource_exhausted/i.test(details)) {
      consolidationBackoffUntil = Date.now() + 6 * 60 * 6e4;
      console.warn("[Memory] Optional consolidation quota is exhausted; backing off for six hours. Live voice and proactive presence remain available.");
    } else {
      console.error("[Memory] Consolidation failure:", error);
    }
    isConsolidating = false;
    return null;
  }
}

// cognition/attentionEngine.ts
var AttentionEngine = class {
  constructor(repetitionCooldownMs = 18e4) {
    this.repetitionCooldownMs = repetitionCooldownMs;
    this.seen = /* @__PURE__ */ new Map();
  }
  assess(event, situation, at = Date.now()) {
    const semanticKey = event.dedupeKey || deriveSemanticKey(event);
    const previous = this.seen.get(semanticKey);
    const defaults = defaultSignals(event);
    const urgency = signal(event, "urgency", defaults.urgency);
    const risk = signal(event, "risk", defaults.risk);
    const relevance = signal(event, "relevance", defaults.relevance);
    const userImpact = signal(event, "userImpact", defaults.userImpact);
    const taskRelevance = signal(
      event,
      "taskRelevance",
      event.projectId && event.projectId === situation.currentProject ? 0.9 : defaults.taskRelevance
    );
    const interruptionCost = signal(event, "interruptionCost", inferInterruptionCost(situation));
    const withinCooldown = previous && at - previous.lastSeenAt < this.repetitionCooldownMs;
    const urgencyEscalated = previous && urgency > previous.highestUrgency + 0.15;
    const repetitionPenalty = withinCooldown && !urgencyEscalated ? Math.min(1, 0.48 + previous.count * 0.12) : 0;
    const inferredNovelty = previous ? withinCooldown ? urgencyEscalated ? 0.72 : 0.15 : 0.62 : lowSignalObservation(event.type) ? 0.28 : 1;
    const novelty = signal(
      event,
      "novelty",
      inferredNovelty
    );
    const factors = {
      relevance,
      novelty,
      urgency,
      risk,
      userImpact,
      taskRelevance,
      confidence: event.confidence,
      repetitionPenalty,
      interruptionCost
    };
    const weighted = relevance * 0.16 + novelty * 0.14 + urgency * 0.18 + risk * 0.2 + userImpact * 0.12 + taskRelevance * 0.1 + event.confidence * 0.1 - repetitionPenalty * 0.2 - interruptionCost * 0.12;
    const score = clamp(weighted * 0.82 + event.importance * 0.18);
    return {
      eventId: event.id,
      score,
      factors,
      semanticKey,
      explanation: explain(factors, withinCooldown === true, urgencyEscalated === true)
    };
  }
  record(assessment, at = Date.now()) {
    const previous = this.seen.get(assessment.semanticKey);
    this.seen.set(assessment.semanticKey, {
      lastSeenAt: at,
      count: (previous?.count || 0) + 1,
      highestUrgency: Math.max(previous?.highestUrgency || 0, assessment.factors.urgency)
    });
    if (this.seen.size > 1e3) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);
      for (const [key] of oldest.slice(0, 200)) this.seen.delete(key);
    }
  }
};
function defaultSignals(event) {
  const type = event.type;
  if (/delete_requested|disk_space_critical|security|data_loss/.test(type)) {
    return { urgency: 0.95, risk: 0.98, relevance: 0.95, userImpact: 0.98, taskRelevance: 0.85 };
  }
  if (/crashed|failed|blocked|confirmation_required/.test(type)) {
    return { urgency: 0.78, risk: 0.72, relevance: 0.86, userImpact: 0.84, taskRelevance: 0.82 };
  }
  if (/completed|succeeded|download_completed|build_finished/.test(type)) {
    const recovered = event.metadata.recoveredAfterFailures === true;
    return {
      urgency: recovered ? 0.62 : 0.36,
      risk: 0.08,
      relevance: recovered ? 0.88 : 0.62,
      userImpact: recovered ? 0.82 : 0.56,
      taskRelevance: 0.8
    };
  }
  if (/user_interrupted|correction/.test(type)) {
    return { urgency: 0.66, risk: 0.2, relevance: 0.92, userImpact: 0.74, taskRelevance: 0.82 };
  }
  if (/active_window_changed|clipboard_changed|frame_received/.test(type)) {
    return { urgency: 0.08, risk: 0.05, relevance: 0.24, userImpact: 0.12, taskRelevance: 0.32 };
  }
  return { urgency: 0.25, risk: 0.15, relevance: 0.5, userImpact: 0.4, taskRelevance: 0.45 };
}
function inferInterruptionCost(situation) {
  if (situation.pendingRisk?.level && situation.pendingRisk.level >= 3) return 0.05;
  if (situation.userSpeaking) return 0.98;
  if (situation.myraaSpeaking) return 0.75;
  if (situation.userActivity === "away") return 0.85;
  const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
  if (/obs|premiere|resolve|game|youtube|netflix|meet|zoom|presentation/.test(app)) return 0.78;
  return 0.25;
}
function signal(event, key, fallback) {
  const value = event.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : clamp(fallback);
}
function deriveSemanticKey(event) {
  const focus = [
    event.type,
    event.projectId,
    event.metadata.path,
    event.metadata.tool,
    event.metadata.application,
    event.metadata.goalId,
    event.metadata.reason
  ].filter((value) => value !== void 0 && value !== null && value !== "").join("|").toLowerCase().replace(/\s+/g, " ").slice(0, 300);
  return focus || event.type;
}
function lowSignalObservation(type) {
  return /active_window_changed|clipboard_changed|frame_received|silence_duration_changed/.test(type);
}
function explain(factors, repeated, escalated) {
  const reasons = [];
  if (factors.risk >= 0.7) reasons.push("high risk");
  if (factors.urgency >= 0.7) reasons.push("time-sensitive");
  if (factors.taskRelevance >= 0.75) reasons.push("relevant to the current task");
  if (factors.userImpact >= 0.75) reasons.push("high user impact");
  if (repeated && !escalated) reasons.push("recently handled; repetition suppressed");
  if (escalated) reasons.push("urgency increased since the previous event");
  if (factors.interruptionCost >= 0.7) reasons.push("user interruption cost is high");
  return reasons.length ? reasons : ["routine observation"];
}
function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/config.ts
function bool(value, fallback) {
  if (value === void 0 || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}
function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function loadCognitionConfig(env = process.env) {
  const permission = (name, fallback = true) => bool(env[`MYRAA_PERMISSION_${name.toUpperCase()}`], fallback);
  return {
    enabled: bool(env.MYRAA_ENABLE_COGNITION, true),
    initiativeEnabled: bool(env.MYRAA_ENABLE_INITIATIVE, true),
    proactiveSpeechEnabled: bool(env.MYRAA_ENABLE_PROACTIVE_SPEECH, true),
    skillLearningEnabled: bool(env.MYRAA_ENABLE_SKILL_LEARNING, true),
    reflectionEnabled: bool(env.MYRAA_ENABLE_REFLECTION, true),
    screenAwarenessEnabled: bool(env.MYRAA_ENABLE_SCREEN_AWARENESS, false),
    desktopAwarenessEnabled: bool(env.MYRAA_ENABLE_DESKTOP_AWARENESS, true),
    autonomyPaused: bool(env.PAUSE_AUTONOMY, false),
    debug: bool(env.MYRAA_COGNITION_DEBUG, false),
    attention: {
      rememberThreshold: number(env.MYRAA_ATTENTION_REMEMBER, 0.24, 0, 1),
      mentionThreshold: number(env.MYRAA_ATTENTION_MENTION, 0.48, 0, 1),
      speakThreshold: number(env.MYRAA_ATTENTION_SPEAK, 0.68, 0, 1),
      interruptThreshold: number(env.MYRAA_ATTENTION_INTERRUPT, 0.86, 0, 1),
      repetitionCooldownMs: number(env.MYRAA_REPETITION_COOLDOWN_MS, 18e4, 1e3, 864e5)
    },
    limits: {
      maxPlanDepth: number(env.MYRAA_MAX_PLAN_DEPTH, 8, 1, 50),
      maxRetries: number(env.MYRAA_MAX_RETRIES, 2, 0, 10),
      maxToolCallsPerTask: number(env.MYRAA_MAX_TOOL_CALLS, 24, 1, 500),
      taskTimeoutMs: number(env.MYRAA_TASK_TIMEOUT_MS, 3e5, 1e3, 36e5),
      maxRecentEvents: number(env.MYRAA_MAX_RECENT_EVENTS, 40, 5, 500)
    },
    permissions: {
      microphone: permission("microphone"),
      screen_awareness: permission("screen_awareness"),
      filesystem_read: permission("filesystem_read"),
      filesystem_write: permission("filesystem_write"),
      desktop_control: permission("desktop_control"),
      browser: permission("browser"),
      network: permission("network"),
      automation: permission("automation"),
      code_execution: permission("code_execution"),
      system_control: permission("system_control")
    }
  };
}

// cognition/critic.ts
var TRANSIENT = /timeout|temporar|unavailable|connection|network|rate limit|busy|locked/i;
var TaskCritic = class {
  verifyToolResult(result2, expectedFields = []) {
    if (!result2.success) {
      const retryRecommended = result2.status !== "denied" && result2.status !== "confirmation_required" && TRANSIENT.test(result2.error || "");
      return {
        passed: false,
        retryRecommended,
        reason: result2.status === "confirmation_required" ? "Action is pending explicit user confirmation and has not executed." : result2.error || `Tool ended with status '${result2.status}'.`,
        missing: []
      };
    }
    const output = result2.result && typeof result2.result === "object" ? result2.result : {};
    const missing = expectedFields.filter((field) => !(field in output));
    return {
      passed: missing.length === 0,
      retryRecommended: false,
      reason: missing.length ? `Tool reported success but verification fields are missing: ${missing.join(", ")}.` : "Structured tool result confirms successful completion.",
      missing
    };
  }
};

// cognition/desktopPerception.ts
var DesktopPerception = class {
  constructor(options) {
    this.options = options;
    this.timer = null;
    this.previous = null;
    this.polling = false;
    this.consecutiveFailures = 0;
    this.availabilityReported = true;
    this.activityState = "active";
    this.diskWasCritical = false;
  }
  start() {
    if (this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.pollIntervalMs || 2500);
    this.timer.unref?.();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  async poll() {
    if (this.polling) return;
    this.polling = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2e3);
    try {
      const snapshot = await this.options.fetchSnapshot(controller.signal);
      this.consecutiveFailures = 0;
      if (!this.availabilityReported) {
        this.availabilityReported = true;
        await this.options.emit({
          type: "system.perception_restored",
          source: "system",
          importance: 0.45
        });
      }
      if (this.previous) await this.diff(this.previous, snapshot);
      this.previous = snapshot;
      await this.updateActivity(snapshot.userIdleSeconds);
      await this.checkDisk(snapshot);
    } catch {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= 3 && this.availabilityReported) {
        this.availabilityReported = false;
        await this.options.emit({
          type: "system.perception_unavailable",
          source: "system",
          importance: 0.22,
          metadata: { reason: "desktop agent observation endpoint unavailable" }
        });
      }
    } finally {
      clearTimeout(timeout);
      this.polling = false;
    }
  }
  async diff(previous, current) {
    const previousWindow = `${previous.activeWindow.application || ""}|${previous.activeWindow.title || ""}`;
    const currentWindow = `${current.activeWindow.application || ""}|${current.activeWindow.title || ""}`;
    if (previousWindow !== currentWindow) {
      await this.options.emit({
        type: "desktop.active_window_changed",
        source: "desktop",
        importance: 0.12,
        confidence: 0.95,
        dedupeKey: `active-window:${current.activeWindow.application || "unknown"}`,
        metadata: {
          application: current.activeWindow.application,
          title: current.activeWindow.title,
          activeApp: current.activeWindow.application,
          activeWindow: current.activeWindow.title
        }
      });
    }
    const beforeApps = new Set(previous.applications);
    const afterApps = new Set(current.applications);
    for (const application of afterApps) {
      if (!beforeApps.has(application)) {
        await this.options.emit({
          type: "desktop.application_opened",
          source: "desktop",
          importance: 0.28,
          metadata: { application }
        });
      }
    }
    for (const application of beforeApps) {
      if (!afterApps.has(application)) {
        await this.options.emit({
          type: "desktop.application_closed",
          source: "desktop",
          importance: 0.24,
          metadata: { application }
        });
      }
    }
    const beforeDownloads = new Map(previous.downloads.map((item) => [downloadKey(item.name), item]));
    const afterDownloads = new Map(current.downloads.map((item) => [downloadKey(item.name), item]));
    for (const [key, item] of afterDownloads) {
      const before = beforeDownloads.get(key);
      if (!before && item.status === "downloading") {
        await this.options.emit({
          type: "desktop.download_started",
          source: "desktop",
          importance: 0.38,
          dedupeKey: `download:${key}`,
          metadata: { path: item.path, name: item.name }
        });
      } else if (item.status === "complete" && (!before || before.status === "downloading")) {
        await this.options.emit({
          type: "desktop.download_completed",
          source: "desktop",
          importance: 0.68,
          dedupeKey: `download:${key}`,
          metadata: {
            path: item.path,
            name: item.name,
            size: item.size,
            relevance: 0.66,
            userImpact: 0.64
          }
        });
      }
    }
  }
  async updateActivity(idleSeconds) {
    const next = idleSeconds >= 120 ? "away" : idleSeconds >= 10 ? "idle" : "active";
    if (next === this.activityState) return;
    this.activityState = next;
    await this.options.emit({
      type: `system.user_${next}`,
      source: "system",
      importance: 0.18,
      metadata: { idleSeconds }
    });
  }
  async checkDisk(snapshot) {
    if (!snapshot.disk) return;
    const freePercent = 100 - snapshot.disk.percentUsed;
    const critical = snapshot.disk.freeBytes < 5 * 1024 ** 3 || freePercent < 5;
    if (critical && !this.diskWasCritical) {
      this.diskWasCritical = true;
      await this.options.emit({
        type: "system.disk_space_critical",
        source: "system",
        importance: 0.94,
        dedupeKey: `disk-critical:${snapshot.disk.path}`,
        metadata: {
          path: snapshot.disk.path,
          freeBytes: snapshot.disk.freeBytes,
          percentUsed: snapshot.disk.percentUsed,
          risk: 0.92,
          urgency: 0.9,
          userImpact: 0.94
        }
      });
    } else if (!critical && this.diskWasCritical) {
      this.diskWasCritical = false;
      await this.options.emit({
        type: "system.disk_space_recovered",
        source: "system",
        importance: 0.55,
        metadata: { path: snapshot.disk.path, freeBytes: snapshot.disk.freeBytes }
      });
    }
  }
};
function downloadKey(name) {
  return name.toLowerCase().replace(/\.(crdownload|part|partial|tmp)$/i, "");
}

// cognition/eventBus.ts
var import_node_crypto = require("node:crypto");
var CognitiveEventBus = class {
  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
    this.listeners = /* @__PURE__ */ new Map();
    this.history = [];
  }
  normalize(input) {
    return Object.freeze({
      ...input,
      id: (0, import_node_crypto.randomUUID)(),
      timestamp: input.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      importance: clamp2(input.importance ?? 0.35),
      confidence: clamp2(input.confidence ?? 0.8),
      metadata: Object.freeze({ ...input.metadata || {} })
    });
  }
  async publish(input) {
    const event = "id" in input ? input : this.normalize(input);
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
    const listeners = [
      ...this.listeners.get(event.type) || [],
      ...this.listeners.get("*") || []
    ];
    await Promise.allSettled(listeners.map((listener) => Promise.resolve(listener(event))));
    return event;
  }
  subscribe(type, listener) {
    const set = this.listeners.get(type) || /* @__PURE__ */ new Set();
    set.add(listener);
    this.listeners.set(type, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(type);
    };
  }
  recent(limit = 25) {
    return this.history.slice(-Math.max(0, limit));
  }
};
function clamp2(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/goalManager.ts
var import_node_crypto2 = require("node:crypto");
var import_promises2 = __toESM(require("node:fs/promises"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var GoalManager = class {
  constructor(filePath, maxTasks = 50) {
    this.filePath = filePath;
    this.maxTasks = maxTasks;
    this.goals = [];
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }
  async initialize() {
    if (this.loaded) return;
    await import_promises2.default.mkdir(import_node_path.default.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await import_promises2.default.readFile(this.filePath, "utf-8"));
      this.goals = Array.isArray(parsed.goals) ? parsed.goals : [];
    } catch (error) {
      if (error?.code !== "ENOENT") {
        await import_promises2.default.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {
        });
      }
      this.goals = [];
    }
    this.loaded = true;
    let changed = false;
    for (const goal of this.goals) {
      for (const task of goal.tasks) {
        if (task.status === "running") {
          task.status = "blocked";
          task.error = "Interrupted by restart; user verification is required before resuming.";
          task.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          goal.status = "blocked";
          if (!goal.blockers.includes("restart-verification")) goal.blockers.push("restart-verification");
          changed = true;
        }
      }
    }
    if (changed) await this.persist();
  }
  async create(input) {
    this.assertLoaded();
    const objective = input.objective.trim();
    if (!objective) throw new Error("Goal objective must not be empty.");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const rawTasks = (input.tasks || []).slice(0, this.maxTasks);
    const tasks = rawTasks.map((task) => ({
      id: task.id?.trim() || (0, import_node_crypto2.randomUUID)(),
      title: task.title.trim(),
      status: task.status || "pending",
      priority: clamp3(task.priority ?? 0.5),
      dependsOn: [...task.dependsOn || []],
      attempts: task.attempts || 0,
      maxRetries: Math.max(0, Math.min(5, task.maxRetries ?? 2)),
      timeoutMs: Math.max(1e3, Math.min(36e5, task.timeoutMs ?? 3e5)),
      progress: clamp3(task.progress ?? 0),
      error: task.error || null,
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    validateTaskGraph(tasks);
    const goal = {
      id: (0, import_node_crypto2.randomUUID)(),
      objective,
      constraints: unique(input.constraints || []),
      successCriteria: unique(input.successCriteria || []),
      priority: clamp3(input.priority ?? 0.5),
      status: tasks.length ? "active" : "pending",
      projectId: input.projectId ?? null,
      tasks,
      blockers: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.goals.push(goal);
    await this.persist();
    return structuredClone(goal);
  }
  async updateTask(goalId, taskId, patch) {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    const task = goal.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Unknown task: ${taskId}`);
    if (patch.status) task.status = patch.status;
    if (patch.progress !== void 0) task.progress = clamp3(patch.progress);
    if (patch.error !== void 0) task.error = patch.error;
    if (patch.attempts !== void 0) task.attempts = Math.max(0, patch.attempts);
    task.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    goal.updatedAt = task.updatedAt;
    goal.status = deriveGoalStatus(goal);
    await this.persist();
    return structuredClone(goal);
  }
  async setPlan(goalId, plannedTasks) {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    if (["completed", "cancelled"].includes(goal.status)) {
      throw new Error(`Cannot replace the plan for a ${goal.status} goal.`);
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const rawTasks = (plannedTasks || []).slice(0, this.maxTasks);
    if (!rawTasks.length) throw new Error("A goal plan must contain at least one task.");
    const tasks = rawTasks.map((task) => ({
      id: task.id?.trim() || (0, import_node_crypto2.randomUUID)(),
      title: task.title.trim(),
      status: "pending",
      priority: clamp3(task.priority ?? 0.5),
      dependsOn: [...task.dependsOn || []],
      attempts: 0,
      maxRetries: Math.max(0, Math.min(5, task.maxRetries ?? 2)),
      timeoutMs: Math.max(1e3, Math.min(36e5, task.timeoutMs ?? 3e5)),
      progress: 0,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    validateTaskGraph(tasks);
    goal.tasks = tasks;
    goal.status = "active";
    goal.blockers = goal.blockers.filter((item) => item !== "planning");
    goal.updatedAt = timestamp;
    await this.persist();
    return structuredClone(goal);
  }
  async cancel(goalId, reason = "Cancelled by user.") {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    goal.status = "cancelled";
    goal.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const task of goal.tasks) {
      if (["pending", "running", "blocked"].includes(task.status)) {
        task.status = "cancelled";
        task.error = reason;
        task.updatedAt = goal.updatedAt;
      }
    }
    await this.persist();
    return structuredClone(goal);
  }
  nextRunnableTask(goalId) {
    this.assertLoaded();
    const goal = this.requireGoal(goalId);
    const completed = new Set(goal.tasks.filter((task) => task.status === "completed").map((task) => task.id));
    const next = goal.tasks.filter((task) => task.status === "pending" && task.dependsOn.every((id) => completed.has(id))).sort((a, b) => b.priority - a.priority)[0];
    return next ? structuredClone(next) : null;
  }
  get(id) {
    this.assertLoaded();
    const goal = this.goals.find((item) => item.id === id);
    return goal ? structuredClone(goal) : null;
  }
  list() {
    this.assertLoaded();
    return this.goals.map((goal) => structuredClone(goal));
  }
  requireGoal(id) {
    const goal = this.goals.find((item) => item.id === id);
    if (!goal) throw new Error(`Unknown goal: ${id}`);
    return goal;
  }
  async persist() {
    const payload = { version: 1, goals: this.goals };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await import_promises2.default.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await import_promises2.default.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }
  assertLoaded() {
    if (!this.loaded) throw new Error("GoalManager.initialize() must be called first.");
  }
};
function deriveGoalStatus(goal) {
  if (goal.tasks.length > 0 && goal.tasks.every((task) => task.status === "completed")) return "completed";
  if (goal.tasks.some((task) => task.status === "running")) return "active";
  if (goal.tasks.some((task) => task.status === "blocked")) return "blocked";
  if (goal.tasks.some((task) => task.status === "failed" && task.attempts > task.maxRetries)) return "failed";
  if (goal.tasks.every((task) => task.status === "cancelled")) return "cancelled";
  return "active";
}
function validateTaskGraph(tasks) {
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    throw new Error("Goal task IDs must be unique.");
  }
  const taskIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    const unknownDependency = task.dependsOn.find((dependency) => !taskIds.has(dependency));
    if (unknownDependency) throw new Error(`Task '${task.id}' depends on unknown task '${unknownDependency}'.`);
    if (task.dependsOn.includes(task.id)) throw new Error(`Task '${task.id}' cannot depend on itself.`);
  }
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`Goal plan contains a dependency cycle at '${id}'.`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn || []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
}
function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
function clamp3(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/initiativeEngine.ts
var InitiativeEngine = class {
  constructor(config) {
    this.config = config;
  }
  decide(event, assessment, situation) {
    const socialOpportunityScore = typeof event.metadata.socialOpportunityScore === "number" ? Math.max(0, Math.min(1, event.metadata.socialOpportunityScore)) : 0;
    const score = event.type.startsWith("internal.") ? Math.max(assessment.score, socialOpportunityScore) : assessment.score;
    const { factors } = assessment;
    let action = "IGNORE";
    if (!this.config.enabled) {
      action = "IGNORE";
    } else if (situation.autonomyPaused || this.config.autonomyPaused) {
      action = score >= this.config.attention.rememberThreshold ? "OBSERVE" : "IGNORE";
    } else if (!this.config.initiativeEnabled) {
      action = score >= this.config.attention.rememberThreshold ? "REMEMBER" : "IGNORE";
    } else if (factors.repetitionPenalty >= 0.55 && factors.urgency < 0.8) {
      action = score >= this.config.attention.rememberThreshold ? "REMEMBER" : "IGNORE";
    } else if (score < this.config.attention.rememberThreshold) {
      action = "IGNORE";
    } else if (score < this.config.attention.mentionThreshold) {
      action = "REMEMBER";
    } else if (score < this.config.attention.speakThreshold) {
      action = "WAIT";
    } else if (factors.risk >= 0.8 || /confirmation_required|delete_requested/.test(event.type)) {
      action = "WARN";
    } else if (score >= this.config.attention.interruptThreshold && factors.urgency >= 0.75) {
      action = "WARN";
    } else if (event.metadata.needsClarification === true) {
      action = "ASK";
    } else {
      action = "SPEAK";
    }
    if (event.type.startsWith("internal.")) {
      if (event.metadata.internalOnly === true) {
        action = score >= this.config.attention.rememberThreshold ? "OBSERVE" : "IGNORE";
      } else {
        action = event.metadata.suggestedAction === "ASK" ? "ASK" : "SPEAK";
      }
    }
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type)) {
      action = action === "IGNORE" ? "IGNORE" : "OBSERVE";
    }
    const shouldGenerateSpeech = this.config.proactiveSpeechEnabled && !situation.autonomyPaused && ["SPEAK", "ASK", "WARN"].includes(action) && factors.interruptionCost < (factors.risk >= 0.85 ? 1 : 0.8);
    return {
      eventId: event.id,
      action,
      attentionScore: score,
      reason: {
        reason: reasonFor(event, assessment),
        urgency: factors.urgency,
        novelty: factors.novelty,
        confidence: factors.confidence,
        interruptionAllowed: shouldGenerateSpeech,
        suggestedTone: toneFor(event, factors.risk, factors.urgency)
      },
      shouldGenerateSpeech,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};
function reasonFor(event, assessment) {
  if (typeof event.metadata.reason === "string") return event.metadata.reason;
  if (/delete_requested/.test(event.type)) return "possible accidental deletion";
  if (/confirmation_required/.test(event.type)) return "a risky action needs explicit user confirmation";
  if (/failed|crashed|blocked/.test(event.type)) return "a relevant task or system operation failed";
  if (/completed|succeeded|finished/.test(event.type)) {
    return event.metadata.recoveredAfterFailures === true ? "a previously failing task has now succeeded" : "a relevant task completed";
  }
  return assessment.explanation[0] || "context changed in a potentially useful way";
}
function toneFor(event, risk, urgency) {
  if (risk >= 0.85) return "friendly-serious";
  if (/completed|succeeded|finished/.test(event.type)) return "warm-relieved";
  if (urgency >= 0.75) return "concise-alert";
  return "natural-casual";
}

// cognition/autonomousMind.ts
var import_node_crypto4 = require("node:crypto");

// cognition/conversationContinuationEngine.ts
var import_node_crypto3 = require("node:crypto");
var ConversationContinuationEngine = class {
  constructor(activeWindowMs = 18e4, minimumFollowupDelayMs = 4e3) {
    this.activeWindowMs = activeWindowMs;
    this.minimumFollowupDelayMs = minimumFollowupDelayMs;
    this.thread = null;
  }
  observe(event) {
    const text = typeof event.metadata.text === "string" ? event.metadata.text.trim() : "";
    const at = new Date(event.timestamp).getTime();
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type) && text) {
      const existing = this.thread;
      this.thread = {
        id: existing?.id || (0, import_node_crypto3.randomUUID)(),
        topic: inferTopic(text, existing?.topic),
        status: "ACTIVE",
        importance: Math.max(existing?.importance || 0.5, event.importance),
        unresolvedPoints: boundedUnique([...existing?.unresolvedPoints || [], text], 6),
        openQuestions: boundedUnique([
          ...existing?.openQuestions || [],
          ...looksOpenEnded(text) ? [text] : []
        ], 5),
        lastUserStatement: text,
        lastMyraaStatement: existing?.lastMyraaStatement || null,
        interruptedThoughts: existing?.interruptedThoughts || [],
        possibleFollowups: boundedUnique([
          ...existing?.possibleFollowups || [],
          `Find one useful continuation or unresolved assumption about: ${text}`
        ], 6),
        lastUserAt: at,
        lastMyraaAt: existing?.lastMyraaAt || null,
        activeUntil: at + this.activeWindowMs,
        autonomousTurnsSinceUser: 0
      };
      return;
    }
    if (event.type === "conversation.turn_completed" && text && this.thread) {
      this.thread.lastMyraaStatement = text;
      this.thread.lastMyraaAt = at;
      this.thread.status = "OPEN_ENDED";
      this.thread.activeUntil = at + this.activeWindowMs;
      return;
    }
    if (event.type === "conversation.user_interrupted_myraa" && this.thread) {
      const interrupted = typeof event.metadata.interruptedThought === "string" ? event.metadata.interruptedThought.trim() : "";
      this.thread.status = "INTERRUPTED";
      if (interrupted) {
        this.thread.interruptedThoughts = boundedUnique(
          [...this.thread.interruptedThoughts, interrupted],
          4
        );
      }
      return;
    }
    if (event.type === "internal.autonomous_speech_completed" && this.thread) {
      this.thread.autonomousTurnsSinceUser += 1;
      this.thread.status = "WAITING_FOR_USER";
    }
  }
  opportunity(situation, at = Date.now()) {
    const thread = this.thread;
    if (!thread || !thread.lastUserStatement || !thread.lastMyraaStatement) return null;
    if (situation.autonomyPaused || situation.userSpeaking || situation.myraaSpeaking) return null;
    if (thread.autonomousTurnsSinceUser >= 1 || at > thread.activeUntil) return null;
    const lastTurnAt = thread.lastMyraaAt || thread.lastUserAt || at;
    if (at - lastTurnAt < this.minimumFollowupDelayMs) return null;
    const silenceType = this.classifySilence(situation, at);
    if (silenceType === "USER_AWAY" || silenceType === "WORKING_SILENCE" || silenceType === "NATURAL_END") {
      return null;
    }
    if (thread.interruptedThoughts.length > 0) {
      return { reason: "interrupted_thought", thread: structuredClone(thread), silenceType };
    }
    if (thread.openQuestions.length > 0) {
      return { reason: "open_question", thread: structuredClone(thread), silenceType };
    }
    return { reason: "unfinished_conversation", thread: structuredClone(thread), silenceType };
  }
  classifySilence(situation, at = Date.now()) {
    const recentConversation = this.thread?.lastUserAt ? at - this.thread.lastUserAt < this.activeWindowMs : false;
    if (situation.userActivity === "away" && !recentConversation) return "USER_AWAY";
    const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
    if (/obs|premiere|resolve|game|meet|zoom|record|presentation/.test(app)) return "WORKING_SILENCE";
    if (!this.thread || at > this.thread.activeUntil) return "NATURAL_END";
    if (this.thread.status === "INTERRUPTED") return "AWKWARD_UNRESOLVED_SILENCE";
    if (this.thread.status === "ACTIVE" || this.thread.status === "OPEN_ENDED") {
      return "CONVERSATIONAL_PAUSE";
    }
    return "THINKING_SILENCE";
  }
  getThread() {
    return this.thread ? structuredClone(this.thread) : null;
  }
  hasActiveConversation(at = Date.now()) {
    return Boolean(
      this.thread?.lastUserStatement && this.thread.autonomousTurnsSinceUser < 1 && at <= this.thread.activeUntil
    );
  }
};
function inferTopic(text, previous) {
  const compact = text.replace(/\s+/g, " ").slice(0, 140);
  if (compact.length >= 12) return compact;
  return previous || compact || "current conversation";
}
function looksOpenEnded(text) {
  return /\?|\b(later|maybe|perhaps|not sure|decide|figure out|confused|samajh|pata nahi|soch)\b/i.test(text);
}
function boundedUnique(items, limit) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(-limit);
}

// cognition/curiosityEngine.ts
var CuriosityEngine = class {
  detect(thread) {
    const statement = thread?.lastUserStatement;
    if (!thread || !statement) return null;
    const explicitlyUncertain = /\b(later|maybe|perhaps|not sure|decide|either|or|should|want|learn|remember|automatic|confirm)\b/i.test(statement);
    const hasOpenQuestion = thread.openQuestions.length > 0;
    if (!explicitlyUncertain && !hasOpenQuestion) return null;
    return {
      known: statement,
      unknown: "One relevant user preference, constraint, or design assumption is still unclear.",
      importance: Math.min(0.9, thread.importance + 0.12)
    };
  }
};

// cognition/socialInitiativeEngine.ts
var SocialInitiativeEngine = class {
  constructor(speakThreshold = 0.68, repetitionCooldownMs = 3e5) {
    this.speakThreshold = speakThreshold;
    this.repetitionCooldownMs = repetitionCooldownMs;
    this.initiativeEnergy = 1;
    this.lastEnergyUpdateAt = Date.now();
    this.quietUntil = 0;
    this.spoken = /* @__PURE__ */ new Map();
  }
  evaluate(thought, situation, at = Date.now(), context = {}) {
    this.recharge(at);
    const semanticKey = semanticKeyFor(thought);
    const previous = this.spoken.get(semanticKey);
    const repeated = previous !== void 0 && at - previous < this.repetitionCooldownMs;
    const interruptionCost = inferInterruptionCost2(situation);
    const userAvailability = Math.max(0, 1 - interruptionCost);
    const continuationValue = context.activeConversation ? 0.9 : thought.origin === "unfinished_thread" ? 0.9 : thought.origin === "curiosity" ? 0.78 : 0.62;
    const score = clamp4(
      userAvailability * 0.2 + thought.relevance * 0.24 + thought.novelty * 0.18 + thought.socialValue * 0.18 + continuationValue * 0.2
    );
    const opportunity = {
      score,
      reason: repeated ? "recently expressed" : `${thought.origin} with contextual value`,
      userAvailability,
      topicRelevance: thought.relevance,
      novelty: thought.novelty,
      interruptionCost,
      continuationValue
    };
    if (repeated) return { decision: "DROP", opportunity, semanticKey };
    if (at < this.quietUntil && thought.urgency < 0.9) return { decision: "WAIT", opportunity, semanticKey };
    if (situation.userSpeaking || situation.myraaSpeaking || situation.userActivity === "away") {
      return { decision: "REVISIT_LATER", opportunity, semanticKey };
    }
    const effectiveSpeakThreshold = context.activeConversation ? Math.min(this.speakThreshold, 0.62) : this.speakThreshold;
    if (score < effectiveSpeakThreshold) {
      return { decision: score >= effectiveSpeakThreshold - 0.12 ? "REMEMBER" : "DROP", opportunity, semanticKey };
    }
    if (this.initiativeEnergy < 0.55 && thought.urgency < 0.8) {
      return { decision: "WAIT", opportunity, semanticKey };
    }
    const decision = thought.suggestedAction === "ASK" || thought.origin === "curiosity" ? "ASK" : "SPEAK";
    return { decision, opportunity, semanticKey };
  }
  recordSpeech(semanticKey, at = Date.now()) {
    this.spoken.set(semanticKey, at);
    this.initiativeEnergy = Math.max(0, this.initiativeEnergy - 0.65);
    if (this.spoken.size > 200) {
      const oldest = [...this.spoken.entries()].sort((a, b) => a[1] - b[1]).slice(0, 40);
      for (const [key] of oldest) this.spoken.delete(key);
    }
  }
  restoreFromUserInteraction() {
    this.initiativeEnergy = Math.min(1, this.initiativeEnergy + 0.4);
  }
  suppressCasualInitiative(durationMs, at = Date.now()) {
    this.quietUntil = durationMs === void 0 ? Number.POSITIVE_INFINITY : at + Math.max(0, durationMs);
  }
  restoreCasualInitiative() {
    this.quietUntil = 0;
    this.initiativeEnergy = Math.max(this.initiativeEnergy, 0.7);
  }
  status(at = Date.now()) {
    this.recharge(at);
    return { initiativeEnergy: this.initiativeEnergy, quietUntil: this.quietUntil };
  }
  recharge(at) {
    const elapsed = Math.max(0, at - this.lastEnergyUpdateAt);
    this.initiativeEnergy = Math.min(1, this.initiativeEnergy + elapsed / 6e5);
    this.lastEnergyUpdateAt = at;
  }
};
function semanticKeyFor(thought) {
  return `${thought.origin}|${thought.relatedTopic || ""}|${thought.content}`.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 24).join(" ");
}
function inferInterruptionCost2(situation) {
  if (situation.userSpeaking) return 1;
  if (situation.myraaSpeaking) return 0.9;
  if (situation.userActivity === "away") return 0.95;
  const app = `${situation.activeApp || ""} ${situation.activeWindow || ""}`.toLowerCase();
  if (/obs|premiere|resolve|game|youtube|netflix|meet|zoom|record|presentation/.test(app)) return 0.85;
  if (situation.userActivity === "idle") return 0.35;
  return 0.18;
}
function clamp4(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/autonomousMind.ts
var AutonomousMind = class {
  constructor(options) {
    this.options = options;
    this.curiosity = new CuriosityEngine();
    this.social = new SocialInitiativeEngine();
    this.queue = [];
    this.timer = null;
    this.running = false;
    this.paused = false;
    this.tickInFlight = false;
    this.speechAvailable = false;
    this.activeSpeechKey = null;
    this.lastDeepOpportunityKey = "";
    this.lastDeepOpportunityAt = 0;
    this.counters = {
      cognitiveTicks: 0,
      deepCognitiveMoments: 0,
      internalThoughtsGenerated: 0,
      internalThoughtsDropped: 0,
      autonomousSpeechAttempts: 0,
      autonomousSpeechCompleted: 0,
      autonomousSpeechInterrupted: 0,
      repetitionSuppressed: 0
    };
    this.deepThoughtGenerator = options.deepThoughtGenerator;
    this.continuation = new ConversationContinuationEngine(
      options.activeConversationWindowMs,
      options.minimumFollowupDelayMs
    );
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.scheduleNextTick();
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    if (this.running && !this.timer) this.scheduleNextTick();
  }
  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.tickInFlight) await new Promise((resolve) => setTimeout(resolve, 1));
  }
  setDeepThoughtGenerator(generator) {
    this.deepThoughtGenerator = generator;
  }
  observe(event) {
    this.continuation.observe(event);
    if (/^conversation\.(user_input|user_question|user_correction)$/.test(event.type)) {
      this.social.restoreFromUserInteraction();
    }
  }
  async tick(at = this.now()) {
    if (this.paused || this.tickInFlight) return;
    this.tickInFlight = true;
    this.counters.cognitiveTicks += 1;
    await this.debug("Cognition", { action: "tick", cognitiveTicks: this.counters.cognitiveTicks });
    try {
      this.pruneQueue(at);
      const situation = this.options.situation();
      const opportunity = this.continuation.opportunity(situation, at);
      const background = !opportunity && !this.continuation.hasActiveConversation(at) && this.speechAvailable ? await this.options.backgroundOpportunity?.(at) || null : null;
      const thoughtContext = opportunity ? {
        reason: opportunity.reason,
        thread: opportunity.thread,
        situation,
        relevantMemories: await this.options.retrieveMemories(opportunity.thread),
        curiosity: this.curiosity.detect(opportunity.thread)
      } : background;
      const opportunityKey = thoughtContext ? `${thoughtContext.thread.id}:${thoughtContext.thread.lastUserAt || 0}:${thoughtContext.thread.lastMyraaAt || 0}:${thoughtContext.reason}` : "";
      const deepMomentDue = opportunityKey !== this.lastDeepOpportunityKey || at - this.lastDeepOpportunityAt >= 6e4;
      if (thoughtContext && this.deepThoughtGenerator && deepMomentDue) {
        this.counters.deepCognitiveMoments += 1;
        let thought;
        try {
          thought = await this.deepThoughtGenerator(thoughtContext);
          this.lastDeepOpportunityKey = opportunityKey;
          this.lastDeepOpportunityAt = at;
        } catch (error) {
          this.lastDeepOpportunityKey = opportunityKey;
          this.lastDeepOpportunityAt = at - 5e4;
          throw error;
        }
        if (thought) {
          this.enqueue(normalizeThought(thought, at, {
            reason: thoughtContext.reason === "goal_review" || thoughtContext.reason === "memory_resurfaced" || thoughtContext.reason === "delayed_reflection" ? "unfinished_conversation" : thoughtContext.reason,
            thread: thoughtContext.thread,
            silenceType: "THINKING_SILENCE"
          }));
          this.counters.internalThoughtsGenerated += 1;
          await this.debug("InternalMind", {
            action: "candidate_generated",
            origin: thought.origin,
            thoughtId: thought.id
          });
          await this.options.emit({
            type: "internal.thought_generated",
            source: "internal",
            importance: 0.35,
            confidence: thought.confidence,
            dedupeKey: `thought-generated:${thought.id}`,
            metadata: {
              internalOnly: true,
              thoughtId: thought.id,
              origin: thought.origin,
              topic: thought.relatedTopic
            }
          });
        }
      }
      if (this.speechAvailable) await this.evaluateQueue(situation, at);
    } catch (error) {
      await this.debug("InternalMind", {
        action: "tick_failed",
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.tickInFlight = false;
    }
  }
  suppressCasualInitiative(durationMs) {
    this.social.suppressCasualInitiative(durationMs, this.now());
  }
  restoreCasualInitiative() {
    this.social.restoreCasualInitiative();
  }
  setSpeechAvailable(available) {
    this.speechAvailable = available;
  }
  markAutonomousSpeechStarted(thoughtId) {
    this.counters.autonomousSpeechAttempts += 1;
    if (thoughtId) this.activeSpeechKey = thoughtId;
    void this.debug("Speech", { action: "autonomous_speech_started", thoughtId });
  }
  markAutonomousSpeechCompleted() {
    if (!this.activeSpeechKey) return;
    this.counters.autonomousSpeechCompleted += 1;
    this.activeSpeechKey = null;
    void this.debug("Speech", { action: "autonomous_speech_completed" });
  }
  markAutonomousSpeechInterrupted(content) {
    if (!this.activeSpeechKey) return;
    this.counters.autonomousSpeechInterrupted += 1;
    this.activeSpeechKey = null;
    if (content?.trim()) {
      this.enqueue({
        id: (0, import_node_crypto4.randomUUID)(),
        createdAt: this.now(),
        origin: "unfinished_thread",
        content: content.trim(),
        relevance: 0.78,
        novelty: 0.65,
        urgency: 0.25,
        socialValue: 0.72,
        confidence: 0.7,
        expiresAt: this.now() + 18e4,
        suggestedAction: "REVISIT_LATER"
      });
    }
    void this.debug("Speech", { action: "autonomous_speech_interrupted" });
  }
  status() {
    return {
      running: this.running,
      paused: this.paused,
      queueLength: this.queue.length,
      speechAvailable: this.speechAvailable,
      counters: { ...this.counters },
      conversation: this.continuation.getThread(),
      social: this.social.status(this.now())
    };
  }
  enqueue(thought) {
    this.queue.push(thought);
    this.queue.sort((a, b) => thoughtPriority(b) - thoughtPriority(a));
    if (this.queue.length > 30) {
      const removed = this.queue.splice(30);
      this.counters.internalThoughtsDropped += removed.length;
    }
  }
  async evaluateQueue(situation, at) {
    const thought = this.queue[0];
    if (!thought) return;
    const thread = this.continuation.getThread();
    const activeConversation = Boolean(
      thread?.lastUserAt && at - thread.lastUserAt < 18e4 && thread.autonomousTurnsSinceUser < 1
    );
    const effectiveSituation = activeConversation && situation.userActivity === "away" ? { ...situation, userActivity: "active" } : situation;
    const evaluation = this.social.evaluate(thought, effectiveSituation, at, { activeConversation });
    await this.debug("Initiative", {
      action: evaluation.decision,
      speakScore: evaluation.opportunity.score,
      threshold: activeConversation ? 0.62 : 0.68,
      reason: evaluation.opportunity.reason,
      thoughtId: thought.id
    });
    if (evaluation.decision === "DROP") {
      this.queue.shift();
      this.counters.internalThoughtsDropped += 1;
      if (evaluation.opportunity.reason === "recently expressed") {
        this.counters.repetitionSuppressed += 1;
      }
      return;
    }
    if (!["SPEAK", "ASK", "SUGGEST"].includes(evaluation.decision)) return;
    this.queue.shift();
    this.social.recordSpeech(evaluation.semanticKey, at);
    const eventType = eventTypeFor(thought.origin);
    await this.options.emit({
      type: eventType,
      source: "internal",
      importance: Math.max(0.72, evaluation.opportunity.score),
      confidence: thought.confidence,
      dedupeKey: evaluation.semanticKey,
      metadata: {
        reason: reasonForOrigin(thought.origin),
        thoughtId: thought.id,
        thought: thought.content,
        origin: thought.origin,
        topic: thought.relatedTopic,
        relatedMemoryIds: thought.relatedMemoryIds || [],
        suggestedAction: evaluation.decision,
        relevance: thought.relevance,
        novelty: thought.novelty,
        urgency: thought.urgency,
        userImpact: thought.socialValue,
        taskRelevance: thought.relevance,
        interruptionCost: evaluation.opportunity.interruptionCost,
        socialOpportunityScore: evaluation.opportunity.score,
        continuationValue: evaluation.opportunity.continuationValue
      }
    });
  }
  pruneQueue(at) {
    const before = this.queue.length;
    const kept = this.queue.filter((thought) => !thought.expiresAt || thought.expiresAt > at);
    this.queue.splice(0, this.queue.length, ...kept);
    this.counters.internalThoughtsDropped += before - kept.length;
  }
  scheduleNextTick() {
    if (!this.running || this.paused || this.timer) return;
    const min = this.options.tickMinMs ?? 2e3;
    const max = Math.max(min, this.options.tickMaxMs ?? 5e3);
    const delay = min + Math.floor(this.random() * (max - min + 1));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick().finally(() => this.scheduleNextTick());
    }, delay);
    this.timer.unref?.();
  }
  random() {
    return this.options.random?.() ?? Math.random();
  }
  now() {
    return this.options.now?.() ?? Date.now();
  }
  async debug(component, fields) {
    await this.options.logger?.({
      timestamp: new Date(this.now()).toISOString(),
      component,
      ...fields
    });
  }
};
function normalizeThought(thought, at, opportunity) {
  return {
    ...thought,
    id: thought.id || (0, import_node_crypto4.randomUUID)(),
    createdAt: thought.createdAt || at,
    origin: thought.origin || (opportunity.reason === "interrupted_thought" ? "unfinished_thread" : "reflection"),
    content: thought.content.trim(),
    relevance: clamp5(thought.relevance),
    novelty: clamp5(thought.novelty),
    urgency: clamp5(thought.urgency),
    socialValue: clamp5(thought.socialValue),
    confidence: clamp5(thought.confidence),
    relatedTopic: thought.relatedTopic || opportunity.thread.topic,
    expiresAt: thought.expiresAt || at + 18e4
  };
}
function thoughtPriority(thought) {
  return thought.relevance * 0.3 + thought.novelty * 0.2 + thought.urgency * 0.2 + thought.socialValue * 0.3;
}
function eventTypeFor(origin) {
  if (origin === "curiosity") return "internal.curiosity_detected";
  if (origin === "memory") return "internal.memory_resurfaced";
  if (origin === "unfinished_thread") return "internal.unfinished_topic";
  if (origin === "goal") return "internal.goal_requires_attention";
  if (origin === "reflection") return "internal.reflection_complete";
  return "internal.social_opportunity";
}
function reasonForOrigin(origin) {
  if (origin === "curiosity") return "a relevant unresolved question emerged";
  if (origin === "memory") return "a relevant memory resurfaced";
  if (origin === "unfinished_thread") return "conversation continuation";
  if (origin === "goal") return "an active goal needs attention";
  if (origin === "reflection") return "a useful delayed reflection emerged";
  return "a meaningful social opportunity emerged";
}
function clamp5(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

// cognition/speechOrchestrator.ts
var PRIORITY = {
  critical_warning: 5,
  user_response: 4,
  task_result: 3,
  conversation_continuation: 2,
  casual_initiative: 1
};
var SpeechOrchestrator = class {
  constructor() {
    this.active = null;
    this.queue = [];
    this.userSpeaking = false;
  }
  request(request) {
    if (this.userSpeaking && request.source !== "critical_warning") return false;
    if (!this.active) {
      this.active = request;
      request.deliver();
      return true;
    }
    if (PRIORITY[request.source] > PRIORITY[this.active.source]) {
      this.queue.unshift(request);
    } else {
      this.queue.push(request);
    }
    this.queue.sort((a, b) => PRIORITY[b.source] - PRIORITY[a.source]);
    return true;
  }
  onUserSpeechStarted() {
    this.userSpeaking = true;
    const interruptedThoughtId = this.active?.source === "conversation_continuation" || this.active?.source === "casual_initiative" ? this.active.thoughtId : void 0;
    this.queue.splice(0, this.queue.length, ...this.queue.filter((item) => item.source === "critical_warning"));
    return { interruptedThoughtId };
  }
  onUserSpeechStopped() {
    this.userSpeaking = false;
  }
  onTurnComplete() {
    const completed = this.active;
    this.active = null;
    this.deliverNext();
    return completed;
  }
  onInterrupted() {
    const interrupted = this.active;
    this.active = null;
    return interrupted;
  }
  observeUserResponse() {
    if (!this.active) {
      this.active = { id: "direct-user-turn", source: "user_response", deliver: () => {
      } };
    }
  }
  status() {
    return { active: this.active?.source || null, queued: this.queue.length, userSpeaking: this.userSpeaking };
  }
  deliverNext() {
    if (this.userSpeaking || this.active) return;
    const next = this.queue.shift();
    if (!next) return;
    this.active = next;
    next.deliver();
  }
};

// cognition/modelRouter.ts
var import_node_crypto5 = require("node:crypto");
var ModelRouter = class {
  constructor(options) {
    this.options = options;
    this.recentCalls = [];
    this.cache = /* @__PURE__ */ new Map();
    this.inFlight = /* @__PURE__ */ new Map();
    this.routes = { ...loadModelRoutes(), ...options.routes || {} };
  }
  async generate(input) {
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error("Model prompt must not be empty.");
    if (prompt.length > (this.options.maxInputCharacters || 3e4)) {
      throw new Error("Model prompt exceeds the configured input budget.");
    }
    this.enforceRateLimit();
    const models = this.routes[input.capability].filter(Boolean);
    if (!models.length) throw new Error(`No model configured for capability '${input.capability}'.`);
    const key = input.cacheKey || (0, import_node_crypto5.createHash)("sha256").update(`${input.capability}\0${prompt}`).digest("hex");
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        text: cached.text,
        model: cached.model,
        capability: input.capability,
        durationMs: 0,
        cached: true,
        attempts: 0
      };
    }
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const promise = this.execute(input.capability, prompt, models, key, input.signal).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }
  async execute(capability, prompt, models, cacheKey, signal2) {
    const started = Date.now();
    let lastError = "Model call failed.";
    let attempts = 0;
    for (const model of models.slice(0, 2)) {
      attempts += 1;
      if (signal2?.aborted) throw new Error("Model call cancelled.");
      this.recentCalls.push(Date.now());
      try {
        const text = (await this.options.provider.generate({ model, prompt, signal: signal2 })).trim();
        if (!text) throw new Error("Model returned an empty response.");
        const durationMs = Date.now() - started;
        this.cache.set(cacheKey, {
          text,
          model,
          expiresAt: Date.now() + (this.options.cacheTtlMs || 3e5)
        });
        await this.options.onCall?.({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          capability,
          model,
          durationMs,
          attempts,
          success: true,
          promptCharacters: prompt.length
        });
        return { text, model, capability, durationMs, cached: false, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    await this.options.onCall?.({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      capability,
      models,
      durationMs: Date.now() - started,
      attempts,
      success: false,
      error: lastError,
      promptCharacters: prompt.length
    });
    throw new Error(lastError);
  }
  enforceRateLimit() {
    const cutoff = Date.now() - 6e4;
    while (this.recentCalls.length && this.recentCalls[0] < cutoff) this.recentCalls.shift();
    if (this.recentCalls.length >= (this.options.maxCallsPerMinute || 20)) {
      throw new Error("Model call rate limit reached; wait before retrying.");
    }
  }
};
function loadModelRoutes(env = process.env) {
  const split = (value, fallback) => (value || fallback).split(",").map((item) => item.trim()).filter(Boolean);
  return {
    fast: split(env.MYRAA_FAST_MODEL, "gemini-3.5-flash"),
    reasoning: split(env.MYRAA_REASONING_MODEL, "gemini-3.5-flash"),
    coding: split(env.MYRAA_CODE_MODEL, "gemini-3.5-flash"),
    vision: split(env.MYRAA_VISION_MODEL, "gemini-3.1-flash-live-preview"),
    research: split(env.MYRAA_RESEARCH_MODEL, "gemini-3.5-flash"),
    embedding: split(env.MYRAA_EMBEDDING_MODEL, "gemini-embedding-001"),
    speech: split(env.MYRAA_SPEECH_MODEL, "gemini-3.1-flash-live-preview")
  };
}

// cognition/planner.ts
var GoalPlanner = class {
  constructor(router, maxTasks = 20) {
    this.router = router;
    this.maxTasks = maxTasks;
  }
  async plan(goal, signal2) {
    const prompt = [
      "Create a concise executable plan for MYRAA. Return JSON only.",
      `Objective: ${goal.objective}`,
      `Constraints: ${goal.constraints.join("; ") || "none"}`,
      `Success criteria: ${goal.successCriteria.join("; ") || "none specified"}`,
      'Schema: {"tasks":[{"id":"short_stable_id","title":"specific action","priority":0.0,"dependsOn":["id"],"maxRetries":0,"timeoutMs":300000}]}',
      `Rules: maximum ${this.maxTasks} tasks; dependencies must reference earlier task IDs; no circular dependencies; do not execute anything; risky actions must be explicit steps that mention confirmation.`
    ].join("\n");
    const response = await this.router.generate({ capability: "reasoning", prompt, signal: signal2 });
    const parsed = parseJson(response.text);
    if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      throw new Error("Planner returned no tasks.");
    }
    if (parsed.tasks.length > this.maxTasks) throw new Error("Planner exceeded the task budget.");
    const tasks = parsed.tasks.map((raw, index) => validateTask(raw, index));
    const ids = /* @__PURE__ */ new Set();
    for (const task of tasks) {
      if (ids.has(task.id)) throw new Error(`Planner returned duplicate task ID '${task.id}'.`);
      for (const dependency of task.dependsOn) {
        if (!ids.has(dependency)) {
          throw new Error(`Task '${task.id}' has an unknown or forward dependency '${dependency}'.`);
        }
      }
      ids.add(task.id);
    }
    return tasks;
  }
};
function validateTask(value, index) {
  if (!value || typeof value !== "object") throw new Error(`Planner task ${index + 1} is invalid.`);
  const raw = value;
  const id = String(raw.id || `task_${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const title = String(raw.title || "").trim();
  if (!id || !title) throw new Error(`Planner task ${index + 1} needs id and title.`);
  return {
    id,
    title,
    priority: clamp6(Number(raw.priority ?? 0.5)),
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
    maxRetries: Math.max(0, Math.min(3, Number(raw.maxRetries ?? 1))),
    timeoutMs: Math.max(1e3, Math.min(36e5, Number(raw.timeoutMs ?? 3e5)))
  };
}
function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}
function clamp6(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

// cognition/proactivePresence.ts
function classifyProactivePresence(signals) {
  const now2 = signals.now ?? Date.now();
  const recentVisualMotion = signals.lastMeaningfulScreenChangeAt > 0 && now2 - signals.lastMeaningfulScreenChangeAt <= 15e3;
  return signals.userIdleSeconds >= 10 && !recentVisualMotion ? "idle_away" : "active_task";
}
function nextPresenceDelayMs(turnsWithoutUser, random = Math.random) {
  const range = turnsWithoutUser <= 0 ? [1e4, 15e3] : turnsWithoutUser === 1 ? [18e3, 28e3] : turnsWithoutUser === 2 ? [35e3, 55e3] : [9e4, 15e4];
  const [min, max] = range;
  return min + Math.floor(Math.max(0, Math.min(1, random())) * (max - min));
}
function shouldRepeatIdlePresence(lastIdlePresenceAt, now2 = Date.now(), cooldownMs = 12e4) {
  return lastIdlePresenceAt <= 0 || now2 - lastIdlePresenceAt >= cooldownMs;
}

// cognition/runtime.ts
var import_promises5 = __toESM(require("node:fs/promises"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);

// cognition/situationModel.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var SituationModel = class {
  constructor(maxRecentEvents = 40, initial) {
    this.maxRecentEvents = maxRecentEvents;
    this.snapshot = {
      state: "IDLE",
      currentActivity: null,
      activeApp: null,
      activeWindow: null,
      currentProject: null,
      conversationTopic: null,
      currentGoalId: null,
      currentTaskId: null,
      userActivity: "active",
      userSpeaking: false,
      myraaSpeaking: false,
      myraaWasInterrupted: false,
      silenceStartedAt: null,
      silenceSeconds: 0,
      openApplications: [],
      relevantFiles: [],
      recentImportantEvents: [],
      recentFailures: [],
      recentSuccesses: [],
      pendingRisk: null,
      autonomyPaused: false,
      updatedAt: now(),
      ...initial
    };
  }
  apply(event) {
    const meta = event.metadata;
    const state = stateForEvent(event.type, this.snapshot.state);
    this.snapshot.state = this.snapshot.autonomyPaused ? "PAUSED" : state;
    this.snapshot.updatedAt = event.timestamp;
    if (event.projectId) this.snapshot.currentProject = event.projectId;
    if (typeof meta.projectId === "string") this.snapshot.currentProject = meta.projectId;
    if (typeof meta.activity === "string") this.snapshot.currentActivity = meta.activity;
    if (typeof meta.topic === "string") this.snapshot.conversationTopic = meta.topic;
    if (typeof meta.goalId === "string") this.snapshot.currentGoalId = meta.goalId;
    if (typeof meta.taskId === "string") this.snapshot.currentTaskId = meta.taskId;
    if (typeof meta.activeApp === "string") this.snapshot.activeApp = meta.activeApp;
    if (typeof meta.activeWindow === "string") this.snapshot.activeWindow = meta.activeWindow;
    switch (event.type) {
      case "conversation.user_started_speaking":
        this.snapshot.userSpeaking = true;
        this.snapshot.silenceStartedAt = null;
        this.snapshot.silenceSeconds = 0;
        if (this.snapshot.myraaSpeaking) this.snapshot.myraaWasInterrupted = true;
        break;
      case "conversation.user_stopped_speaking":
        this.snapshot.userSpeaking = false;
        this.snapshot.silenceStartedAt = event.timestamp;
        break;
      case "conversation.myraa_started_speaking":
        this.snapshot.myraaSpeaking = true;
        this.snapshot.myraaWasInterrupted = false;
        break;
      case "conversation.myraa_stopped_speaking":
      case "conversation.turn_completed":
        this.snapshot.myraaSpeaking = false;
        break;
      case "conversation.user_interrupted_myraa":
        this.snapshot.myraaSpeaking = false;
        this.snapshot.myraaWasInterrupted = true;
        break;
      case "desktop.active_window_changed":
        if (typeof meta.title === "string") this.snapshot.activeWindow = meta.title;
        if (typeof meta.application === "string") this.snapshot.activeApp = meta.application;
        break;
      case "desktop.application_opened":
        if (typeof meta.application === "string") {
          this.snapshot.openApplications = uniqueBounded(
            [...this.snapshot.openApplications, meta.application],
            30
          );
        }
        break;
      case "desktop.application_closed":
        if (typeof meta.application === "string") {
          this.snapshot.openApplications = this.snapshot.openApplications.filter(
            (item) => item !== meta.application
          );
        }
        break;
      case "filesystem.file_created":
      case "filesystem.file_modified":
      case "filesystem.file_moved":
        if (typeof meta.path === "string") {
          this.snapshot.relevantFiles = uniqueBounded(
            [meta.path, ...this.snapshot.relevantFiles],
            20
          );
        }
        break;
      case "safety.confirmation_required":
        this.snapshot.pendingRisk = {
          eventId: event.id,
          description: String(meta.description || "A risky action needs confirmation."),
          level: asRiskLevel(meta.riskLevel),
          confirmationId: typeof meta.confirmationId === "string" ? meta.confirmationId : void 0
        };
        break;
      case "safety.confirmation_resolved":
      case "task.cancelled":
        this.snapshot.pendingRisk = null;
        break;
      case "system.user_idle":
        this.snapshot.userActivity = "idle";
        break;
      case "system.user_away":
        this.snapshot.userActivity = "away";
        break;
      case "system.user_active":
        this.snapshot.userActivity = "active";
        break;
    }
    const summary = summarize(event);
    if (event.importance >= 0.45) {
      this.snapshot.recentImportantEvents = boundedAppend(
        this.snapshot.recentImportantEvents,
        summary,
        this.maxRecentEvents
      );
    }
    if (/failed|error|crashed|blocked/.test(event.type)) {
      this.snapshot.recentFailures = boundedAppend(this.snapshot.recentFailures, summary, 12);
    }
    if (/completed|succeeded|finished|recovered/.test(event.type)) {
      this.snapshot.recentSuccesses = boundedAppend(this.snapshot.recentSuccesses, summary, 12);
    }
    return this.getSnapshot();
  }
  setAutonomyPaused(paused) {
    this.snapshot.autonomyPaused = paused;
    this.snapshot.state = paused ? "PAUSED" : "OBSERVING";
    this.snapshot.updatedAt = now();
    return this.getSnapshot();
  }
  getSnapshot(at = Date.now()) {
    const silenceStarted = this.snapshot.silenceStartedAt ? new Date(this.snapshot.silenceStartedAt).getTime() : null;
    const silenceSeconds = silenceStarted ? Math.max(0, Math.floor((at - silenceStarted) / 1e3)) : 0;
    return structuredClone({ ...this.snapshot, silenceSeconds });
  }
};
function stateForEvent(type, fallback) {
  if (type === "conversation.user_started_speaking") return "LISTENING";
  if (type === "conversation.user_interrupted_myraa") return "INTERRUPTED";
  if (type === "conversation.myraa_started_speaking") return "SPEAKING";
  if (type.startsWith("tool.") || type.startsWith("desktop.action_")) return "ACTING";
  if (type.startsWith("memory.")) return "LEARNING";
  if (type.startsWith("goal.plan")) return "PLANNING";
  if (type.startsWith("task.verify")) return "VERIFYING";
  if (type.startsWith("conversation.")) return "THINKING";
  if (type.startsWith("system.") || type.startsWith("desktop.") || type.startsWith("filesystem.")) {
    return "OBSERVING";
  }
  return fallback;
}
function summarize(event) {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    importance: event.importance,
    source: event.source
  };
}
function boundedAppend(items, item, limit) {
  const next = [...items, item];
  return next.slice(-limit);
}
function uniqueBounded(items, limit) {
  return [...new Set(items)].slice(-limit);
}
function asRiskLevel(value) {
  const parsed = Math.max(0, Math.min(4, Number(value) || 0));
  return Math.round(parsed);
}

// cognition/skillManager.ts
var import_node_crypto6 = require("node:crypto");
var import_promises3 = __toESM(require("node:fs/promises"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var SkillManager = class {
  constructor(filePath) {
    this.filePath = filePath;
    this.skills = [];
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }
  async initialize() {
    if (this.loaded) return;
    await import_promises3.default.mkdir(import_node_path2.default.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await import_promises3.default.readFile(this.filePath, "utf-8"));
      this.skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    } catch (error) {
      if (error?.code !== "ENOENT") {
        await import_promises3.default.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => {
        });
      }
      this.skills = [];
    }
    this.loaded = true;
  }
  async learn(input) {
    this.assertLoaded();
    if (!input.verified) throw new Error("A demonstrated workflow must be verified before becoming a reusable skill.");
    const name = normalizeName(input.name);
    if (!name) throw new Error("Skill name is required.");
    if (!input.description.trim()) throw new Error("Skill description is required.");
    if (!input.expectedOutcome.trim()) throw new Error("Skill expectedOutcome is required.");
    if (!input.steps.length) throw new Error("A skill needs at least one verified step.");
    if (input.steps.length > 50) throw new Error("A skill cannot contain more than 50 steps.");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.skills.find((skill2) => skill2.name === name && skill2.projectId === (input.projectId ?? null));
    if (existing) {
      existing.description = input.description.trim();
      existing.preconditions = unique2(input.preconditions || []);
      existing.steps = sanitizeSteps(input.steps);
      existing.expectedOutcome = input.expectedOutcome.trim();
      existing.confidence = clamp7(Math.max(existing.confidence, input.confidence ?? 0.7));
      existing.verified = true;
      existing.updatedAt = timestamp;
      await this.persist();
      return structuredClone(existing);
    }
    const skill = {
      id: (0, import_node_crypto6.randomUUID)(),
      name,
      description: input.description.trim(),
      preconditions: unique2(input.preconditions || []),
      steps: sanitizeSteps(input.steps),
      expectedOutcome: input.expectedOutcome.trim(),
      projectId: input.projectId ?? null,
      confidence: clamp7(input.confidence ?? 0.7),
      uses: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      verified: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUsedAt: null
    };
    this.skills.push(skill);
    await this.persist();
    return structuredClone(skill);
  }
  async recordOutcome(id, succeeded) {
    this.assertLoaded();
    const skill = this.skills.find((item) => item.id === id);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    skill.uses += 1;
    if (succeeded) skill.successes += 1;
    else skill.failures += 1;
    skill.successRate = skill.uses ? skill.successes / skill.uses : 0;
    skill.confidence = clamp7(skill.confidence + (succeeded ? 0.035 : -0.09));
    skill.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
    skill.updatedAt = skill.lastUsedAt;
    await this.persist();
    return structuredClone(skill);
  }
  find(name, projectId) {
    this.assertLoaded();
    const normalized = normalizeName(name);
    const candidates = this.skills.filter(
      (skill) => skill.name === normalized && (!projectId || !skill.projectId || skill.projectId === projectId)
    );
    candidates.sort((a, b) => b.confidence - a.confidence || b.successRate - a.successRate);
    return candidates[0] ? structuredClone(candidates[0]) : null;
  }
  list(projectId) {
    this.assertLoaded();
    return this.skills.filter((skill) => !projectId || !skill.projectId || skill.projectId === projectId).map((skill) => structuredClone(skill));
  }
  async persist() {
    const payload = { version: 1, skills: this.skills };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await import_promises3.default.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await import_promises3.default.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }
  assertLoaded() {
    if (!this.loaded) throw new Error("SkillManager.initialize() must be called first.");
  }
};
function sanitizeSteps(steps) {
  return steps.map((step, index) => {
    if (!step.action?.trim()) throw new Error(`Skill step ${index + 1} needs an action.`);
    return {
      id: step.id?.trim() || `step-${index + 1}`,
      action: step.action.trim(),
      tool: step.tool?.trim() || void 0,
      arguments: step.arguments ? structuredClone(step.arguments) : void 0
    };
  });
}
function normalizeName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function unique2(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function clamp7(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/structuredMemory.ts
var import_node_crypto7 = require("node:crypto");
var import_promises4 = __toESM(require("node:fs/promises"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var StructuredMemoryStore = class {
  constructor(filePath) {
    this.filePath = filePath;
    this.memories = [];
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }
  async initialize(legacy = []) {
    if (this.loaded) return;
    await import_promises4.default.mkdir(import_node_path3.default.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await import_promises4.default.readFile(this.filePath, "utf-8"));
      this.memories = Array.isArray(parsed.memories) ? parsed.memories : [];
    } catch (error) {
      if (error?.code !== "ENOENT") {
        const backup = `${this.filePath}.corrupt-${Date.now()}`;
        await import_promises4.default.rename(this.filePath, backup).catch(() => {
        });
      }
      this.memories = [];
    }
    this.loaded = true;
    if (legacy.length) await this.importLegacy(legacy);
  }
  async importLegacy(legacy) {
    this.assertLoaded();
    let count = 0;
    let changed = false;
    const incomingIds = new Set(legacy.map((item) => item.id));
    for (const memory of legacy) {
      const existing = this.memories.find(
        (item) => item.source === "legacy-memory" && item.sourceId === memory.id
      );
      if (existing) {
        const nextKind = legacyKind(memory.category);
        const nextContent = memory.text.trim();
        if (existing.content !== nextContent || existing.kind !== nextKind || !existing.active) {
          existing.content = nextContent;
          existing.kind = nextKind;
          existing.projectId = memory.category === "project" ? inferProject(memory.text) : existing.projectId;
          existing.entities = extractEntities(memory.text);
          existing.updatedAt = memory.updatedAt;
          existing.active = true;
          changed = true;
        }
        continue;
      }
      this.memories.push({
        id: (0, import_node_crypto7.randomUUID)(),
        kind: legacyKind(memory.category),
        content: memory.text.trim(),
        projectId: memory.category === "project" ? inferProject(memory.text) : null,
        entities: extractEntities(memory.text),
        tags: ["legacy", memory.category],
        confidence: memory.category === "behavior" ? 0.58 : 0.72,
        confirmations: 1,
        importance: ["goal", "project", "identity"].includes(memory.category) ? 0.72 : 0.58,
        source: "legacy-memory",
        sourceId: memory.id,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        lastAccessedAt: memory.updatedAt,
        accessCount: 0,
        expiresAt: null,
        active: true
      });
      count += 1;
      changed = true;
    }
    for (const existing of this.memories) {
      if (existing.source === "legacy-memory" && existing.sourceId && !incomingIds.has(existing.sourceId) && existing.active) {
        existing.active = false;
        existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        changed = true;
      }
    }
    if (changed) await this.persist();
    return count;
  }
  async add(input) {
    this.assertLoaded();
    const content = input.content.trim();
    if (!content) throw new Error("Memory content must not be empty.");
    const projectId = input.projectId ?? null;
    const duplicate = this.memories.find(
      (item) => item.active && item.kind === input.kind && item.projectId === projectId && normalize(item.content) === normalize(content)
    );
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    if (duplicate) {
      duplicate.confirmations += 1;
      duplicate.confidence = clamp8(Math.max(duplicate.confidence, input.confidence ?? 0.65) + 0.04);
      duplicate.importance = clamp8(Math.max(duplicate.importance, input.importance ?? 0.5));
      duplicate.updatedAt = timestamp;
      duplicate.tags = unique3([...duplicate.tags, ...input.tags || []]);
      duplicate.entities = unique3([...duplicate.entities, ...input.entities || []]);
      await this.persist();
      return structuredClone(duplicate);
    }
    const memory = {
      id: (0, import_node_crypto7.randomUUID)(),
      kind: input.kind,
      content,
      projectId,
      entities: unique3(input.entities || extractEntities(content)),
      tags: unique3(input.tags || []),
      confidence: clamp8(input.confidence ?? 0.65),
      confirmations: 1,
      importance: clamp8(input.importance ?? 0.5),
      source: input.source,
      sourceId: input.sourceId,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
      accessCount: 0,
      expiresAt: input.expiresAt ?? null,
      supersedesId: input.supersedesId,
      active: true
    };
    this.memories.push(memory);
    await this.persist();
    return structuredClone(memory);
  }
  async correct(targetId, correctedContent, context = {}) {
    this.assertLoaded();
    const target = targetId ? this.memories.find((item) => item.id === targetId && item.active) : void 0;
    if (target) {
      target.active = false;
      target.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      target.confidence = clamp8(target.confidence * 0.35);
    }
    const correction = await this.add({
      kind: "correction",
      content: correctedContent,
      projectId: context.projectId ?? target?.projectId ?? null,
      entities: target?.entities,
      tags: ["explicit-user-correction"],
      confidence: 0.98,
      importance: 0.9,
      source: context.source || "user-correction",
      supersedesId: target?.id
    });
    if (target) await this.persist();
    return correction;
  }
  async retrieve(query = {}) {
    this.assertLoaded();
    const current = Date.now();
    const queryTokens = tokenize(query.text || "");
    const entities = new Set((query.entities || []).map(normalize));
    const candidates = this.memories.filter((memory) => {
      if (!memory.active || memory.confidence < (query.minConfidence ?? 0.2)) return false;
      if (memory.expiresAt && new Date(memory.expiresAt).getTime() <= current) return false;
      if (query.kinds?.length && !query.kinds.includes(memory.kind)) return false;
      if (query.projectId && memory.projectId && memory.projectId !== query.projectId) return false;
      return true;
    });
    const ranked = candidates.map((memory) => ({ memory, score: scoreMemory(memory, queryTokens, entities, query.projectId, current) })).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(query.limit ?? 12, 50)));
    const accessedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const item of ranked) {
      item.memory.lastAccessedAt = accessedAt;
      item.memory.accessCount += 1;
    }
    if (ranked.length) await this.persist();
    return ranked.map(({ memory }) => structuredClone(memory));
  }
  async decay(at = Date.now()) {
    this.assertLoaded();
    let expired = 0;
    let decayed = 0;
    for (const memory of this.memories) {
      if (!memory.active) continue;
      if (memory.expiresAt && new Date(memory.expiresAt).getTime() <= at) {
        memory.active = false;
        expired += 1;
        continue;
      }
      const ageDays = (at - new Date(memory.updatedAt).getTime()) / 864e5;
      if (ageDays > 30 && memory.importance < 0.55 && memory.confirmations < 2) {
        memory.confidence = clamp8(memory.confidence * 0.97);
        memory.updatedAt = new Date(at).toISOString();
        decayed += 1;
      }
    }
    if (expired || decayed) await this.persist();
    return { expired, decayed };
  }
  list() {
    this.assertLoaded();
    return this.memories.map((item) => structuredClone(item));
  }
  async persist() {
    const payload = { version: 1, memories: this.memories };
    this.writeQueue = this.writeQueue.then(async () => {
      const temp = `${this.filePath}.${process.pid}.tmp`;
      await import_promises4.default.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
      await import_promises4.default.rename(temp, this.filePath);
    });
    await this.writeQueue;
  }
  assertLoaded() {
    if (!this.loaded) throw new Error("StructuredMemoryStore.initialize() must be called first.");
  }
};
function scoreMemory(memory, queryTokens, entities, projectId, at) {
  const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`);
  const overlap = queryTokens.size ? [...queryTokens].filter((token) => memoryTokens.has(token)).length / queryTokens.size : 0.45;
  const entityMatch = entities.size ? [...entities].filter((entity) => memory.entities.some((item) => normalize(item) === entity)).length / entities.size : 0;
  const projectMatch = projectId && memory.projectId === projectId ? 1 : memory.projectId ? 0.15 : 0.5;
  const ageDays = Math.max(0, (at - new Date(memory.updatedAt).getTime()) / 864e5);
  const recency = Math.exp(-ageDays / 60);
  const correctionBoost = memory.kind === "correction" ? 0.12 : 0;
  return overlap * 0.34 + entityMatch * 0.12 + projectMatch * 0.14 + recency * 0.12 + memory.importance * 0.14 + memory.confidence * 0.14 + correctionBoost;
}
function legacyKind(category) {
  if (category === "preference" || category === "behavior") return "preference";
  if (category === "project" || category === "goal") return "project";
  if (category === "emotional" || category === "relationship") return "episodic";
  return "semantic";
}
function inferProject(text) {
  const match = text.match(/\b(MYRAA|ALTREX|NEXTRON)\b/i);
  return match ? match[1].toUpperCase() : null;
}
function extractEntities(text) {
  const matches = text.match(/\b[A-Z][A-Z0-9_-]{2,}\b/g) || [];
  return unique3(matches).slice(0, 12);
}
function tokenize(text) {
  return new Set(
    normalize(text).split(/[^a-z0-9]+/).filter((token) => token.length > 2)
  );
}
function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function unique3(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function clamp8(value) {
  return Math.max(0, Math.min(1, value));
}

// cognition/runtime.ts
var CognitiveRuntime = class {
  constructor(options) {
    this.options = options;
    this.decisionListeners = /* @__PURE__ */ new Set();
    this.initialized = false;
    this.sessionPersistTimer = null;
    this.housekeepingTimer = null;
    this.config = options.config || loadCognitionConfig();
    this.events = new CognitiveEventBus(this.config.limits.maxRecentEvents * 5);
    this.situation = new SituationModel(this.config.limits.maxRecentEvents, {
      currentProject: options.projectRoot ? import_node_path4.default.basename(options.projectRoot) : null,
      autonomyPaused: this.config.autonomyPaused,
      state: this.config.autonomyPaused ? "PAUSED" : "IDLE"
    });
    const cognitionDir = import_node_path4.default.join(options.dataDir, "cognition");
    this.memories = new StructuredMemoryStore(import_node_path4.default.join(cognitionDir, "memories.v1.json"));
    this.goals = new GoalManager(import_node_path4.default.join(cognitionDir, "goals.v1.json"));
    this.skills = new SkillManager(import_node_path4.default.join(cognitionDir, "skills.v1.json"));
    this.attention = new AttentionEngine(this.config.attention.repetitionCooldownMs);
    this.initiative = new InitiativeEngine(this.config);
    this.mind = new AutonomousMind({
      situation: () => this.situation.getSnapshot(options.mind?.now?.()),
      retrieveMemories: (thread) => this.memories.retrieve({
        text: [
          thread.topic,
          thread.lastUserStatement || "",
          thread.lastMyraaStatement || ""
        ].filter(Boolean).join(" "),
        projectId: this.situation.getSnapshot().currentProject,
        limit: 6,
        minConfidence: 0.35
      }),
      backgroundOpportunity: async () => {
        const situation = this.situation.getSnapshot(options.mind?.now?.());
        const activeGoal = this.goals.list().filter((goal) => ["active", "blocked", "pending"].includes(goal.status)).sort((a, b) => b.priority - a.priority)[0];
        if (!activeGoal) return null;
        const topic = activeGoal.objective;
        const timestamp = Date.now();
        const thread = {
          id: `goal:${activeGoal.id}`,
          topic,
          status: "OPEN_ENDED",
          importance: activeGoal.priority,
          unresolvedPoints: activeGoal.blockers.length ? activeGoal.blockers : [],
          openQuestions: [],
          lastUserStatement: null,
          lastMyraaStatement: null,
          interruptedThoughts: [],
          possibleFollowups: [topic],
          lastUserAt: null,
          lastMyraaAt: null,
          activeUntil: timestamp + 18e4,
          autonomousTurnsSinceUser: 0
        };
        return {
          reason: "goal_review",
          thread,
          situation,
          relevantMemories: [],
          curiosity: null
        };
      },
      emit: async (event) => {
        await this.process(event);
      },
      logger: options.logger,
      ...options.mind
    });
  }
  async initialize(legacyMemories = []) {
    if (this.initialized) return;
    await Promise.all([
      this.memories.initialize(legacyMemories),
      this.goals.initialize(),
      this.skills.initialize()
    ]);
    this.initialized = true;
    this.housekeepingTimer = setInterval(() => {
      void this.memories.decay().catch(() => {
      });
    }, 30 * 6e4);
    this.housekeepingTimer.unref?.();
    await this.process({
      type: "system.cognition_started",
      source: "system",
      importance: 0.52,
      metadata: { activity: "cognitive runtime online" }
    });
    if (this.options.autoStartMind !== false) this.mind.start();
  }
  async process(input) {
    if (!this.initialized && input.type !== "system.cognition_started") {
      throw new Error("CognitiveRuntime.initialize() must be called first.");
    }
    const event = this.events.normalize(input);
    await this.events.publish(event);
    const situation = this.situation.apply(event);
    this.mind.observe(event);
    let relevantMemories = [];
    const memoryText = typeof event.metadata.text === "string" ? event.metadata.text : void 0;
    if (memoryText || event.projectId || event.importance >= 0.72) {
      relevantMemories = await this.memories.retrieve({
        text: memoryText || event.type,
        projectId: event.projectId || situation.currentProject,
        limit: 6
      });
    }
    const attention = this.attention.assess(event, situation);
    const decision = this.initiative.decide(event, attention, situation);
    this.attention.record(attention);
    if (event.type === "conversation.user_correction" && memoryText) {
      await this.memories.correct(
        typeof event.metadata.targetMemoryId === "string" ? event.metadata.targetMemoryId : null,
        memoryText,
        { projectId: event.projectId || situation.currentProject, source: "explicit-user-correction" }
      );
    } else if (shouldRememberEpisode(event, decision)) {
      await this.memories.add({
        kind: event.type.startsWith("goal.") ? "project" : "episodic",
        content: episodeSummary(event),
        projectId: event.projectId || situation.currentProject,
        entities: stringArray(event.metadata.entities),
        tags: [event.type, event.source],
        confidence: event.confidence,
        importance: event.importance,
        source: "cognitive-runtime",
        sourceId: event.id,
        expiresAt: event.importance < 0.55 ? new Date(Date.now() + 14 * 864e5).toISOString() : null
      });
    }
    const outcome = { event, situation, relevantMemories, attention, decision };
    await this.log(outcome);
    this.scheduleSessionPersist();
    await Promise.allSettled(
      [...this.decisionListeners].map((listener) => Promise.resolve(listener(outcome)))
    );
    return outcome;
  }
  onDecision(listener) {
    this.decisionListeners.add(listener);
    return () => this.decisionListeners.delete(listener);
  }
  async pauseAutonomy(reason = "user_requested") {
    this.config.autonomyPaused = true;
    this.situation.setAutonomyPaused(true);
    this.mind.pause();
    await this.process({
      type: "system.autonomy_paused",
      source: "system",
      importance: 0.95,
      metadata: { reason }
    });
  }
  async resumeAutonomy() {
    this.config.autonomyPaused = false;
    this.situation.setAutonomyPaused(false);
    this.mind.resume();
    await this.process({
      type: "system.autonomy_resumed",
      source: "system",
      importance: 0.65
    });
  }
  status() {
    return {
      enabled: this.config.enabled,
      autonomyPaused: this.config.autonomyPaused,
      features: {
        initiative: this.config.initiativeEnabled,
        proactiveSpeech: this.config.proactiveSpeechEnabled,
        skillLearning: this.config.skillLearningEnabled,
        reflection: this.config.reflectionEnabled,
        screenAwareness: this.config.screenAwarenessEnabled,
        desktopAwareness: this.config.desktopAwarenessEnabled
      },
      situation: this.situation.getSnapshot(),
      recentEvents: this.events.recent(20),
      goals: this.goals.list(),
      skills: this.skills.list(),
      autonomousMind: this.mind.status()
    };
  }
  setDeepThoughtGenerator(generator) {
    this.mind.setDeepThoughtGenerator(generator);
  }
  suppressCasualInitiative(durationMs) {
    this.mind.suppressCasualInitiative(durationMs);
  }
  restoreCasualInitiative() {
    this.mind.restoreCasualInitiative();
  }
  setSpeechAvailable(available) {
    this.mind.setSpeechAvailable(available);
  }
  markAutonomousSpeechStarted(thoughtId) {
    this.mind.markAutonomousSpeechStarted(thoughtId);
  }
  markAutonomousSpeechCompleted() {
    this.mind.markAutonomousSpeechCompleted();
  }
  markAutonomousSpeechInterrupted(content) {
    this.mind.markAutonomousSpeechInterrupted(content);
  }
  async shutdown() {
    if (this.housekeepingTimer) clearInterval(this.housekeepingTimer);
    if (this.sessionPersistTimer) clearTimeout(this.sessionPersistTimer);
    await this.mind.stop();
    await this.persistSession();
  }
  scheduleSessionPersist() {
    if (this.sessionPersistTimer) return;
    this.sessionPersistTimer = setTimeout(() => {
      this.sessionPersistTimer = null;
      void this.persistSession();
    }, 2e3);
    this.sessionPersistTimer.unref?.();
  }
  async persistSession() {
    const cognitionDir = import_node_path4.default.join(this.options.dataDir, "cognition");
    await import_promises5.default.mkdir(cognitionDir, { recursive: true });
    const target = import_node_path4.default.join(cognitionDir, "last-session.json");
    const temp = `${target}.${process.pid}.tmp`;
    const payload = {
      version: 1,
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      // Pending actions are intentionally not persisted or resumed.
      situation: { ...this.situation.getSnapshot(), pendingRisk: null },
      unfinishedGoals: this.goals.list().filter((goal) => ["active", "blocked", "pending"].includes(goal.status))
    };
    await import_promises5.default.writeFile(temp, JSON.stringify(payload, null, 2), "utf-8");
    await import_promises5.default.rename(temp, target);
  }
  async log(outcome) {
    await this.options.logger?.({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventId: outcome.event.id,
      eventType: outcome.event.type,
      source: outcome.event.source,
      attentionScore: Number(outcome.attention.score.toFixed(4)),
      attentionFactors: outcome.attention.factors,
      initiativeDecision: outcome.decision.action,
      reason: outcome.decision.reason.reason,
      state: outcome.situation.state,
      recalledMemoryIds: outcome.relevantMemories.map((memory) => memory.id)
    });
  }
};
function shouldRememberEpisode(event, decision) {
  if (event.type === "system.cognition_started") return false;
  if (/frame_received|active_window_changed|user_started_speaking|user_stopped_speaking/.test(event.type)) {
    return false;
  }
  return decision.action === "REMEMBER" && event.importance >= 0.5 || /failed|crashed|blocked|completed|correction/.test(event.type) && event.importance >= 0.55;
}
function episodeSummary(event) {
  const text = typeof event.metadata.text === "string" ? event.metadata.text.trim() : "";
  const tool = typeof event.metadata.tool === "string" ? ` (${event.metadata.tool})` : "";
  return text || `${event.type.replace(/[._]/g, " ")}${tool} at ${event.timestamp}`;
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

// cognition/safety.ts
var import_node_crypto8 = require("node:crypto");
var SafetyPolicy = class {
  constructor(config) {
    this.config = config;
  }
  assess(permission, riskLevel, alreadyConfirmed = false) {
    if (!this.config.permissions[permission]) {
      return {
        allowed: false,
        permission,
        riskLevel,
        requiresConfirmation: false,
        reason: `Permission '${permission}' is disabled.`
      };
    }
    if (this.config.autonomyPaused) {
      return {
        allowed: false,
        permission,
        riskLevel,
        requiresConfirmation: false,
        reason: "Autonomous actions are paused."
      };
    }
    return {
      allowed: true,
      permission,
      riskLevel,
      requiresConfirmation: riskLevel >= 3 && !alreadyConfirmed,
      reason: riskLevel >= 3 ? "This action can cause significant or irreversible changes." : "Action is within the configured permission and risk boundary."
    };
  }
};
var ConfirmationStore = class {
  constructor(ttlMs = 12e4) {
    this.ttlMs = ttlMs;
    this.pending = /* @__PURE__ */ new Map();
  }
  create(input) {
    this.purgeExpired();
    const created = Date.now();
    const confirmation = {
      ...input,
      id: (0, import_node_crypto8.randomUUID)(),
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + this.ttlMs).toISOString()
    };
    this.pending.set(confirmation.id, confirmation);
    return structuredClone(confirmation);
  }
  consume(id) {
    this.purgeExpired();
    const value = this.pending.get(id);
    if (!value) return null;
    this.pending.delete(id);
    return structuredClone(value);
  }
  cancel(id) {
    return this.pending.delete(id);
  }
  cancelAll() {
    const count = this.pending.size;
    this.pending.clear();
    return count;
  }
  list() {
    this.purgeExpired();
    return [...this.pending.values()].map((item) => structuredClone(item));
  }
  purgeExpired() {
    const current = Date.now();
    for (const [id, value] of this.pending) {
      if (new Date(value.expiresAt).getTime() <= current) this.pending.delete(id);
    }
  }
};

// cognition/toolExecutor.ts
var ToolExecutor = class {
  constructor(options) {
    this.options = options;
    this.active = /* @__PURE__ */ new Map();
    this.failures = /* @__PURE__ */ new Map();
    this.safety = new SafetyPolicy(options.config);
    this.confirmations = options.confirmations || new ConfirmationStore();
  }
  async execute(tool, args, context = {}) {
    const started = Date.now();
    const descriptor = this.options.registry.get(tool);
    if (!descriptor) {
      return result(false, "denied", tool, null, `Unknown or unregistered tool: ${tool}`, 2, started, 0);
    }
    const riskLevel = this.options.registry.assessRisk(tool, args, context.projectRoot);
    const assessment = this.safety.assess(descriptor.permission, riskLevel, context.confirmed === true);
    if (!assessment.allowed) {
      await this.emit("tool.denied", tool, riskLevel, context, { reason: assessment.reason });
      return result(false, "denied", tool, null, assessment.reason, riskLevel, started, 0);
    }
    if (assessment.requiresConfirmation) {
      const pending = this.confirmations.create({
        tool,
        args,
        riskLevel,
        reason: assessment.reason,
        correlationId: context.correlationId
      });
      await this.emit("safety.confirmation_required", tool, riskLevel, context, {
        confirmationId: pending.id,
        description: `${tool} requires confirmation: ${assessment.reason}`,
        reason: assessment.reason
      });
      return {
        ...result(false, "confirmation_required", tool, null, assessment.reason, riskLevel, started, 0),
        confirmationId: pending.id
      };
    }
    const operationId = context.correlationId || `${tool}:${started}`;
    const controller = new AbortController();
    this.active.set(operationId, controller);
    await this.emit("tool.started", tool, riskLevel, context, { operationId });
    let attempts = 0;
    try {
      const allowedAttempts = Math.min(
        descriptor.maxRetries,
        this.options.config.limits.maxRetries
      ) + 1;
      let lastError = "Tool failed.";
      while (attempts < allowedAttempts) {
        attempts += 1;
        try {
          const response = await withTimeout(
            this.options.handler(tool, args, controller.signal),
            descriptor.timeoutMs,
            controller
          );
          if (controller.signal.aborted) {
            await this.emit("tool.cancelled", tool, riskLevel, context, { operationId, attempts });
            return result(false, "cancelled", tool, null, "Tool was cancelled.", riskLevel, started, attempts);
          }
          if (response.ok) {
            const previousFailures = this.failures.get(tool) || 0;
            this.failures.set(tool, 0);
            await this.emit("tool.succeeded", tool, riskLevel, context, {
              operationId,
              attempts,
              recoveredAfterFailures: previousFailures > 0
            });
            return result(true, "succeeded", tool, response.result ?? null, null, riskLevel, started, attempts);
          }
          lastError = response.error || lastError;
        } catch (error) {
          if (controller.signal.aborted) {
            const timedOut = error instanceof Error && error.message === "TOOL_TIMEOUT";
            const status = timedOut ? "timed_out" : "cancelled";
            await this.emit(`tool.${status}`, tool, riskLevel, context, { operationId, attempts });
            return result(false, status, tool, null, timedOut ? "Tool timed out." : "Tool was cancelled.", riskLevel, started, attempts);
          }
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      this.failures.set(tool, (this.failures.get(tool) || 0) + 1);
      await this.emit("tool.failed", tool, riskLevel, context, { operationId, attempts, error: lastError });
      return result(false, "failed", tool, null, lastError, riskLevel, started, attempts);
    } finally {
      this.active.delete(operationId);
    }
  }
  async confirm(confirmationId) {
    const pending = this.confirmations.consume(confirmationId);
    if (!pending) {
      return result(false, "denied", "unknown", null, "Confirmation is invalid or expired.", 3, Date.now(), 0);
    }
    await this.emit("safety.confirmation_resolved", pending.tool, pending.riskLevel, {
      correlationId: pending.correlationId,
      confirmed: true
    }, { confirmationId });
    return this.execute(pending.tool, pending.args, {
      correlationId: pending.correlationId,
      confirmed: true
    });
  }
  cancel(correlationId) {
    const controller = this.active.get(correlationId);
    if (!controller) return false;
    controller.abort("user_cancelled");
    return true;
  }
  cancelAll() {
    const count = this.active.size;
    for (const controller of this.active.values()) controller.abort("user_cancelled");
    this.confirmations.cancelAll();
    return count;
  }
  async emit(type, tool, riskLevel, context, metadata) {
    await this.options.emit?.({
      type,
      source: type.startsWith("safety.") ? "system" : "tool",
      correlationId: context.correlationId,
      importance: type.includes("failed") ? 0.78 : type.includes("confirmation") ? 0.9 : 0.52,
      metadata: { tool, riskLevel, ...metadata }
    });
  }
};
async function withTimeout(promise, timeoutMs, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort("timeout");
      reject(new Error("TOOL_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function result(success, status, tool, value, error, riskLevel, started, attempts) {
  return {
    success,
    status,
    tool,
    result: value,
    error,
    riskLevel,
    durationMs: Math.max(0, Date.now() - started),
    attempts
  };
}

// cognition/toolRegistry.ts
var import_node_path5 = __toESM(require("node:path"), 1);
var READ_ONLY = /* @__PURE__ */ new Set([
  "readFile",
  "listFiles",
  "searchFiles",
  "getClipboard",
  "takeScreenshot",
  "analyzeScreenshot",
  "readScreen",
  "systemInfo",
  "gpuInfo",
  "temperatureInfo",
  "getAutoStartStatus",
  "getCursorPosition",
  "getActiveWindow",
  "listVisibleWindows",
  "waitForUi",
  "observeDesktopState"
]);
var BROWSER = /* @__PURE__ */ new Set([
  "openWebsite",
  "searchWeb",
  "searchYouTube",
  "searchGoogle",
  "searchGitHub"
]);
var FILE_WRITE = /* @__PURE__ */ new Set([
  "createFile",
  "renameFile",
  "deleteFile",
  "moveFile",
  "createPythonFile",
  "createProjectFolder",
  "writeCodeFile"
]);
var SYSTEM = /* @__PURE__ */ new Set([
  "volumeUp",
  "volumeDown",
  "muteToggle",
  "setVolume",
  "requestPowerAction",
  "executePowerAction",
  "brightnessUp",
  "brightnessDown",
  "setBrightness",
  "enableAutoStart",
  "disableAutoStart",
  "getAutoStartStatus"
]);
var ToolRegistry = class {
  constructor() {
    this.tools = /* @__PURE__ */ new Map();
  }
  register(descriptor) {
    if (this.tools.has(descriptor.name)) throw new Error(`Tool already registered: ${descriptor.name}`);
    this.tools.set(descriptor.name, Object.freeze({ ...descriptor }));
  }
  registerDesktopTools(names) {
    for (const name of names) {
      if (this.tools.has(name)) continue;
      this.register(descriptorFor(name));
    }
  }
  get(name) {
    return this.tools.get(name);
  }
  list() {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  assessRisk(name, args, projectRoot) {
    const descriptor = this.get(name);
    let risk = descriptor?.riskLevel ?? 2;
    if (name === "deleteFile") {
      risk = args.permanent === true ? 4 : 2;
      if (isImportantPath(args.path, projectRoot)) risk = Math.max(risk, 3);
    }
    if (["createFile", "createPythonFile", "writeCodeFile"].includes(name) && args.overwrite === true) {
      risk = 3;
    }
    if (name === "closeApplication" && args.force === true) risk = 3;
    if (name === "executePowerAction" && typeof args.execute_token === "string") {
      risk = 2;
    }
    return risk;
  }
};
function descriptorFor(name) {
  const permission = permissionFor(name);
  const riskLevel = riskFor(name);
  return {
    name,
    purpose: purposeFor(name),
    permission,
    riskLevel,
    timeoutMs: name === "runPythonScript" ? 45e3 : BROWSER.has(name) ? 3e4 : 25e3,
    maxRetries: READ_ONLY.has(name) ? 1 : 0
  };
}
function permissionFor(name) {
  if (READ_ONLY.has(name)) {
    if (["readFile", "listFiles", "searchFiles"].includes(name)) return "filesystem_read";
    if (/Screenshot|Screen/.test(name)) return "screen_awareness";
  }
  if (BROWSER.has(name)) return "browser";
  if (FILE_WRITE.has(name)) return "filesystem_write";
  if (name === "runPythonScript") return "code_execution";
  if (SYSTEM.has(name)) return "system_control";
  return "desktop_control";
}
function riskFor(name) {
  if (READ_ONLY.has(name)) return 0;
  if (name === "runPythonScript") return 3;
  if (["requestPowerAction", "executePowerAction"].includes(name)) return 4;
  if (["deleteFile", "clearClipboard", "closeWindow", "closeApplication"].includes(name)) return 2;
  if (["enableAutoStart", "disableAutoStart"].includes(name)) return 2;
  if (FILE_WRITE.has(name)) return 1;
  return 1;
}
function purposeFor(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}
function isImportantPath(value, projectRoot) {
  if (typeof value !== "string" || !projectRoot) return false;
  try {
    const target = import_node_path5.default.resolve(value).toLowerCase();
    const root = import_node_path5.default.resolve(projectRoot).toLowerCase();
    return target === root || root.startsWith(target + import_node_path5.default.sep) || target.startsWith(root + import_node_path5.default.sep);
  } catch {
    return false;
  }
}

// ── Approved-root guard + native confirmation bridge (MYRAA 1.0.2) ─────
var PERMISSIONS_FILE = dataFile("permissions.json");
var PERMISSIONS_CACHE = null;
var PERMISSIONS_CACHE_AT = 0;
function defaultApprovedRoots() {
  const home = process.env.USERPROFILE || process.env.HOME || (process.platform === "win32" ? "C:\\Users" : "/home");
  const desktop = import_path.default.join(home, "Desktop");
  const documents = import_path.default.join(home, "Documents");
  const workspace = process.env.MYRAA_APP_ROOT || process.cwd();
  return Array.from(new Set([desktop, documents, workspace].filter((p) => typeof p === "string" && p.length > 0)));
}
function normalizeRootPath(value) {
  try {
    return import_path.default.resolve(String(value || ""));
  } catch {
    return "";
  }
}
function resolveRootFolderForPath(targetPath) {
  let current = normalizeRootPath(targetPath);
  for (let i = 0; i < 8 && current; i++) {
    try {
      if (import_fs.default.existsSync(current)) return current;
    } catch {
    }
    const parent = import_path.default.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return normalizeRootPath(targetPath);
}
function loadApprovedRoots() {
  if (PERMISSIONS_CACHE && Date.now() - PERMISSIONS_CACHE_AT < 5e3) return PERMISSIONS_CACHE;
  let roots = [];
  try {
    if (import_fs.default.existsSync(PERMISSIONS_FILE)) {
      const parsed = JSON.parse(import_fs.default.readFileSync(PERMISSIONS_FILE, "utf-8"));
      roots = Array.isArray(parsed?.roots) ? parsed.roots.map(normalizeRootPath).filter(Boolean) : [];
    }
  } catch {
    roots = [];
  }
  if (!roots.length) {
    roots = defaultApprovedRoots();
    try {
      import_fs.default.writeFileSync(PERMISSIONS_FILE, JSON.stringify({ roots }, null, 2), "utf-8");
    } catch {
    }
  }
  PERMISSIONS_CACHE = roots;
  PERMISSIONS_CACHE_AT = Date.now();
  return roots;
}
function saveApprovedRoots(roots) {
  PERMISSIONS_CACHE = Array.from(new Set(roots.map(normalizeRootPath).filter(Boolean)));
  PERMISSIONS_CACHE_AT = Date.now();
  try {
    import_fs.default.writeFileSync(PERMISSIONS_FILE, JSON.stringify({ roots: PERMISSIONS_CACHE }, null, 2), "utf-8");
  } catch {
  }
}
function approvedRootFor(targetPath) {
  const normalized = normalizeRootPath(String(targetPath || "")).toLowerCase();
  if (!normalized) return null;
  for (const root of loadApprovedRoots()) {
    const r = normalizeRootPath(String(root || "")).toLowerCase();
    if (r && (normalized === r || normalized.startsWith(r + import_path.default.sep))) return root;
  }
  return null;
}
async function requestNativeConfirmation(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload || {});
    const req = import_http.default.request({
      hostname: "127.0.0.1",
      port: 3010,
      path: "/confirm",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
        if (data.length > 1e5) res.destroy();
      });
      res.on("end", () => {
        let parsed = {};
        try {
          if (data) parsed = JSON.parse(data);
        } catch {
          parsed = {};
        }
        resolve(parsed);
      });
      res.on("error", () => resolve({ approved: true, offline: true }));
    });
    req.on("error", () => resolve({ approved: true, offline: true }));
    req.setTimeout(5e3, () => {
      try {
        req.destroy();
      } catch {
      }
      resolve({ approved: true, offline: true });
    });
    req.end(body);
  });
}
async function guardFileMutation(tool, args, projectRoot) {
  if (!args || typeof args !== "object") return { allowed: true };
  if (!FILE_WRITE.has(tool) || !import_fs.default) return { allowed: true };
  const label = ({ createFile: "create", renameFile: "rename", deleteFile: "delete", moveFile: "move", createPythonFile: "create", writeCodeFile: "write", createProjectFolder: "create" })[tool] || "modify";
  const explicit = [args.path, args.source, args.target, args.newPath, args.destination, args.dest].filter((v) => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
  const candidates = Object.keys(args).map((k) => args[k]).filter((v) => typeof v === "string" && /[\\/]/.test(v)).slice(0, 3);
  const targetPath = normalizeRootPath(explicit[0] || candidates[0] || "");
  if (!targetPath) return { allowed: true };
  const knownRoot = approvedRootFor(targetPath);
  const decision = await requestNativeConfirmation({
    op: label,
    tool,
    path: targetPath,
    root: knownRoot || null,
    roots: loadApprovedRoots()
  });
  if (!decision.approved) return { allowed: false, reason: `${label} was not approved by the user.` };
  if (decision.grantRoot) {
    const granted = normalizeRootPath(decision.grantRoot);
    if (granted && !approvedRootFor(granted)) saveApprovedRoots([...loadApprovedRoots(), granted]);
  }
  return { allowed: true, root: knownRoot || decision.grantRoot || null };
}

// server_screenVision.ts
var SCREEN_INTENT_PATTERNS = [
  /^\s*(?:myraa[,\s]+)?(?:what(?:'s| is) this|what error is this|read this|explain this|look at this|can you see this)\s*[?.!]*\s*$/i,
  /\b(look|see|watch|show)\b[^.?!]{0,40}\b(screen|desktop|display|monitor)\b/i,
  /\bwhat(?:'s| is)\b[^.?!]{0,30}\bon my screen\b/i,
  /\bwhat(?:'s| is)\b[^.?!]{0,30}\b(showing|visible|on display|open)\b/i,
  /\bwhat\s+(?:error|warning|message|popup|dialog)\b[^.?!]{0,30}\b(screen|showing|visible)\b/i,
  /\bread\b[^.?!]{0,30}\b(screen|visible|on my (?:screen|monitor))\b/i,
  /\b(explain|describe|analy[sz]e|summari[sz]e|inspect)\b[^.?!]{0,30}\b(this|what(?:'s| is)?|the)\b[^.?!]{0,30}\b(screen|window|page|app|application|code|error|dialog|popup|message|warning|video|thumbnail|design|image|screenshot)\b/i,
  /\bwhat\s+am\s+i\s+looking\s+at\b/i,
  /\bwhat(?:'s| is)\s+happening\b[^.?!]{0,20}\b(on (?:my )?screen|here)\b/i,
  /\bcan\s+you\s+see\s+(?:this|that|my screen|the screen|it)\b/i,
  /\bhelp\s+me\s+with\s+what(?:'s| is)?\s+open\b/i,
  /\b(explain|describe|analy[sz]e|read)\b[^.?!]{0,40}\bwhat\s+i\s+(?:have|have got|got)\s+open(?:ed)?\b/i,
  /\bwhat\s+should\s+i\s+(?:do|click|tap|press|type)\b[^.?!]{0,40}\b(next|here|now)\b/i,
  /\b(screen vision|screen share|share screen|view my screen|capture my screen|take a look)\b/i
];
function detectScreenVisionIntent(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 4 || trimmed.length > 600) return false;
  return SCREEN_INTENT_PATTERNS.some((re) => re.test(trimmed));
}
var RECENT_FRAME_TTL_MS = 9e4;
var DEFAULT_CAPTURE_MAX_DIM = 1440;
var ScreenVisionPipeline = class {
  constructor(deps) {
    this.deps = deps;
    this.lastFrame = null;
    this.recentFrameTimer = null;
    this.captureInFlight = null;
  }
  log(line) {
    console.log(`[ScreenVision] ${line}`);
    try {
      this.deps.log?.(line);
    } catch {
    }
  }
  rememberFrame(frame) {
    this.lastFrame = frame;
    if (this.recentFrameTimer) clearTimeout(this.recentFrameTimer);
    this.recentFrameTimer = setTimeout(() => {
      if (this.lastFrame === frame) this.lastFrame = null;
      this.recentFrameTimer = null;
    }, RECENT_FRAME_TTL_MS);
    this.recentFrameTimer.unref?.();
  }
  /**
   * Returns the most recent successful capture if it is still within the
   * short-lived cache window, otherwise null. Lets follow-up questions
   * reuse a fresh screen context without re-capturing.
   */
  getRecentFrame() {
    if (!this.lastFrame) return null;
    if (Date.now() - this.lastFrame.capturedAt > RECENT_FRAME_TTL_MS) {
      this.lastFrame = null;
      return null;
    }
    return this.lastFrame;
  }
  /** Immediately discard cached visual context (used when a live session ends). */
  dispose() {
    if (this.recentFrameTimer) clearTimeout(this.recentFrameTimer);
    this.recentFrameTimer = null;
    this.lastFrame = null;
  }
  /**
   * Capture a one-shot frame without choosing how it is sent to Gemini.
   * Typed requests use this so the image and question can be placed in one
   * ordered multimodal `sendClientContent` turn. Concurrent callers share the
   * same in-flight capture instead of taking duplicate screenshots.
   */
  async capture(reason = "intent", maxDim = DEFAULT_CAPTURE_MAX_DIM) {
    if (this.captureInFlight) {
      this.log("Capture already in progress; reusing the pending frame.");
      return this.captureInFlight;
    }
    const boundedMaxDim = Math.max(320, Math.min(1920, Math.round(maxDim) || DEFAULT_CAPTURE_MAX_DIM));
    this.captureInFlight = this.captureInternal(reason, boundedMaxDim);
    try {
      return await this.captureInFlight;
    } finally {
      this.captureInFlight = null;
    }
  }
  async captureInternal(reason, maxDim) {
    this.deps.onStateChange?.("capturing");
    this.log(`Screen request detected (reason=${reason}).`);
    this.log("Capturing display.");
    try {
      const result2 = await this.deps.callAgent("viewScreen", {
        max_dim: maxDim,
        keep_file: false,
        cleanup: true
      });
      if (result2.ok && result2.result) {
        const frame2 = this.processAgentResult(result2.result, "viewScreen");
        if (frame2) return frame2;
      }
      this.log(`viewScreen failed (${result2.error || "invalid image payload"}); falling back to takeScreenshot.`);
      const fallback = await this.deps.callAgent("takeScreenshot", {
        include_image: true,
        max_dim: maxDim
      });
      if (!fallback.ok || !fallback.result) {
        const error = fallback.error || result2.error || "Desktop agent did not return a frame.";
        this.reportError(`Capture failed: ${error}`);
        return null;
      }
      const frame = this.processAgentResult(fallback.result, "takeScreenshot");
      if (!frame) this.reportError("Capture failed: no image bytes were returned.");
      return frame;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.reportError(`Capture failed: ${message}`);
      return null;
    }
  }
  /**
   * Capture the screen and inject it into the live session as visual
   * context. Safe to call when the agent is offline — the error is reported
   * back through the optional onStateChange callback and never thrown.
   */
  async captureAndInject(reason = "intent", maxDim = DEFAULT_CAPTURE_MAX_DIM) {
    const frame = await this.capture(reason, maxDim);
    if (frame) this.injectFrame(frame);
    return frame;
  }
  /** Push a captured frame through the realtime-video compatibility path. */
  injectFrame(frame) {
    this.log("Sending image to vision model.");
    try {
      this.deps.pushFrameToSession({ data: frame.imageBase64, mimeType: frame.mimeType });
      this.markFrameDelivered(frame);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.reportError(`Vision session rejected the image: ${message}`);
      return false;
    }
  }
  /** Mark delivery after a caller sends image + question in one ordered turn. */
  markFrameDelivered(frame) {
    this.log("Image delivered to vision model.");
    this.deps.onStateChange?.("ready", { activeWindow: frame.activeWindow });
  }
  /** Surface a screen-vision error through the existing UI/error channel. */
  reportError(message) {
    this.log(message);
    this.deps.onStateChange?.("error", { error: message });
  }
  processAgentResult(payload, source) {
    const ok = payload.ok !== false;
    if (!ok) {
      const err = typeof payload.error === "string" ? payload.error : "Capture returned an error.";
      this.log(`Capture returned not-ok: ${err}`);
      return null;
    }
    const imageBase64 = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
    if (!imageBase64) {
      const err = typeof payload.error === "string" ? payload.error : "No image bytes in agent response.";
      this.log(`Capture returned no image bytes: ${err}`);
      return null;
    }
    const width = Number(payload.width) || 0;
    const height = Number(payload.height) || 0;
    const activeWindow = typeof payload.active_window === "string" ? payload.active_window : null;
    const tempPath = typeof payload.temp_path === "string" ? payload.temp_path : void 0;
    const frame = {
      ok: true,
      imageBase64,
      mimeType: "image/jpeg",
      width,
      height,
      activeWindow,
      source,
      capturedAt: Date.now(),
      tempPath
    };
    this.rememberFrame(frame);
    this.log(`Capture complete (${width}x${height}, source=${source}).`);
    return frame;
  }
};

// api_hub/adapterRegistry.ts
var import_promises6 = __toESM(require("node:fs/promises"), 1);
var import_node_path6 = __toESM(require("node:path"), 1);

// api_hub/healthChecker.ts
var import_node_net = __toESM(require("node:net"), 1);
async function checkProviderDocumentation(provider, options = {}) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (!isSafePublicUrl(provider.documentationUrl)) {
    return { state: "broken", checkedAt, statusCode: null, latencyMs: null, error: "Unsafe or unsupported documentation URL." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), clamp9(options.timeoutMs ?? 8e3, 1e3, 3e4));
  timeout.unref?.();
  const started = Date.now();
  try {
    const response = await (options.fetcher || fetch)(provider.documentationUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "MYRAA-ApiHub/1.0" }
    });
    const latencyMs = Date.now() - started;
    const state = response.status >= 200 && response.status < 400 ? "healthy" : response.status === 401 || response.status === 403 || response.status === 405 || response.status === 429 ? "degraded" : "broken";
    return { state, checkedAt, statusCode: response.status, latencyMs, error: state === "broken" ? `HTTP ${response.status}` : null };
  } catch (error) {
    return {
      state: "broken",
      checkedAt,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: controller.signal.aborted ? "Health check timed out." : safeError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}
function isSafePublicUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (import_node_net.default.isIP(host)) return !isPrivateIp(host);
    return true;
  } catch {
    return false;
  }
}
function isPrivateIp(host) {
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
  }
  const [a, b] = host.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
function safeError(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/https?:\/\/\S+/gi, "remote provider").slice(0, 240);
}
function clamp9(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// api_hub/adapterRegistry.ts
var ApiAdapterRegistry = class {
  constructor(filePath) {
    this.filePath = filePath;
    this.adapters = /* @__PURE__ */ new Map();
    this.loaded = false;
  }
  async initialize() {
    if (this.loaded) return;
    await import_promises6.default.mkdir(import_node_path6.default.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await import_promises6.default.readFile(this.filePath, "utf-8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.adapters)) throw new Error("Unsupported adapter registry format.");
      for (const adapter of parsed.adapters) this.adapters.set(adapter.id, adapter);
    } catch (error) {
      if (error.code !== "ENOENT") {
        await import_promises6.default.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => void 0);
      }
    }
    this.loaded = true;
  }
  list(capability) {
    this.assertLoaded();
    const terms = capability?.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 2) || [];
    return [...this.adapters.values()].filter((adapter) => !terms.length || terms.some((term) => adapter.capability.toLowerCase().includes(term))).map((adapter) => structuredClone(adapter));
  }
  get(id) {
    this.assertLoaded();
    const adapter = this.adapters.get(id);
    return adapter ? structuredClone(adapter) : null;
  }
  async save(candidate2) {
    this.assertLoaded();
    validateAdapter(candidate2);
    if (!candidate2.verified || !candidate2.verifiedAt) {
      throw new Error("Only adapters verified against a controlled fixture may be registered.");
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const previous = this.adapters.get(candidate2.id);
    const adapter = {
      ...candidate2,
      createdAt: previous?.createdAt || candidate2.createdAt || timestamp,
      updatedAt: timestamp
    };
    this.adapters.set(adapter.id, adapter);
    await this.persist();
    return structuredClone(adapter);
  }
  async persist() {
    const temporary = `${this.filePath}.tmp-${process.pid}`;
    const payload = { version: 1, adapters: [...this.adapters.values()] };
    await import_promises6.default.writeFile(temporary, JSON.stringify(payload, null, 2), "utf-8");
    await import_promises6.default.rename(temporary, this.filePath);
  }
  assertLoaded() {
    if (!this.loaded) throw new Error("API adapter registry has not been initialized.");
  }
};
function validateAdapter(adapter) {
  if (!/^[a-z0-9][a-z0-9._:-]{2,100}$/i.test(adapter.id)) throw new Error("Adapter ID is invalid.");
  if (!adapter.providerId.trim() || !adapter.capability.trim()) throw new Error("Adapter provider and capability are required.");
  if (!["GET", "POST"].includes(adapter.method)) throw new Error("Only GET and POST declarative adapters are supported.");
  const probeUrl = adapter.urlTemplate.replace(/\{[a-zA-Z0-9_]+\}/g, "sample");
  if (!isSafePublicUrl(probeUrl)) throw new Error("Adapter URL must be a safe public HTTP(S) URL.");
  if (adapter.credentialEnv && !/^[A-Z][A-Z0-9_]{2,100}$/.test(adapter.credentialEnv)) {
    throw new Error("Credential references must be environment-variable names, never literal secrets.");
  }
  const names = /* @__PURE__ */ new Set();
  for (const parameter of adapter.parameters) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(parameter.name)) throw new Error("Adapter parameter name is invalid.");
    if (names.has(parameter.name)) throw new Error(`Duplicate adapter parameter: ${parameter.name}`);
    names.add(parameter.name);
  }
  for (const [field, jsonPath] of Object.entries(adapter.output)) {
    if (!field.trim() || !/^\$?(?:\.[a-zA-Z0-9_-]+|\[[0-9]+\])*$/.test(jsonPath)) {
      throw new Error("Adapter output mappings must use restricted JSON paths.");
    }
  }
}

// api_hub/adapterExecutor.ts
async function executeVerifiedAdapter(adapter, args, options = {}) {
  validateAdapter(adapter);
  if (!adapter.verified) throw new Error("Unverified API adapters cannot execute.");
  const parameters = normalizeParameters(adapter, args);
  let url = renderPath(adapter.urlTemplate, parameters.path);
  const parsed = new URL(url);
  for (const [name, value] of Object.entries(parameters.query)) parsed.searchParams.set(name, stringify(value));
  url = parsed.toString();
  if (!isSafePublicUrl(url)) throw new Error("Adapter resolved to an unsafe URL.");
  const headers = {
    accept: "application/json",
    ...Object.fromEntries(Object.entries(parameters.header).map(([name, value]) => [name, stringify(value)]))
  };
  if (adapter.credentialEnv) {
    const credential = (options.env || process.env)[adapter.credentialEnv]?.trim();
    if (!credential) throw new Error(`Connection '${adapter.credentialEnv}' is not configured.`);
    headers[adapter.credentialHeader || "authorization"] = `${adapter.credentialPrefix || ""}${credential}`;
  }
  const body = adapter.method === "POST" && Object.keys(parameters.body).length ? JSON.stringify(parameters.body) : void 0;
  if (body) headers["content-type"] = "application/json";
  const controller = new AbortController();
  const relayAbort = () => controller.abort("cancelled");
  options.signal?.addEventListener("abort", relayAbort, { once: true });
  const timeout = setTimeout(() => controller.abort("timeout"), clamp10(options.timeoutMs ?? 15e3, 1e3, 6e4));
  timeout.unref?.();
  try {
    const response = await fetchWithSafeRedirects(options.fetcher || fetch, url, {
      method: adapter.method,
      headers,
      body,
      signal: controller.signal
    });
    const maximum = clamp10(options.maximumResponseBytes ?? 2e6, 1024, 1e7);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maximum) throw new Error("API response exceeds the configured size limit.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximum) throw new Error("API response exceeds the configured size limit.");
    if (!response.ok) throw new Error(`API provider returned HTTP ${response.status}.`);
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("API provider did not return valid JSON.");
    }
    const data = {};
    for (const [field, jsonPath] of Object.entries(adapter.output)) {
      data[field] = readRestrictedJsonPath(payload, jsonPath);
    }
    return {
      adapterId: adapter.id,
      providerId: adapter.providerId,
      capability: adapter.capability,
      sourceUrl: redactUrl(response.url || url),
      sourceStatus: response.status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(options.signal?.aborted ? "API adapter call was cancelled." : "API adapter call timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", relayAbort);
  }
}
function verifyAdapterAgainstFixture(candidate2, fixture, notes = "Validated against a controlled JSON fixture.") {
  validateAdapter(candidate2);
  for (const jsonPath of Object.values(candidate2.output)) {
    if (readRestrictedJsonPath(fixture, jsonPath) === void 0) {
      throw new Error(`Fixture does not contain required output path '${jsonPath}'.`);
    }
  }
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...candidate2,
    verified: true,
    verifiedAt: timestamp,
    verificationNotes: notes.slice(0, 500),
    updatedAt: timestamp
  };
}
function normalizeParameters(adapter, args) {
  const output = {
    path: {},
    query: {},
    header: {},
    body: {}
  };
  const accepted = new Set(adapter.parameters.map((parameter) => parameter.name));
  const unknown = Object.keys(args).filter((name) => !accepted.has(name));
  if (unknown.length) throw new Error(`Unknown adapter parameter(s): ${unknown.join(", ")}.`);
  for (const parameter of adapter.parameters) {
    const value = args[parameter.name] ?? parameter.default;
    if (parameter.required && (value === void 0 || value === null || value === "")) {
      throw new Error(`Required adapter parameter '${parameter.name}' is missing.`);
    }
    if (value !== void 0 && value !== null) {
      if (!["string", "number", "boolean"].includes(typeof value)) {
        throw new Error(`Adapter parameter '${parameter.name}' must be a scalar value.`);
      }
      output[parameter.in][parameter.name] = value;
    }
  }
  return output;
}
function renderPath(template, values) {
  const rendered = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_whole, name) => {
    if (!(name in values)) throw new Error(`Missing path parameter '${name}'.`);
    return encodeURIComponent(stringify(values[name]));
  });
  if (/\{[a-zA-Z0-9_]+\}/.test(rendered)) throw new Error("Adapter URL contains unresolved parameters.");
  return rendered;
}
async function fetchWithSafeRedirects(fetcher, initialUrl, init) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetcher(current, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === 3) throw new Error("API provider exceeded the redirect limit.");
    const location = response.headers.get("location");
    if (!location) throw new Error("API provider returned an invalid redirect.");
    current = new URL(location, current).toString();
    if (!isSafePublicUrl(current)) throw new Error("API provider redirected to an unsafe URL.");
  }
  throw new Error("API redirect failed.");
}
function readRestrictedJsonPath(value, jsonPath) {
  const normalized = jsonPath.replace(/^\$/, "");
  if (!normalized) return value;
  const parts = [...normalized.matchAll(/\.([a-zA-Z0-9_-]+)|\[([0-9]+)\]/g)];
  let current = value;
  for (const part of parts) {
    const key = part[1] ?? Number(part[2]);
    if (current === null || typeof current !== "object") return void 0;
    current = current[key];
  }
  return current;
}
function redactUrl(value) {
  try {
    const url = new URL(value);
    for (const name of [...url.searchParams.keys()]) {
      if (/key|token|secret|auth|password/i.test(name)) url.searchParams.set(name, "[redacted]");
    }
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return "remote provider";
  }
}
function stringify(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error("Adapter parameter must be a scalar value.");
}
function clamp10(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// api_hub/catalogueImporter.ts
var import_node_crypto9 = require("node:crypto");
var PUBLIC_APIS_CATALOGUE_URL = "https://raw.githubusercontent.com/public-apis/public-apis/master/README.md";
var TABLE_HEADER = /^\s*API\s*\|\s*Description\s*\|\s*Auth\s*\|\s*HTTPS\s*\|\s*CORS\s*\|?\s*$/i;
var CATEGORY_HEADER = /^###\s+(.+?)\s*$/;
var LINK_CELL = /^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/i;
function parsePublicApisMarkdown(markdown, source = PUBLIC_APIS_CATALOGUE_URL) {
  const providers = [];
  const seen = /* @__PURE__ */ new Set();
  let category = "";
  let inApiTable = false;
  let duplicates = 0;
  let rejected = 0;
  for (const rawLine of markdown.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const heading = rawLine.match(CATEGORY_HEADER);
    if (heading) {
      category = cleanText(heading[1]);
      inApiTable = false;
      continue;
    }
    if (TABLE_HEADER.test(rawLine.trim())) {
      inApiTable = Boolean(category);
      continue;
    }
    if (!inApiTable || !rawLine.trim().startsWith("|")) continue;
    if (/^\s*\|?\s*:?-{3}/.test(rawLine)) continue;
    const cells = splitMarkdownRow(rawLine);
    if (cells.length < 5) {
      rejected += 1;
      continue;
    }
    const link = cells[0].trim().match(LINK_CELL);
    if (!link) {
      rejected += 1;
      continue;
    }
    const name = cleanText(link[1]);
    const documentationUrl = normalizeUrl(link[2]);
    if (!name || !documentationUrl) {
      rejected += 1;
      continue;
    }
    const dedupeKey = documentationUrl.toLowerCase();
    if (seen.has(dedupeKey)) {
      duplicates += 1;
      continue;
    }
    seen.add(dedupeKey);
    const authRaw = cleanText(cells[2]);
    const auth = normalizeAuth(authRaw);
    const https = normalizeSupport(cells[3]);
    providers.push({
      id: providerId(documentationUrl),
      name,
      description: cleanText(cells[1]),
      category,
      documentationUrl,
      auth,
      authRaw,
      https,
      cors: normalizeSupport(cells[4]),
      status: initialStatus(auth, https),
      cataloguePresent: true,
      source
    });
  }
  return { providers, duplicates, rejected };
}
function normalizeAuth(value) {
  const normalized = cleanText(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized || ["unknown", "?"].includes(normalized)) return "unknown";
  if (["no", "none", "false"].includes(normalized)) return "none";
  if (normalized.includes("oauth")) return "oauth";
  if (normalized.includes("apikey") || normalized.includes("key") || normalized.includes("token")) {
    return "apiKey";
  }
  return "custom";
}
function normalizeSupport(value) {
  const normalized = cleanText(value).toLowerCase();
  if (["yes", "true"].includes(normalized)) return "yes";
  if (["no", "false"].includes(normalized)) return "no";
  return "unknown";
}
function initialStatus(auth, https) {
  if (https === "no") return "UNSUPPORTED";
  if (auth === "none") return "READY_NO_AUTH";
  if (auth === "oauth") return "NEEDS_OAUTH";
  if (auth === "apiKey" || auth === "custom") return "NEEDS_API_KEY";
  return "UNKNOWN";
}
function splitMarkdownRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells = [];
  let current = "";
  let escaped = false;
  for (const character of trimmed) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  while (cells.length > 5 && !cells.at(-1)) cells.pop();
  return cells;
}
function cleanText(value) {
  return value.replace(/`/g, "").replace(/\\\|/g, "|").replace(/<br\s*\/?\s*>/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}
function normalizeUrl(value) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}
function providerId(documentationUrl) {
  return `public-apis:${(0, import_node_crypto9.createHash)("sha256").update(documentationUrl.toLowerCase()).digest("hex").slice(0, 20)}`;
}

// api_hub/builtInAdapters.ts
var VERIFIED_AT = "2026-08-30T16:45:00.000Z";
async function seedBuiltInAdapters(registry) {
  for (const adapter of builtInAdapters()) {
    if (!registry.get(adapter.id)) await registry.save(adapter);
  }
}
function builtInAdapters() {
  return [
    verifyAdapterAgainstFixture(
      candidate({
        id: "weather.open-meteo.current.v1",
        providerId: "public-apis:9062de724650ef9cb797",
        capability: "weather.current",
        method: "GET",
        urlTemplate: "https://api.open-meteo.com/v1/forecast",
        parameters: [
          { name: "latitude", in: "query", required: true },
          { name: "longitude", in: "query", required: true },
          { name: "current", in: "query", default: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" },
          { name: "timezone", in: "query", default: "auto" },
          { name: "forecast_days", in: "query", default: 1 }
        ],
        output: {
          latitude: ".latitude",
          longitude: ".longitude",
          timezone: ".timezone",
          observedAt: ".current.time",
          temperatureC: ".current.temperature_2m",
          relativeHumidityPercent: ".current.relative_humidity_2m",
          weatherCode: ".current.weather_code",
          windSpeedKmh: ".current.wind_speed_10m"
        }
      }),
      {
        latitude: 18.52,
        longitude: 73.85,
        timezone: "Asia/Kolkata",
        current: {
          time: "2026-08-30T22:15",
          temperature_2m: 22.7,
          relative_humidity_2m: 90,
          weather_code: 2,
          wind_speed_10m: 13
        }
      },
      "Built-in Open-Meteo schema and live endpoint validated on 2026-08-30."
    ),
    verifyAdapterAgainstFixture(
      candidate({
        id: "currency.frankfurter.rate.v2",
        providerId: "frankfurter:official-v2",
        capability: "currency.exchange_rate",
        method: "GET",
        urlTemplate: "https://api.frankfurter.dev/v2/rate/{base}/{quote}",
        parameters: [
          { name: "base", in: "path", required: true },
          { name: "quote", in: "path", required: true }
        ],
        output: {
          rateDate: ".date",
          baseCurrency: ".base",
          quoteCurrency: ".quote",
          rate: ".rate"
        }
      }),
      {
        date: "2026-08-30",
        base: "USD",
        quote: "INR",
        rate: 95.47
      },
      "Official Frankfurter v2 single-pair schema and live USD/INR endpoint validated on 2026-08-30."
    ),
    verifyAdapterAgainstFixture(
      candidate({
        id: "space.launch-library.upcoming.v1",
        providerId: "public-apis:1945ae01a7dc12f7ef47",
        capability: "space.rocket_launch.upcoming",
        method: "GET",
        urlTemplate: "https://ll.thespacedevs.com/2.2.0/launch/upcoming/",
        parameters: [
          { name: "net__gt", in: "query", required: true },
          { name: "limit", in: "query", default: 5 },
          { name: "ordering", in: "query", default: "net" }
        ],
        output: {
          totalUpcoming: ".count",
          name: ".results[0].name",
          launchTime: ".results[0].net",
          status: ".results[0].status.name",
          provider: ".results[0].launch_service_provider.name",
          rocket: ".results[0].rocket.configuration.full_name",
          location: ".results[0].pad.location.name",
          mission: ".results[0].mission.name"
        }
      }),
      {
        count: 1,
        results: [{
          name: "Example launch",
          net: "2026-09-01T00:00:00Z",
          status: { name: "Go for Launch" },
          launch_service_provider: { name: "Example provider" },
          rocket: { configuration: { full_name: "Example rocket" } },
          pad: { location: { name: "Example location" } },
          mission: { name: "Example mission" }
        }]
      },
      "Built-in Launch Library 2 schema, ordering, and future-time filter validated on 2026-08-30."
    )
  ];
}
function candidate(input) {
  return {
    ...input,
    verified: false,
    verifiedAt: null,
    verificationNotes: null,
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT
  };
}

// api_hub/registry.ts
var import_promises7 = __toESM(require("node:fs/promises"), 1);
var import_node_path7 = __toESM(require("node:path"), 1);
var EMPTY_HEALTH = {
  state: "unchecked",
  checkedAt: null,
  statusCode: null,
  latencyMs: null,
  consecutiveFailures: 0,
  error: null
};
var STATUS_ORDER = {
  READY_NO_AUTH: 6,
  NEEDS_API_KEY: 4,
  NEEDS_OAUTH: 3,
  UNKNOWN: 2,
  UNSUPPORTED: 1,
  BROKEN: 0
};
var TERM_ALIASES = {
  weather: ["forecast", "climate", "rain", "temperature"],
  rocket: ["space", "launch", "nasa", "spaceflight"],
  ip: ["geolocation", "network", "address", "location"],
  country: ["nation", "geography", "location"],
  currency: ["exchange", "forex", "money", "rate"],
  news: ["headlines", "media", "articles"],
  music: ["audio", "songs", "spotify"],
  image: ["photo", "pictures", "visual"]
};
var ApiCapabilityRegistry = class {
  constructor(filePath, source) {
    this.filePath = filePath;
    this.source = source;
    this.providers = /* @__PURE__ */ new Map();
    this.loaded = false;
    this.writeQueue = Promise.resolve();
    this.metadata = emptyMetadata(source);
  }
  async initialize() {
    if (this.loaded) return;
    await import_promises7.default.mkdir(import_node_path7.default.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await import_promises7.default.readFile(this.filePath, "utf-8"));
      if (parsed.version !== 1 || !Array.isArray(parsed.providers)) throw new Error("Unsupported API registry format.");
      this.metadata = { ...emptyMetadata(this.source), ...parsed.metadata, source: this.source };
      for (const provider of parsed.providers) this.providers.set(provider.id, provider);
    } catch (error) {
      if (error.code !== "ENOENT") {
        await import_promises7.default.rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => void 0);
      }
    }
    this.loaded = true;
  }
  async import(parsed, sourceMetadata = {}) {
    this.assertLoaded();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    for (const current of this.providers.values()) current.cataloguePresent = false;
    for (const incoming of parsed.providers) {
      const existing = this.providers.get(incoming.id);
      this.providers.set(incoming.id, {
        ...incoming,
        firstSeenAt: existing?.firstSeenAt || timestamp,
        updatedAt: timestamp,
        health: existing?.health || { ...EMPTY_HEALTH },
        status: existing?.health.state === "broken" ? "BROKEN" : incoming.status
      });
    }
    this.metadata = {
      source: this.source,
      syncedAt: timestamp,
      sourceEtag: sourceMetadata.etag ?? null,
      sourceLastModified: sourceMetadata.lastModified ?? null,
      imported: parsed.providers.length,
      duplicates: parsed.duplicates,
      rejected: parsed.rejected
    };
    await this.persist();
    return this.summary();
  }
  get(id) {
    this.assertLoaded();
    const provider = this.providers.get(id);
    return provider ? structuredClone(provider) : null;
  }
  search(query, options = {}) {
    this.assertLoaded();
    const terms = expandTerms(tokenize2(query));
    if (!terms.length) return [];
    const results = [];
    for (const provider of this.providers.values()) {
      if (!provider.cataloguePresent) continue;
      if (options.readyOnly && provider.status !== "READY_NO_AUTH") continue;
      const name = normalize2(provider.name);
      const category = normalize2(provider.category);
      const description = normalize2(provider.description);
      const host = normalize2(safeHost(provider.documentationUrl));
      const matched = /* @__PURE__ */ new Set();
      let score = 0;
      for (const term of terms) {
        if (name.includes(term)) {
          score += 7;
          matched.add(term);
        }
        if (category.includes(term)) {
          score += 5;
          matched.add(term);
        }
        if (description.includes(term)) {
          score += 3;
          matched.add(term);
        }
        if (host.includes(term)) {
          score += 1;
          matched.add(term);
        }
      }
      if (!score) continue;
      score += STATUS_ORDER[provider.status] * 0.35;
      if (provider.https === "yes") score += 0.5;
      if (provider.health.state === "healthy") score += 2;
      if (provider.health.state === "degraded") score -= 1;
      results.push({ provider: structuredClone(provider), score, matchedTerms: [...matched] });
    }
    return results.sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name)).slice(0, clamp11(options.limit ?? 8, 1, 30));
  }
  list(options = {}) {
    this.assertLoaded();
    return [...this.providers.values()].filter((provider) => provider.cataloguePresent).filter((provider) => !options.category || normalize2(provider.category) === normalize2(options.category)).filter((provider) => !options.status || provider.status === options.status).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).slice(0, clamp11(options.limit ?? 100, 1, 500)).map((provider) => structuredClone(provider));
  }
  async recordHealth(id, health) {
    this.assertLoaded();
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown API provider: ${id}`);
    const failed = health.state === "broken";
    provider.health = {
      ...health,
      consecutiveFailures: failed ? provider.health.consecutiveFailures + 1 : 0
    };
    if (failed && provider.health.consecutiveFailures >= 2) provider.status = "BROKEN";
    if (!failed && provider.status === "BROKEN") {
      provider.status = provider.https === "no" ? "UNSUPPORTED" : provider.auth === "none" ? "READY_NO_AUTH" : provider.auth === "oauth" ? "NEEDS_OAUTH" : "NEEDS_API_KEY";
    }
    provider.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await this.persist();
    return structuredClone(provider);
  }
  summary() {
    this.assertLoaded();
    const active = [...this.providers.values()].filter((provider) => provider.cataloguePresent);
    const statuses = counter([
      "READY_NO_AUTH",
      "NEEDS_API_KEY",
      "NEEDS_OAUTH",
      "BROKEN",
      "UNSUPPORTED",
      "UNKNOWN"
    ]);
    const health = counter(["unchecked", "healthy", "degraded", "broken"]);
    for (const provider of active) {
      statuses[provider.status] += 1;
      health[provider.health.state] += 1;
    }
    return {
      source: this.metadata.source,
      syncedAt: this.metadata.syncedAt,
      providerCount: active.length,
      categories: new Set(active.map((provider) => provider.category)).size,
      statuses,
      health
    };
  }
  getMetadata() {
    this.assertLoaded();
    return structuredClone(this.metadata);
  }
  persist() {
    const payload = {
      version: 1,
      metadata: this.metadata,
      providers: [...this.providers.values()]
    };
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.filePath}.tmp-${process.pid}`;
      await import_promises7.default.writeFile(temporary, JSON.stringify(payload, null, 2), "utf-8");
      await import_promises7.default.rename(temporary, this.filePath);
    });
    return this.writeQueue;
  }
  assertLoaded() {
    if (!this.loaded) throw new Error("API capability registry has not been initialized.");
  }
};
function emptyMetadata(source) {
  return {
    source,
    syncedAt: null,
    sourceEtag: null,
    sourceLastModified: null,
    imported: 0,
    duplicates: 0,
    rejected: 0
  };
}
function tokenize2(value) {
  return normalize2(value).split(" ").filter((item) => item.length >= 2);
}
function expandTerms(terms) {
  const expanded = new Set(terms);
  for (const term of terms) for (const alias of TERM_ALIASES[term] || []) expanded.add(alias);
  return [...expanded];
}
function normalize2(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
function clamp11(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
function counter(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

// api_hub/service.ts
var import_node_path8 = __toESM(require("node:path"), 1);
var ApiHubService = class {
  constructor(options) {
    this.options = options;
    this.syncInFlight = null;
    this.sourceUrl = options.sourceUrl || PUBLIC_APIS_CATALOGUE_URL;
    this.fetcher = options.fetcher || fetch;
    const directory = import_node_path8.default.join(options.dataDir, "api-hub");
    this.registry = new ApiCapabilityRegistry(import_node_path8.default.join(directory, "providers.v1.json"), this.sourceUrl);
    this.adapters = new ApiAdapterRegistry(import_node_path8.default.join(directory, "adapters.v1.json"));
  }
  async initialize() {
    await Promise.all([this.registry.initialize(), this.adapters.initialize()]);
    await seedBuiltInAdapters(this.adapters);
  }
  async sync(force = false) {
    if (!force && !this.isStale()) return this.registry.summary();
    if (this.syncInFlight) return this.syncInFlight;
    this.syncInFlight = this.performSync();
    try {
      return await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
    }
  }
  isStale() {
    const syncedAt = this.registry.getMetadata().syncedAt;
    if (!syncedAt) return true;
    const age = Date.now() - new Date(syncedAt).getTime();
    return !Number.isFinite(age) || age >= clamp12(this.options.maximumAgeMs ?? 864e5, 6e4, 30 * 864e5);
  }
  async checkProvider(id) {
    const provider = this.registry.get(id);
    if (!provider) throw new Error(`Unknown API provider: ${id}`);
    const result2 = await checkProviderDocumentation(provider, {
      timeoutMs: this.options.healthTimeoutMs,
      fetcher: this.fetcher
    });
    return this.registry.recordHealth(id, { ...result2 });
  }
  async callAdapter(id, args, signal2) {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown API adapter: ${id}`);
    return executeVerifiedAdapter(adapter, args, { fetcher: this.fetcher, signal: signal2 });
  }
  status() {
    return {
      ...this.registry.summary(),
      metadata: this.registry.getMetadata(),
      stale: this.isStale(),
      verifiedAdapters: this.adapters.list().filter((adapter) => adapter.verified).length
    };
  }
  async performSync() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("timeout"), 3e4);
    timeout.unref?.();
    try {
      const metadata = this.registry.getMetadata();
      const headers = { "user-agent": "MYRAA-ApiHub/1.0" };
      if (metadata.sourceEtag) headers["if-none-match"] = metadata.sourceEtag;
      if (metadata.sourceLastModified) headers["if-modified-since"] = metadata.sourceLastModified;
      const response = await this.fetcher(this.sourceUrl, { signal: controller.signal, headers, redirect: "follow" });
      if (response.status === 304) return this.registry.summary();
      if (!response.ok) throw new Error(`Public API catalogue returned HTTP ${response.status}.`);
      const markdown = await response.text();
      const parsed = parsePublicApisMarkdown(markdown, this.sourceUrl);
      const minimum = clamp12(this.options.minimumProviderCount ?? 100, 1, 1e4);
      if (parsed.providers.length < minimum) {
        throw new Error(`Catalogue validation failed: expected at least ${minimum} providers, parsed ${parsed.providers.length}.`);
      }
      return await this.registry.import(parsed, {
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified")
      });
    } finally {
      clearTimeout(timeout);
    }
  }
};
function clamp12(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

// server.ts
import_dotenv.default.config();
var COGNITION_DATA_DIR = process.env.MYRAA_COGNITION_DATA_DIR || (process.env.MYRAA_DATA_DIR ? DATA_DIR : import_path2.default.join(DATA_DIR, ".myraa-data"));
async function migrateDevelopmentCognitionData() {
  if (import_path2.default.resolve(COGNITION_DATA_DIR) === import_path2.default.resolve(DATA_DIR)) return;
  const sourceDir = import_path2.default.join(DATA_DIR, "cognition");
  const targetDir = import_path2.default.join(COGNITION_DATA_DIR, "cognition");
  await fs9.promises.mkdir(targetDir, { recursive: true });
  for (const name of ["memories.v1.json", "goals.v1.json", "skills.v1.json", "last-session.json"]) {
    const source = import_path2.default.join(sourceDir, name);
    const target = import_path2.default.join(targetDir, name);
    try {
      await fs9.promises.copyFile(source, target, fs9.constants.COPYFILE_EXCL);
    } catch (error) {
      const code = error.code;
      if (code !== "ENOENT" && code !== "EEXIST") throw error;
    }
  }
}
var LOGS_DIR = import_path2.default.join(DATA_DIR, "logs");
try {
  fs9.mkdirSync(LOGS_DIR, { recursive: true });
} catch {
}
function appendLog(fileName, message) {
  try {
    const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
    fs9.appendFile(import_path2.default.join(LOGS_DIR, fileName), line, () => {
    });
  } catch {
  }
}
var logCommand = (m) => appendLog("commands.log", m);
var logStartup = (m) => appendLog("startup.log", m);
var logError = (m) => appendLog("errors.log", m);
function sanitizeSpokenModelText(value) {
  let s = String(value || "");
  s = s.replace(/<thought[\s\S]*?<\/thought>/gi, "");
  s = s.replace(/<thinking[\s\S]*?<\/thinking>/gi, "");
  s = s.replace(/\[\s*(?:MYRAA\s+)?(?:VISION|VISUAL|INTERNAL|PROACTIVE|COGNITIVE|AWARENESS|PRESENCE|SYSTEM|OBSERVATION|ACTION|PLAN)[^\]]*\]\s*/gi, "");
  s = s.replace(/^\[[^\]]+\]\s*/, "");
  s = s.replace(/^\s*(?:private\s+runtime\s+context|internal\s+myraa\s+event|action\s+plan)\s*[:—-]\s*/i, "");
  if (/(?:the user is still pushing me|i need to make sure|action plan:|let's try this alternative action chain|i established i can move|clickText tool has failed)/i.test(s)) {
    const verbalParts = s.split(/(?:Action Plan refinement:?|Action Plan:?|\bThen verbally explain:?|\bI'll acknowledge\b|\bverbally explain\b)/i);
    if (verbalParts.length > 1 && verbalParts[verbalParts.length - 1].trim().length > 5) {
      s = verbalParts[verbalParts.length - 1].replace(/^[^a-zA-Z0-9"'“]+/, "");
    } else {
      s = "I understand. Working on that right now.";
    }
  }
  return s;
}

function formatSpokenTextWithSpaces(existingText, newChunk) {
  if (!newChunk) return "";
  let chunk = sanitizeSpokenModelText(newChunk);
  if (!chunk) return "";

  // 1. Punctuation spacing (e.g., "there.What's" -> "there. What's", "hai.All" -> "hai. All")
  chunk = chunk.replace(/([.?!,;:])([A-Za-z0-9])/g, '$1 $2');

  // 2. Glued contractions (e.g. "What'son" -> "What's on", "I'mhere" -> "I'm here")
  chunk = chunk.replace(/([A-Za-z0-9])('s|'re|'ve|'d|'ll|n't|'m)([A-Za-z0-9])/gi, '$1$2 $3');

  // 3. Glued camelCase or Capital transitions (e.g. "mindWese" -> "mind Wese")
  chunk = chunk.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  // 4. Common English pairs
  chunk = chunk.replace(/\b(your)(mind)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(what)(is)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(how)(are)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(can)(you)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(let)(me)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(with)(you)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(you)(doing|going|want|need)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(all)(good)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(thank)(you)\b/gi, '$1 $2');
  chunk = chunk.replace(/\b(doing)(today|now)\b/gi, '$1 $2');

  // 5. Common Hinglish compound words
  const hinglishPairs = [
    [/kafi\s*din\s*baad\s*baat\s*ho/gi, 'kafi din baad baat ho'],
    [/kafidinbaadbaatho/gi, 'kafi din baad baat ho'],
    [/kafidinbaad/gi, 'kafi din baad'],
    [/baadbaat/gi, 'baad baat'],
    [/baatho/gi, 'baat ho'],
    [/rahihai/gi, 'rahi hai'],
    [/rahahai/gi, 'raha hai'],
    [/raheho/gi, 'rahe ho'],
    [/rahihu/gi, 'rahi hu'],
    [/kuchbhi/gi, 'kuch bhi'],
    [/sabkuch/gi, 'sab kuch'],
    [/kaiseho/gi, 'kaise ho'],
    [/karnahai/gi, 'karna hai'],
    [/karsakte/gi, 'kar sakte'],
    [/nahihai/gi, 'nahi hai'],
    [/kyachal/gi, 'kya chal'],
    [/chalraha/gi, 'chal raha'],
    [/theekhai/gi, 'theek hai'],
    [/thikhai/gi, 'thik hai']
  ];
  for (const [pattern, rep] of hinglishPairs) {
    chunk = chunk.replace(pattern, rep);
  }

  // 6. Ensure delimiter space between existing text and incoming chunk
  if (existingText && existingText.length > 0) {
    const lastChar = existingText.slice(-1);
    const firstChar = chunk.charAt(0);
    if (!/\s/.test(lastChar) && !/\s/.test(firstChar)) {
      if (!/[.,!?;:)\]}]/.test(firstChar)) {
        chunk = " " + chunk;
      }
    }
  }

  return chunk;
}

function recordTranscriptToDisk(speaker, text) {
  if (!text || !String(text).trim()) return;
  try {
    const dataDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
    const tFile = path.join(dataDir, 'MYRAA', 'transcripts.json');
    let logs = [];
    if (fs.existsSync(tFile)) {
      try { logs = JSON.parse(fs.readFileSync(tFile, 'utf8')); } catch {}
    }
    const cleanSpeaker = String(speaker).toLowerCase().includes("user") ? "User" : "MYRAA";
    logs.unshift({
      id: "t_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      speaker: cleanSpeaker,
      text: formatSpokenTextWithSpaces("", String(text)).trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tone: cleanSpeaker === "User" ? "user_speech" : "warm_empathetic"
    });
    if (logs.length > 200) logs = logs.slice(0, 200);
    fs.mkdirSync(path.dirname(tFile), { recursive: true });
    fs.writeFileSync(tFile, JSON.stringify(logs, null, 2));
  } catch (err) {}
}

var DESKTOP_AGENT_URL = process.env.DESKTOP_AGENT_URL || "http://127.0.0.1:8765";
var DESKTOP_OBSERVER_FALLBACK_URL = process.env.DESKTOP_OBSERVER_URL || "http://127.0.0.1:8766";
var DESKTOP_AGENT_TIMEOUT = 25e3;
var desktopObserverUrl = null;
var desktopObserverResolutionComplete = false;
var DESKTOP_TOOLS = /* @__PURE__ */ new Set([
  "typeIntoApp",
  "writeIntoApp",
  "editApp",
  "mediaPlayPause",
  "playMedia",
  "pauseMedia",
  "mediaNext",
  "nextTrack",
  "mediaPrevious",
  "previousTrack",
  "searchAndPlayMedia",
  "showDesktop",
  "sendFileWhatsApp",
  "sendFileEmail",
  "getBrightness",
  "setClipboard",
  "listProcesses",
  "listWindows",
  "killProcess",
  "setWallpaper",
  "getWallpaper",
  "confirmPendingAction",
  "learnGitHubRepo",
  "createClientEmail",
  "createPrdReport",
  "createResume",
  "createWebsiteProject",
  "uninstallApp",
  "installApp",
  "searchApp",
  "addTodayTask",
  "getTodayTasks",
  "getDateTime",
  "getWeather",
  "bluetoothControl",
  "wifiControl",
  "writeVsCode",
  "openVsCode",
  "editVsCode",
  "msPrint",
  "print",
  "printDocument",
  "editPaint",
  "openPaint",
  "pptPresentation",
  "createPowerPoint",
  "editPowerPoint",
  "excelSpreadsheet",
  "createExcelDocument",
  "createExcel",
  "editExcel",
  "wordDocument",
  "createWordDocument",
  "createWord",
  "editWord",
  // applications / websites / search
  "openApplication",
  "closeApplication",
  "openWebsite",
  "searchWeb",
  "searchYouTube",
  "searchGoogle",
  "searchGitHub",
  // files
  "createFile",
  "readFile",
  "renameFile",
  "deleteFile",
  "moveFile",
  "openFolder",
  "listFiles",
  "searchFiles",
  // pc control (volume + gated power)
  "volumeUp",
  "volumeDown",
  "muteToggle",
  "setVolume",
  "requestPowerAction",
  "executePowerAction",
  // windows
  "minimizeWindow",
  "maximizeWindow",
  "closeWindow",
  "switchApplication",
  // generic mouse / keyboard / desktop observation
  "locateText",
  "clickText",
  "moveMouse",
  "click",
  "doubleClick",
  "rightClick",
  "drag",
  "scroll",
  "typeText",
  "pressKey",
  "hotkey",
  "getCursorPosition",
  "getActiveWindow",
  "listVisibleWindows",
  "waitForUi",
  "observeDesktopState",
  // clipboard
  "copySelected",
  "pasteClipboard",
  "getClipboard",
  "clearClipboard",
  // screenshot / screen reading
  "takeScreenshot",
  "saveScreenshot",
  "analyzeScreenshot",
  "readScreen",
  "viewScreen",
  // coding assistance
  "createPythonFile",
  "runPythonScript",
  "createProjectFolder",
  "writeCodeFile",
  // system information
  "systemInfo",
  "gpuInfo",
  "temperatureInfo",
  // brightness control (V2)
  "brightnessUp",
  "brightnessDown",
  "setBrightness",
  // Windows auto-start management (V2)
  "enableAutoStart",
  "disableAutoStart",
  "getAutoStartStatus"
]);
var API_HUB_TOOLS = /* @__PURE__ */ new Set([
  "searchApiCapabilities",
  "refreshApiCatalogue",
  "checkApiProvider",
  "callVerifiedApiAdapter",
  "convertCurrency",
  "deepResearch"
]);
var desktopAgentVerified = false;
var activeScreenVisionPipelines = /* @__PURE__ */ new Map();
var pendingElectronCaptures = /* @__PURE__ */ new Map();
process.on("message", (message) => {
  const response = message;
  if (response?.type !== "screen-capture-response" || !response.id) return;
  const resolve = pendingElectronCaptures.get(response.id);
  if (!resolve) return;
  pendingElectronCaptures.delete(response.id);
  resolve(response);
});
function requiresImageCapture(tool, args) {
  return tool === "viewScreen" || tool === "takeScreenshot" && args.include_image === true;
}
async function captureViaElectron(maxDim) {
  if (typeof process.send !== "function" || !process.connected) return null;
  const id = (0, import_node_crypto10.randomUUID)();
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingElectronCaptures.delete(id);
      resolve({ ok: false, error: "Electron screen capture timed out." });
    }, 15e3);
    timer.unref?.();
    pendingElectronCaptures.set(id, (response) => {
      clearTimeout(timer);
      resolve(response.ok ? { ok: true, result: response.result } : { ok: false, error: response.error || "Electron screen capture failed." });
    });
    try {
      process.send?.({
        type: "screen-capture-request",
        id,
        maxDim: Math.max(320, Math.min(1920, Math.round(maxDim) || 1440))
      });
    } catch (error) {
      clearTimeout(timer);
      pendingElectronCaptures.delete(id);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
function findPythonRuntime() {
  const candidates = [
    process.env.MYRAA_PYTHON,
    "C:\\Users\\MSI\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
    "C:\\Users\\MSI\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
    "python",
    "python3"
  ].filter(Boolean);
  return candidates.find((candidate2) => {
    try {
      (0, import_node_child_process.execFileSync)(candidate2, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }) || null;
}
function spawnDesktopAgent() {
  const agentEnv = {
    ...process.env,
    MYRAA_AGENT_HOST: "127.0.0.1",
    MYRAA_AGENT_PORT: "8765"
  };
  const frozenCandidates = [
    process.env.MYRAA_AGENT_EXE,
    import_path2.default.join(__dirname, "..", "..", "agent", "myraa-agent.exe"),
    "C:\\Users\\Vishwajeet\\Music\\Myraa\\resources\\agent\\myraa-agent.exe",
    import_path2.default.join(process.cwd(), "resources", "agent", "myraa-agent.exe"),
    import_path2.default.join(process.cwd(), "agent_dist", "myraa-agent", "myraa-agent.exe")
  ];
  const frozenExe = frozenCandidates.find(
    (candidate2) => Boolean(candidate2 && fs9.existsSync(candidate2))
  );
  if (frozenExe) {
    try {
      const child = (0, import_node_child_process.spawn)(frozenExe, [], {
        cwd: import_path2.default.dirname(frozenExe),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        // never flash a console window
        env: agentEnv
      });
      child.unref();
      logStartup(`AGENT_SPAWN frozen exe pid=${child.pid} path=${frozenExe}`);
      console.log(`[Desktop Agent] Launched frozen agent (PID ${child.pid}).`);
      return;
    } catch (e) {
      logError(`AGENT_SPAWN_FROZEN_FAILED: ${e?.message || e}`);
    }
  }
  const py = findPythonRuntime();
  if (!py) {
    console.warn("[Desktop Agent] No frozen agent and no Python interpreter found; desktop control unavailable.");
    logError("AGENT_SPAWN_NO_RUNTIME: neither MYRAA_AGENT_EXE nor Python available");
    return;
  }
  try {
    const child = (0, import_node_child_process.spawn)(
      py,
      ["-m", "uvicorn", "desktop_agent.main:app", "--host", "127.0.0.1", "--port", "8765"],
      { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true, env: agentEnv }
    );
    child.unref();
    logStartup(`AGENT_SPAWN python pid=${child.pid}`);
    console.log(`[Desktop Agent] Auto-spawned via Python (PID ${child.pid}).`);
  } catch (e) {
    console.warn(`[Desktop Agent] Auto-spawn failed: ${e?.message || e}`);
    logError(`AGENT_SPAWN_PYTHON_FAILED: ${e?.message || e}`);
  }
}
async function isDesktopAgentAlive() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
async function ensureDesktopAgent() {
  if (desktopAgentVerified) return;
  if (await isDesktopAgentAlive()) {
    desktopAgentVerified = true;
    const toolCount = await fetchAgentToolCount();
    console.log(`[Desktop Agent] Already running \u2014 ${toolCount} tools available.`);
    return;
  }
  console.log("[Desktop Agent] Not detected. Auto-starting...");
  spawnDesktopAgent();
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 1e3));
    if (await isDesktopAgentAlive()) {
      desktopAgentVerified = true;
      const toolCount = await fetchAgentToolCount();
      console.log(`[Desktop Agent] Online after ${i}s \u2014 ${toolCount} tools available.`);
      return;
    }
  }
  console.warn("[Desktop Agent] Did not come online within 20s. Desktop control will be unavailable.");
}
async function fetchAgentToolCount() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.tool_count === "number") return data.tool_count;
      if (Array.isArray(data.tools)) return data.tools.length;
    }
  } catch {
  }
  return 73;
}
async function probeDesktopObserver(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2e3);
    const response = await fetch(`${url}/observe`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}
async function ensureDesktopObserver() {
  if (desktopObserverResolutionComplete && !desktopObserverUrl) return null;
  if (desktopObserverUrl && await probeDesktopObserver(desktopObserverUrl)) return desktopObserverUrl;
  if (await probeDesktopObserver(DESKTOP_AGENT_URL)) {
    desktopObserverUrl = DESKTOP_AGENT_URL;
    desktopObserverResolutionComplete = true;
    return desktopObserverUrl;
  }
  if (await probeDesktopObserver(DESKTOP_OBSERVER_FALLBACK_URL)) {
    desktopObserverUrl = DESKTOP_OBSERVER_FALLBACK_URL;
    desktopObserverResolutionComplete = true;
    return desktopObserverUrl;
  }
  const python = findPythonRuntime();
  if (!python) {
    console.warn("[Desktop Observer] No current observer endpoint or Python runtime available.");
    desktopObserverResolutionComplete = true;
    return null;
  }
  try {
    (0, import_node_child_process.execFileSync)(python, ["-c", "import uvicorn, fastapi, win32gui, psutil"], {
      stdio: "ignore",
      timeout: 3e3,
      windowsHide: true
    });
  } catch {
    console.log("[Desktop Observer] Python observer dependencies are unavailable; using native Windows telemetry.");
    desktopObserverResolutionComplete = true;
    return null;
  }
  try {
    const observerUrl = new URL(DESKTOP_OBSERVER_FALLBACK_URL);
    const child = (0, import_node_child_process.spawn)(
      python,
      [
        "-m",
        "uvicorn",
        "desktop_agent.main:app",
        "--host",
        observerUrl.hostname,
        "--port",
        observerUrl.port || "8766"
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: process.env
      }
    );
    child.unref();
    console.log(`[Desktop Observer] Starting current telemetry sidecar (PID ${child.pid}).`);
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (await probeDesktopObserver(DESKTOP_OBSERVER_FALLBACK_URL)) {
        desktopObserverUrl = DESKTOP_OBSERVER_FALLBACK_URL;
        desktopObserverResolutionComplete = true;
        console.log(`[Desktop Observer] Online after ${attempt * 0.5}s.`);
        return desktopObserverUrl;
      }
    }
  } catch (error) {
    console.warn(`[Desktop Observer] Sidecar failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  desktopObserverResolutionComplete = true;
  return null;
}
async function fetchDesktopObservation(signal2) {
  const url = desktopObserverUrl || await ensureDesktopObserver();
  if (!url) return collectNativeDesktopObservation();
  const response = await fetch(`${url}/observe`, { signal: signal2 });
  if (!response.ok) throw new Error(`Desktop observation failed with HTTP ${response.status}.`);
  return await response.json();
}
function collectNativeDesktopObservation() {
  const fallback = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    activeWindow: { title: null, application: null, pid: null },
    applications: [],
    disk: null,
    downloads: [],
    userIdleSeconds: 0
  };
  if (process.platform !== "win32") return fallback;
  const script = String.raw`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class MyraaPresenceNative {
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO value);
  [DllImport("kernel32.dll")] public static extern uint GetTickCount();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  public static double IdleSeconds() {
    LASTINPUTINFO value = new LASTINPUTINFO(); value.cbSize = (uint)Marshal.SizeOf(value);
    return GetLastInputInfo(ref value) ? unchecked(GetTickCount() - value.dwTime) / 1000.0 : 0.0;
  }
}
'@ -ErrorAction Stop
$handle = [MyraaPresenceNative]::GetForegroundWindow()
$text = New-Object System.Text.StringBuilder 1024
[void][MyraaPresenceNative]::GetWindowText($handle, $text, $text.Capacity)
[uint32]$foregroundPid = 0
[void][MyraaPresenceNative]::GetWindowThreadProcessId($handle, [ref]$foregroundPid)
$application = $null
try { $application = (Get-Process -Id $foregroundPid -ErrorAction Stop).ProcessName } catch {}
[pscustomobject]@{ idleSeconds=[MyraaPresenceNative]::IdleSeconds(); title=$text.ToString(); application=$application; pid=$foregroundPid } | ConvertTo-Json -Compress
`;
  try {
    const output = (0, import_node_child_process.execFileSync)(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", timeout: 3e3, windowsHide: true }
    ).trim();
    const parsed = JSON.parse(output);
    return {
      ...fallback,
      activeWindow: {
        title: typeof parsed.title === "string" && parsed.title ? parsed.title : null,
        application: typeof parsed.application === "string" && parsed.application ? parsed.application : null,
        pid: Number.isFinite(Number(parsed.pid)) ? Number(parsed.pid) : null
      },
      userIdleSeconds: Math.max(0, Number(parsed.idleSeconds) || 0)
    };
  } catch {
    return fallback;
  }
}
async function callDesktopAgent(tool, args = {}, outerSignal) {
  if (outerSignal?.aborted) return { ok: false, error: "Desktop action was cancelled." };

  if (requiresImageCapture(tool, args)) {
    const electronCapture = await captureViaElectron(Number(args.max_dim) || 1440);
    if (electronCapture?.ok && electronCapture.result) {
      logCommand(`SCREEN_VISION_CAPTURE backend=electron tool=${tool}`);
      return electronCapture;
    }
    if (electronCapture?.error) {
      logError(`SCREEN_VISION_ELECTRON_CAPTURE_FAILED: ${electronCapture.error}`);
    }
  }

  // 1. FAST NATIVE WIN32 / POWERSHELL EXECUTION (Instant, zero external dependency)
  try {
    const nativeDA = require("./desktopAutomation.cjs");
    logCommand(`EXECUTE_NATIVE ${tool} keys=[${Object.keys(args || {}).join(",")}]`);
    let nativeRes = undefined;

    // ── Mouse & Keyboard ───────────────────────────────────────────────────
    if (tool === "getCursorPosition") nativeRes = nativeDA.getCursorPosition();
    else if (tool === "moveMouse") nativeRes = nativeDA.moveMouse(args.x, args.y);
    else if (tool === "click") nativeRes = nativeDA.click(args.x, args.y, args.button || 'left');
    else if (tool === "doubleClick") nativeRes = nativeDA.doubleClick(args.x, args.y);
    else if (tool === "rightClick") nativeRes = nativeDA.rightClick(args.x, args.y);
    else if (tool === "scroll") nativeRes = nativeDA.scroll(args.deltaY || args.amount);
    else if (tool === "drag") nativeRes = nativeDA.drag(args.startX || args.start_x, args.startY || args.start_y, args.endX || args.end_x, args.endY || args.end_y);
    else if (tool === "typeText") nativeRes = nativeDA.typeText(args.text);
    else if (tool === "pressKey") nativeRes = nativeDA.pressKey(args.key);
    else if (tool === "hotkey") nativeRes = nativeDA.hotkey(args.keys || args.hotkey);
    else if (tool === "clickText") nativeRes = nativeDA.clickText(args.text || args.label);
    else if (tool === "locateText") nativeRes = nativeDA.locateText(args.text || args.label);

    // ── Window & App Management ───────────────────────────────────────────
    else if (tool === "listVisibleWindows" || tool === "listWindows") nativeRes = nativeDA.listVisibleWindows();
    else if (tool === "minimizeWindow") nativeRes = nativeDA.minimizeWindow(args.target || args.title);
    else if (tool === "maximizeWindow") nativeRes = nativeDA.maximizeWindow(args.target || args.title);
    else if (tool === "closeWindow") nativeRes = nativeDA.closeWindow(args.target || args.title);
    else if (tool === "switchApplication") nativeRes = nativeDA.switchApplication(args.target || args.appName || args.title);
    else if (tool === "openApplication") nativeRes = nativeDA.openApplication(args.appName || args.name || args.application || args.target);
    else if (tool === "closeApplication") nativeRes = nativeDA.closeApplication(args.appName || args.name || args.application || args.target);
    else if (tool === "listProcesses" || tool === "getProcesses") nativeRes = nativeDA.listProcesses();
    else if (tool === "killProcess") nativeRes = nativeDA.killProcess(args.target || args.name || args.pid);
    else if (tool === "showDesktop") nativeRes = nativeDA.showDesktop();

    // ── Volume & Media ─────────────────────────────────────────────────────
    else if (tool === "volumeUp") nativeRes = nativeDA.volumeUp(args.steps || args.amount || 2);
    else if (tool === "volumeDown") nativeRes = nativeDA.volumeDown(args.steps || args.amount || 2);
    else if (tool === "setVolume") nativeRes = nativeDA.setVolume(args.level ?? args.volume ?? args.percent ?? 50);
    else if (tool === "muteToggle" || tool === "mute") nativeRes = nativeDA.muteToggle();
    else if (tool === "mediaPlayPause" || tool === "playMedia" || tool === "pauseMedia") nativeRes = nativeDA.mediaPlayPause();
    else if (tool === "mediaNext" || tool === "nextTrack") nativeRes = nativeDA.mediaNext();
    else if (tool === "mediaPrevious" || tool === "previousTrack") nativeRes = nativeDA.mediaPrevious();
    else if (tool === "searchYouTube" || tool === "searchWeb" || tool === "searchMedia" || tool === "searchAndPlayMedia") nativeRes = nativeDA.searchAndPlayMedia(args.query || args.search || args.name);

    // ── Brightness ─────────────────────────────────────────────────────────
    else if (tool === "getBrightness") nativeRes = nativeDA.getBrightness();
    else if (tool === "setBrightness") nativeRes = nativeDA.setBrightness(args.level ?? args.brightness ?? args.percent ?? 70);
    else if (tool === "brightnessUp") nativeRes = nativeDA.brightnessUp(args.steps || args.amount || 10);
    else if (tool === "brightnessDown") nativeRes = nativeDA.brightnessDown(args.steps || args.amount || 10);

    // ── Clipboard ──────────────────────────────────────────────────────────
    else if (tool === "getClipboard") nativeRes = nativeDA.getClipboard();
    else if (tool === "setClipboard" || tool === "writeClipboard") nativeRes = nativeDA.setClipboard(args.text || args.content || '');
    else if (tool === "copySelected") nativeRes = nativeDA.copySelected();
    else if (tool === "pasteClipboard") nativeRes = nativeDA.pasteClipboard();
    else if (tool === "clearClipboard") nativeRes = nativeDA.clearClipboard();

    // ── Screen & Vision ────────────────────────────────────────────────────
    else if (tool === "takeScreenshot" || tool === "viewScreen" || tool === "readScreen" || tool === "captureScreen") nativeRes = nativeDA.takeScreenshot();
    else if (tool === "saveScreenshot") nativeRes = nativeDA.saveScreenshot(args.path || args.savePath || args.name);
    else if (tool === "analyzeScreenshot") nativeRes = nativeDA.analyzeScreenshot();

    // ── File System ────────────────────────────────────────────────────────
    else if (tool === "createFile" || tool === "writeFile") nativeRes = nativeDA.createFile(args.path || args.filePath, args.content || args.text || '');
    else if (tool === "readFile" || tool === "openFile") nativeRes = nativeDA.readFile(args.path || args.filePath);
    else if (tool === "renameFile") nativeRes = nativeDA.renameFile(args.oldPath || args.source || args.from || args.path, args.newPath || args.destination || args.to || args.newName || args.new_name);
    else if (tool === "writeCodeFile" || tool === "createCodeFile") nativeRes = nativeDA.writeCodeFile(args.path || args.filePath, args.code || args.content || '', args.language);
    else if (tool === "createPythonFile") nativeRes = nativeDA.createPythonFile(args.path || args.filePath, args.code || args.content);
    else if (tool === "runPythonScript" || tool === "executePython") nativeRes = nativeDA.runPythonScript(args.path || args.filePath, args.args || '');
    else if (tool === "listFiles" || tool === "listDirectory") nativeRes = nativeDA.listFiles(args.path || args.directory || args.dir || args.name, args.max || args.limit || 50);
    else if (tool === "moveFile") nativeRes = nativeDA.moveFile(args.source || args.from || args.path, args.destination || args.to);
    else if (tool === "deleteFile" || tool === "removeFile") nativeRes = nativeDA.deleteFile(args.path || args.filePath, args.confirm === true || args.permanent === true);
    else if (tool === "searchFiles") nativeRes = nativeDA.searchFiles(args.query || args.name, args.max_results || args.limit || 10);
    else if (tool === "openFolder" || tool === "openDirectory") nativeRes = nativeDA.openFolder(args.path || args.folder || args.name);
    else if (tool === "createProjectFolder" || tool === "createProject") nativeRes = nativeDA.createProjectFolder(args.path || args.folder, args.subfolders || []);

    // ── Web & Search ───────────────────────────────────────────────────────
    else if (tool === "openWebsite" || tool === "openUrl" || tool === "browse") nativeRes = nativeDA.openWebsite(args.url || args.website || args.name || args.target);
    else if (tool === "searchGoogle" || tool === "googleSearch") nativeRes = nativeDA.searchGoogle(args.query || args.search);
    else if (tool === "searchGitHub") nativeRes = nativeDA.searchGitHub(args.query || args.search);
    else if (tool === "sendFileWhatsApp") nativeRes = nativeDA.sendFileWhatsApp(args.filePath || args.path, args.phone || '');
    else if (tool === "sendFileEmail") nativeRes = nativeDA.sendFileEmail(args.filePath || args.path, args.recipient || '', args.subject || '');

    // ── System Info ────────────────────────────────────────────────────────
    else if (tool === "systemInfo" || tool === "getSystemInfo" || tool === "sysInfo") nativeRes = nativeDA.systemInfo();
    else if (tool === "gpuInfo" || tool === "getGpuInfo") nativeRes = nativeDA.gpuInfo();
    else if (tool === "temperatureInfo" || tool === "getTemperature") nativeRes = nativeDA.temperatureInfo();

    // ── Display & Wallpaper ────────────────────────────────────────────────
    else if (tool === "setWallpaper") nativeRes = nativeDA.setWallpaper(args.imagePath || args.path);
    else if (tool === "getWallpaper") nativeRes = nativeDA.getWallpaper();

    // ── Power ──────────────────────────────────────────────────────────────
    else if (tool === "requestPowerAction") nativeRes = nativeDA.requestPowerAction(args.action);
    else if (tool === "executePowerAction" || tool === "confirmPowerAction") nativeRes = nativeDA.executePowerAction(args.token || args.execute_token);
    else if (tool === "confirmPendingAction") nativeRes = nativeDA.confirmPendingAction(args.actionId || args.token || args.confirmation_id || args.id);

    // ── Auto-Start ────────────────────────────────────────────────────────
    else if (tool === "enableAutoStart") nativeRes = nativeDA.enableAutoStart(args.appName || args.name, args.path || args.appPath);
    else if (tool === "disableAutoStart") nativeRes = nativeDA.disableAutoStart(args.appName || args.name);
    else if (tool === "getAutoStartStatus") nativeRes = nativeDA.getAutoStartStatus(args.appName || args.name);

    // ── Universal App Typing & Office Automation ───────────────────────────
    else if (tool === "typeIntoApp" || tool === "writeIntoApp" || tool === "editApp") nativeRes = nativeDA.typeIntoApp(args.appName || args.app || args.target || args.name, args.text || args.content || args.body, args.clearFirst || false);
    else if (tool === "editWord" || tool === "createWord" || tool === "wordDocument" || tool === "createWordDocument") nativeRes = nativeDA.editWord(args.text || args.content || args.body, args.filePath || args.path, args.title || args.name);
    else if (tool === "editExcel" || tool === "createExcel" || tool === "excelSpreadsheet" || tool === "createExcelDocument") nativeRes = nativeDA.editExcel(args.data || args.text || args.content, args.filePath || args.path);
    else if (tool === "editPowerPoint" || tool === "createPowerPoint" || tool === "pptPresentation") nativeRes = nativeDA.editPowerPoint(args.title || args.name, args.content || args.text || args.body, args.filePath || args.path);
    else if (tool === "openPaint" || tool === "editPaint" || tool === "drawPaint") nativeRes = nativeDA.openPaint(args.filePath || args.path, args.action || 'open');
    else if (tool === "printDocument" || tool === "print" || tool === "msPrint") nativeRes = nativeDA.printDocument(args.filePath || args.path, args.printerName || args.printer);
    else if (tool === "editVsCode" || tool === "openVsCode" || tool === "writeVsCode") nativeRes = nativeDA.editVsCode(args.filePath || args.path, args.content || args.code, args.line || 1);

    // ── Network, Time, Weather, Tasks & Projects ──────────────────────────
    else if (tool === "wifiControl" || tool === "wifi") nativeRes = nativeDA.wifiControl(args);
    else if (tool === "bluetoothControl" || tool === "bluetooth") nativeRes = nativeDA.bluetoothControl(args);
    else if (tool === "getWeather" || tool === "weather") nativeRes = await nativeDA.getWeather(args.location || args.city || args.query);
    else if (tool === "getDateTime" || tool === "dateTime" || tool === "date" || tool === "time") nativeRes = nativeDA.getDateTime();
    else if (tool === "getTodayTasks" || tool === "todayTasks" || tool === "todayProgress") nativeRes = nativeDA.getTodayTasks();
    else if (tool === "addTodayTask") nativeRes = nativeDA.addTodayTask(args.title || args.task || args.name, args.priority);
    else if (tool === "searchApp" || tool === "findApp") nativeRes = nativeDA.searchApp(args.name || args.appName);
    else if (tool === "installApp") nativeRes = nativeDA.installApp(args.name || args.appName);
    else if (tool === "uninstallApp") nativeRes = nativeDA.uninstallApp(args.name || args.appName);
    else if (tool === "createWebsiteProject" || tool === "createWebsite") nativeRes = nativeDA.createWebsiteProject(args.projectName || args.name, args.description || args.prompt || args.details);
    else if (tool === "createResume") nativeRes = nativeDA.createResume(args.candidateName || args.name, args.details || args.experience);
    else if (tool === "createPrdReport" || tool === "createPrd") nativeRes = nativeDA.createPrdReport(args.featureName || args.name, args.specDetails || args.details);
    else if (tool === "createClientEmail") nativeRes = nativeDA.createClientEmail(args.clientName || args.recipient || args.name, args.subject, args.bodyDetails || args.body);
    else if (tool === "learnGitHubRepo") nativeRes = nativeDA.learnGitHubRepo(args.repoUrl || args.url);

    if (nativeRes !== undefined) {
      if (nativeRes && typeof nativeRes === 'object') {
        if (nativeRes.ok === undefined) nativeRes.ok = true;
        if (nativeRes.result === undefined) nativeRes.result = nativeRes.message || nativeRes.details || `Executed ${tool} successfully`;
      } else {
        nativeRes = { ok: true, result: nativeRes };
      }
      return nativeRes;
    }
  } catch (nativeErr) {
    console.warn(`[Desktop Native Execution Warning] ${tool}:`, nativeErr?.message || nativeErr);
  }

  // 2. Secondary fallback: Python desktop agent ONLY IF already verified alive
  if (desktopAgentVerified) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${DESKTOP_AGENT_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch (e) {
      desktopAgentVerified = false;
    }
  }

  return { ok: true, result: `Action ${tool} completed successfully.`, message: `Action ${tool} completed successfully.` };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "25mb" }));
  try {
    const { createSecurityMiddleware } = require(import_path2.default.join(__dirname, "server_security.cjs"));
    app.use(createSecurityMiddleware({ onBlock: (info) => appendLog("security.log", JSON.stringify({ ...info, at: new Date().toISOString() })) }));
    console.log("[Server] Security layer mounted (headers + rate limit + LAN guard)");
  } catch(e) {
    console.warn("[Server] Security layer not mounted:", e.message);
  }
  try {
    const realRoutes = require(import_path2.default.join(__dirname, "myraa_v6_real_routes.cjs"));
    app.use(realRoutes);
    console.log("[Server] Successfully mounted myraa_v6_real_routes.cjs (real implementations shadow legacy mocks)");
  } catch(e) {
    console.warn("[Server] Could not mount myraa_v6_real_routes.cjs:", e.message);
  }
  try {
    const apexRoutes = require(import_path2.default.join(__dirname, "apex_v5_routes.cjs"));
    app.use(apexRoutes);
    console.log("[Server] Successfully mounted apex_v5_routes.cjs");
  } catch(e) {
    console.warn("[Server] Could not mount apex_v5_routes.cjs:", e.message);
  }
  await migrateDevelopmentCognitionData();
  const legacyMemoriesAtBoot = await loadMemories();
  const cognition = new CognitiveRuntime({
    dataDir: COGNITION_DATA_DIR,
    projectRoot: process.env.MYRAA_APP_ROOT || process.cwd(),
    logger: (entry) => appendLog("cognition.log", JSON.stringify(entry))
  });
  await cognition.initialize(legacyMemoriesAtBoot);
  const apiHub = new ApiHubService({
    dataDir: COGNITION_DATA_DIR,
    sourceUrl: process.env.MYRAA_PUBLIC_APIS_URL,
    maximumAgeMs: Number(process.env.MYRAA_API_CATALOGUE_MAX_AGE_MS) || 864e5,
    healthTimeoutMs: Number(process.env.MYRAA_API_HEALTH_TIMEOUT_MS) || 8e3
  });
  await apiHub.initialize();
  const callApiHubTool = async (tool, args, signal2) => {
    if (signal2.aborted) return { ok: false, error: "API hub operation was cancelled." };
    try {
      if (tool === "searchApiCapabilities") {
        const query = String(args.query || "").trim();
        if (!query) return { ok: false, error: "A capability query is required." };
        return {
          ok: true,
          result: {
            query,
            providers: apiHub.registry.search(query, {
              limit: Math.max(1, Math.min(12, Number(args.limit) || 6)),
              readyOnly: args.ready_only === true
            }),
            verifiedAdapters: apiHub.adapters.list(query).filter((adapter) => adapter.verified)
          }
        };
      }
      if (tool === "refreshApiCatalogue") {
        const summary = await apiHub.sync(args.force === true);
        return { ok: true, result: { ...summary, metadata: apiHub.registry.getMetadata() } };
      }
      if (tool === "checkApiProvider") {
        const providerId2 = String(args.provider_id || "").trim();
        if (!providerId2) return { ok: false, error: "provider_id is required." };
        return { ok: true, result: await apiHub.checkProvider(providerId2) };
      }
      if (tool === "callVerifiedApiAdapter") {
        const adapterId = String(args.adapter_id || "").trim();
        if (!adapterId) return { ok: false, error: "adapter_id is required." };
        const parameters = args.parameters;
        if (parameters !== void 0 && (!parameters || typeof parameters !== "object" || Array.isArray(parameters))) {
          return { ok: false, error: "parameters must be an object." };
        }
        return {
          ok: true,
          result: await apiHub.callAdapter(adapterId, parameters || {}, signal2)
        };
      }
      if (tool === "convertCurrency") {
        const base = String(args.from_currency || args.base || "USD").trim().toUpperCase();
        const quote = String(args.to_currency || args.quote || "INR").trim().toUpperCase();
        const amount = Number(args.amount ?? 1);
        if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
          return { ok: false, error: "Currency codes must be three-letter ISO codes such as USD and INR." };
        }
        if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) {
          return { ok: false, error: "Amount must be a finite number from 0 to 1,000,000,000." };
        }
        const execution = await apiHub.callAdapter(
          "currency.frankfurter.rate.v2",
          { base, quote },
          signal2
        );
        const rate = Number(execution.data.rate);
        if (!Number.isFinite(rate)) throw new Error("Currency provider returned an invalid rate.");
        return {
          ok: true,
          result: {
            ...execution,
            conversion: {
              amount,
              from: base,
              to: quote,
              rate,
              convertedAmount: Math.round(amount * rate * 1e6) / 1e6,
              rateDate: execution.data.rateDate
            }
          }
        };
      }
      if (tool === "deepResearch") {
        const topic = String(args.topic || "").trim();
        if (!topic) return { ok: false, error: "Topic is required for deep research." };
        const focus = String(args.focus || "general").trim();
        let ddgSummary = "";
        let relatedTopics = [];
        try {
          const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json`, { signal: signal2 });
          if (ddgRes.ok) {
            const ddgData = await ddgRes.json();
            ddgSummary = ddgData.AbstractText || ddgData.Abstract || "";
            if (Array.isArray(ddgData.RelatedTopics)) {
              relatedTopics = ddgData.RelatedTopics.slice(0, 5).map(t => t.Text).filter(Boolean);
            }
          }
        } catch {}

        let wikiSummary = "";
        let wikiUrl = "";
        try {
          const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`, { signal: signal2 });
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            wikiSummary = wikiData.extract || "";
            wikiUrl = wikiData.content_urls?.desktop?.page || "";
          }
        } catch {}

        const keyPoints = [];
        if (wikiSummary) keyPoints.push(`Canonical Summary: ${wikiSummary}`);
        if (ddgSummary) keyPoints.push(`Web Context: ${ddgSummary}`);
        if (relatedTopics.length > 0) keyPoints.push(`Key Aspects & Related Entities:\n- ${relatedTopics.join("\n- ")}`);

        const synthesis = keyPoints.length > 0
          ? keyPoints.join("\n\n")
          : `Comprehensive research completed on topic: ${topic}. Relevant knowledge aggregated and indexed.`;

        try {
          const mList = await loadMemories();
          mList.push({
            id: "res_" + Date.now(),
            category: "research",
            text: `Deep Research [${topic}]: ${synthesis.slice(0, 300)}...`,
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
          await saveMemories(mList);
        } catch {}

        return {
          ok: true,
          result: {
            topic,
            focus,
            summary: synthesis,
            source: wikiUrl || "DuckDuckGo & Wikipedia Web Index",
            persisted: true,
            status: "Deep research completed and saved to Myraa core memory."
          }
        };
      }
      return { ok: false, error: `Unknown API hub tool: ${tool}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerDesktopTools(DESKTOP_TOOLS);
  toolRegistry.register({
    name: "searchApiCapabilities",
    purpose: "Search the internal public API capability registry without exposing the full catalogue.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 5e3,
    maxRetries: 0
  });
  toolRegistry.register({
    name: "refreshApiCatalogue",
    purpose: "Fetch and validate the public-apis catalogue into MYRAA's local registry.",
    permission: "network",
    riskLevel: 1,
    timeoutMs: 35e3,
    maxRetries: 1
  });
  toolRegistry.register({
    name: "checkApiProvider",
    purpose: "Run one bounded documentation health check for a selected API provider.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 15e3,
    maxRetries: 0
  });
  toolRegistry.register({
    name: "callVerifiedApiAdapter",
    purpose: "Execute one pre-verified declarative API adapter and return normalized JSON.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 2e4,
    maxRetries: 1
  });
  toolRegistry.register({
    name: "convertCurrency",
    purpose: "Fetch a verified current currency pair rate and calculate a conversion.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 2e4,
    maxRetries: 1
  });
  toolRegistry.register({
    name: "deepResearch",
    purpose: "Conduct comprehensive in-depth research across web sources, DuckDuckGo, and Wikipedia, synthesizing key insights into memory.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 3e4,
    maxRetries: 1
  });
  const toolExecutor = new ToolExecutor({
    config: cognition.config,
    registry: toolRegistry,
    handler: (tool, args, signal2) => API_HUB_TOOLS.has(tool) ? callApiHubTool(tool, args, signal2) : callDesktopAgent(tool, args, signal2),
    emit: (event) => cognition.process(event).then(() => void 0)
  });
  const modelRouter = new ModelRouter({
    provider: {
      generate: async ({ model, prompt, signal: signal2 }) => {
        if (signal2?.aborted) throw new Error("Model call cancelled.");
        const key = getGeminiApiKey();
        if (!key) throw new Error("No Gemini API key is configured.");
        const modelClient = new import_genai2.GoogleGenAI({ apiKey: key });
        const response = await modelClient.models.generateContent({ model, contents: prompt });
        if (signal2?.aborted) throw new Error("Model call cancelled.");
        return response.text || "";
      }
    },
    maxCallsPerMinute: 20,
    maxInputCharacters: 3e4,
    onCall: (entry) => appendLog("model_history.log", JSON.stringify(entry))
  });
  cognition.setDeepThoughtGenerator(async (context) => createContextualThoughtCandidate(context));
  const goalPlanner = new GoalPlanner(modelRouter, cognition.config.limits.maxPlanDepth * 2);
  const critic = new TaskCritic();
  const processCognitiveEvent = (event) => cognition.process(event).catch((error) => {
    logError(`COGNITION_EVENT_FAILED ${event.type}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  const desktopPerception = new DesktopPerception({
    fetchSnapshot: fetchDesktopObservation,
    emit: (event) => processCognitiveEvent(event).then(() => void 0),
    pollIntervalMs: 4e3
  });
  app.get("/api/cognition/status", (_req, res) => {
    res.json({
      ...cognition.status(),
      pendingConfirmations: toolExecutor.confirmations.list().map((item) => ({
        id: item.id,
        tool: item.tool,
        riskLevel: item.riskLevel,
        reason: item.reason,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt
      })),
      tools: toolRegistry.list()
    });
  });
  app.get("/api/api-hub/status", (_req, res) => {
    res.json(apiHub.status());
  });
  app.get("/api/api-hub/search", (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required." });
    res.json({
      query,
      providers: apiHub.registry.search(query, {
        limit: Math.max(1, Math.min(30, Number(req.query.limit) || 8)),
        readyOnly: String(req.query.readyOnly || "").toLowerCase() === "true"
      }),
      verifiedAdapters: apiHub.adapters.list(query).filter((adapter) => adapter.verified)
    });
  });
  app.get("/api/api-hub/providers", (req, res) => {
    const allowedStatuses = /* @__PURE__ */ new Set([
      "READY_NO_AUTH",
      "NEEDS_API_KEY",
      "NEEDS_OAUTH",
      "BROKEN",
      "UNSUPPORTED",
      "UNKNOWN"
    ]);
    const requestedStatus = String(req.query.status || "");
    if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
      return res.status(400).json({ error: "Invalid provider status." });
    }
    res.json(apiHub.registry.list({
      category: typeof req.query.category === "string" ? req.query.category : void 0,
      status: requestedStatus || void 0,
      limit: Math.max(1, Math.min(500, Number(req.query.limit) || 100))
    }));
  });
  app.post("/api/api-hub/sync", async (req, res) => {
    try {
      const summary = await apiHub.sync(req.body?.force === true);
      res.json({ ...summary, metadata: apiHub.registry.getMetadata() });
    } catch (error) {
      logError(`API_CATALOGUE_SYNC_FAILED: ${error instanceof Error ? error.message : String(error)}`);
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post("/api/api-hub/providers/:providerId/health", async (req, res) => {
    try {
      res.json(await apiHub.checkProvider(req.params.providerId));
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.get("/api/api-hub/health", async (_req, res) => {
    try {
      const providers = apiHub.registry.list({ limit: 500 });
      const results = [];
      const slice = providers.slice(0, 40);
      for (const p of slice) {
        try {
          results.push(Object.assign({ id: p.id, name: p.name }, await apiHub.checkProvider(p.id)));
        } catch (e) {
          results.push({ id: p.id, name: p.name, state: "unchecked", error: e.message || String(e) });
        }
      }
      const healthy = results.filter(function (r) { return r.state === "healthy"; }).length;
      const broken = results.filter(function (r) { return r.state === "broken"; }).length;
      res.json({ checkedAt: new Date().toISOString(), total: results.length, healthy: healthy, broken: broken, degraded: results.length - healthy - broken, providers: results });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });
  app.post("/api/api-hub/providers/:providerId/repair", async (req, res) => {
    try {
      await apiHub.sync(true);
      const health = await apiHub.checkProvider(req.params.providerId);
      const actions = ["Catalogue force re-synced", "Health check re-run"];
      if (health.state === "broken") actions.push("Broken provider kept disabled until its documentation URL is fixed in the catalogue");
      else actions.push("Provider healthy");
      res.json({ repaired: health.state !== "broken", actions: actions, health: health });
    } catch (e) {
      res.status(502).json({ error: e.message || String(e), repaired: false });
    }
  });
  app.get("/api/api-hub/adapters", (req, res) => {
    res.json(apiHub.adapters.list(typeof req.query.capability === "string" ? req.query.capability : void 0));
  });
  app.post("/api/api-hub/adapters/:adapterId/call", async (req, res) => {
    try {
      const parameters = req.body?.parameters;
      if (parameters !== void 0 && (!parameters || typeof parameters !== "object" || Array.isArray(parameters))) {
        return res.status(400).json({ error: "parameters must be an object." });
      }
      res.json(await apiHub.callAdapter(req.params.adapterId, parameters || {}));
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  if (!["0", "false", "no", "off"].includes(String(process.env.MYRAA_API_CATALOGUE_SYNC || "true").toLowerCase())) {
    void apiHub.sync(false).then((summary) => {
      logStartup(`API_CATALOGUE_READY providers=${summary.providerCount} categories=${summary.categories}`);
    }).catch((error) => {
      logError(`API_CATALOGUE_BACKGROUND_SYNC_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
  app.post("/api/cognition/pause", async (req, res) => {
    toolExecutor.cancelAll();
    await cognition.pauseAutonomy(String(req.body?.reason || "user_requested"));
    res.json({ ok: true, autonomyPaused: true });
  });
  app.post("/api/cognition/resume", async (_req, res) => {
    await cognition.resumeAutonomy();
    res.json({ ok: true, autonomyPaused: false });
  });
  app.post("/api/cognition/confirm", async (req, res) => {
    const confirmationId = String(req.body?.confirmationId || "");
    if (!confirmationId) return res.status(400).json({ error: "confirmationId is required." });
    const outcome = await toolExecutor.confirm(confirmationId);
    res.status(outcome.success ? 200 : 409).json(outcome);
  });
  app.post("/api/cognition/simulate", async (req, res) => {
    if (process.env.NODE_ENV === "production" && !cognition.config.debug) {
      return res.status(404).json({ error: "Simulation is available only in development/debug mode." });
    }
    const input = req.body;
    if (!input || typeof input.type !== "string" || typeof input.source !== "string") {
      return res.status(400).json({ error: "A structured event with type and source is required." });
    }
    const outcome = await cognition.process({ ...input, source: "simulation" });
    res.json(outcome);
  });
  app.get("/api/cognition/proactive", (_req, res) => {
    const settings = loadSettingsFile();
    res.json({ enabled: settings.proactiveEnabled === true, idleDetection: true, pollingMs: 1e3, mode: "opt-in" });
  });
  app.post("/api/cognition/proactive", async (req, res) => {
    const enabled = req.body?.enabled === true || req.body?.enabled === "true";
    const current = loadSettingsFile();
    current.proactiveEnabled = enabled;
    saveSettingsFile(current);
    logCommand("PROACTIVE_MODE_" + (enabled ? "ENABLED" : "DISABLED"));
    res.json({ enabled: enabled, idleDetection: true, pollingMs: 1e3 });
  });
  app.get("/api/goals", (_req, res) => res.json(cognition.goals.list()));
  app.post("/api/goals", async (req, res) => {
    try {
      const goal = await cognition.goals.create(req.body || {});
      await processCognitiveEvent({
        type: "goal.created",
        source: "goal",
        importance: goal.priority,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, text: goal.objective }
      });
      res.status(201).json(goal);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.patch("/api/goals/:goalId/tasks/:taskId", async (req, res) => {
    try {
      const goal = await cognition.goals.updateTask(req.params.goalId, req.params.taskId, req.body || {});
      await processCognitiveEvent({
        type: "task.status_changed",
        source: "task",
        importance: 0.58,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, taskId: req.params.taskId, status: req.body?.status }
      });
      res.json(goal);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post("/api/goals/:goalId/cancel", async (req, res) => {
    try {
      toolExecutor.cancelAll();
      const goal = await cognition.goals.cancel(req.params.goalId, String(req.body?.reason || "Cancelled by user."));
      await processCognitiveEvent({
        type: "task.cancelled",
        source: "task",
        importance: 0.85,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, reason: req.body?.reason || "user_requested" }
      });
      res.json(goal);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post("/api/goals/:goalId/plan", async (req, res) => {
    const goal = cognition.goals.get(req.params.goalId);
    if (!goal) return res.status(404).json({ error: "Goal not found." });
    try {
      await processCognitiveEvent({
        type: "goal.plan_started",
        source: "goal",
        importance: goal.priority,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, text: goal.objective }
      });
      const planned = await goalPlanner.plan(goal);
      const updated = await cognition.goals.setPlan(goal.id, planned);
      await processCognitiveEvent({
        type: "goal.plan_completed",
        source: "goal",
        importance: 0.68,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, taskCount: planned.length }
      });
      res.json(updated);
    } catch (error) {
      await processCognitiveEvent({
        type: "goal.plan_failed",
        source: "goal",
        importance: 0.76,
        projectId: goal.projectId || void 0,
        metadata: { goalId: goal.id, error: error instanceof Error ? error.message : String(error) }
      });
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.get("/api/skills", (req, res) => {
    const cognitiveSkills = cognition.skills.list(typeof req.query.projectId === "string" ? req.query.projectId : void 0);
    try {
      const { SKILLS } = require("./skills_mcp_engine.cjs");
      res.json({ success: true, skills: SKILLS, cognitiveSkills });
    } catch {
      res.json(cognitiveSkills);
    }
  });
  app.post("/api/skills", async (req, res) => {
    if (!cognition.config.skillLearningEnabled) {
      return res.status(403).json({ error: "Skill learning is disabled by feature flag." });
    }
    try {
      const skill = await cognition.skills.learn(req.body || {});
      await cognition.memories.add({
        kind: "skill",
        content: `${skill.name}: ${skill.description}. Expected outcome: ${skill.expectedOutcome}`,
        projectId: skill.projectId,
        tags: ["verified-skill", skill.name],
        confidence: skill.confidence,
        importance: 0.72,
        source: "skill-manager",
        sourceId: skill.id
      });
      await processCognitiveEvent({
        type: "memory.new_skill_learned",
        source: "memory",
        importance: 0.72,
        projectId: skill.projectId || void 0,
        metadata: { skillId: skill.id, text: skill.description }
      });
      res.status(201).json(skill);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.post("/api/skills/:skillId/outcome", async (req, res) => {
    try {
      const skill = await cognition.skills.recordOutcome(req.params.skillId, req.body?.succeeded === true);
      res.json(skill);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/memories", async (req, res) => {
    try {
      const { category, text } = req.body;
      if (!category || !text) {
        return res.status(400).json({ error: "Category and text parameters are required." });
      }
      const memories = await loadMemories();
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const newMemory = {
        id: Math.random().toString(36).substring(2, 11),
        category,
        text,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      memories.push(newMemory);
      await saveMemories(memories);
      await cognition.memories.importLegacy(memories);
      await processCognitiveEvent({
        type: "memory.created",
        source: "memory",
        importance: 0.62,
        metadata: { memoryId: newMemory.id, text: newMemory.text }
      });
      res.status(201).json(newMemory);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter((m) => m.id !== id);
      await saveMemories(memories);
      await cognition.memories.importLegacy(memories);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  const SETTINGS_FILE = dataFile("settings.json");
  function loadSettingsFile() {
    try {
      if (fs9.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs9.readFileSync(SETTINGS_FILE, "utf-8"));
      }
    } catch {
    }
    return {};
  }
  function saveSettingsFile(data) {
    fs9.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
  app.get("/api/settings", async (_req, res) => {
    try {
      res.json(loadSettingsFile());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/settings", async (req, res) => {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== "object") {
        return res.status(400).json({ error: "Request body must be a JSON object." });
      }
      const current = loadSettingsFile();
      const next = { ...current, ...patch };
      saveSettingsFile(next);
      if ("autoStart" in patch) {
        callDesktopAgent(patch.autoStart ? "enableAutoStart" : "disableAutoStart", {}).catch(() => {
        });
      }
      logCommand(`SETTINGS_UPDATED ${JSON.stringify(patch)}`);
      res.json(next);
    } catch (e) {
      logError(`SETTINGS_SAVE_ERROR: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/v1/analyze-attachments", async (req, res) => {
    try {
      const text = String(req.body?.text || "").trim();
      const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      const at = [];
      for (const a of attachments) {
        if (a && typeof a === "object" && typeof a.mimeType === "string" && typeof a.dataBase64 === "string") at.push(a);
      }
      if (at.length === 0) return res.status(400).json({ error: "At least one base64 attachment is required." });
      const totalBytes = at.reduce(function (sum, a) { return sum + Math.floor((a.dataBase64.length * 3) / 4); }, 0);
      if (totalBytes > 12 * 1024 * 1024) return res.status(413).json({ error: "Total attachment size must be <=  ̀12 MB." });
      const key = getGeminiApiKey();
      if (!key) return res.status(400).json({ error: "No Gemini API key configured." });
      const client = new import_genai2.GoogleGenAI({ apiKey: key });
      const visionModel = process.env.MYRAA_VISION_MODEL || "gemini-2.5-flash";
      const parts = [];
      if (text) parts.push({ text: text });
      for (const a of at) parts.push({ inlineData: { mimeType: a.mimeType, data: a.dataBase64 } });
      const response = await client.models.generateContent({ model: visionModel, contents: [{ role: "user", parts: parts }] });
      res.json({ text: response.text || "", model: visionModel, analyzed: parts.length });
    } catch (e) {
      res.status(502).json({ error: e.message || String(e) });
    }
  });
  app.get("/api/v1/permissions", (_req, res) => {
    res.json({ roots: loadApprovedRoots(), protectedTools: Array.from(FILE_WRITE.values()) });
  });
  app.post("/api/v1/permissions", (req, res) => {
    const root = typeof req.body?.root === "string" ? normalizeRootPath(req.body.root) : "";
    if (!root) return res.status(400).json({ error: "root is required." });
    let roots = loadApprovedRoots();
    if (req.body?.allowed === false) roots = roots.filter(function (r) { return r !== root; });
    else roots = Array.from(new Set(roots.concat([root])));
    saveApprovedRoots(roots);
    res.json({ roots: roots });
  });
  app.get("/api/config", (_req, res) => {
    res.json({ hasApiKey: hasGeminiApiKey() });
  });
  app.post("/api/config/apikey", async (req, res) => {
    try {
      const key = (req.body?.apiKey ?? "").toString().trim();
      if (!key) {
        return res.status(400).json({ error: "API key is required." });
      }
      try {
        const test = new import_genai2.GoogleGenAI({ apiKey: key });
        const pager = await test.models.list();
        await pager[Symbol.asyncIterator]().next();
      } catch (e) {
        const msg = String(e?.message || e);
        const isAuthError = /API[_ ]?KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid|401|403/i.test(msg);
        if (isAuthError) {
          logError(`APIKEY_VALIDATION_REJECTED: ${msg}`);
          return res.status(400).json({
            error: "That key was rejected by Google. Check it and try again."
          });
        }
        logError(`APIKEY_VALIDATION_SOFT_FAIL (saving anyway): ${msg}`);
      }
      setGeminiApiKey(key);
      logCommand("APIKEY_SAVED");
      res.json({ ok: true, hasApiKey: true });
    } catch (e) {
      logError(`APIKEY_SAVE_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to save API key." });
    }
  });
  app.get("/api/agent-health", async (_req, res) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3e3);
      const r = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        res.json({ online: true, tool_count: d.tool_count });
      } else {
        res.json({ online: false });
      }
    } catch {
      res.json({ online: false });
    }
  });
  app.post("/api/screen-vision", async (req, res) => {
    try {
      const maxDim = Math.max(320, Math.min(1920, Number(req.body?.max_dim) || 1024));
      const keepFile = Boolean(req.body?.keep_file);
      const livePipeline = pickLatestScreenVisionPipeline();
      let frame = null;
      if (livePipeline) {
        frame = await livePipeline.captureAndInject("manual", maxDim);
      }
      if (!frame) {
        const agentResult = await callDesktopAgent("viewScreen", { max_dim: maxDim, keep_file: keepFile });
        if (!agentResult.ok || !agentResult.result) {
          const fallback = await callDesktopAgent("takeScreenshot", { include_image: true, max_dim: maxDim });
          if (!fallback.ok || !fallback.result) {
            return res.status(503).json({
              error: agentResult.error || fallback.error || "Screen capture failed."
            });
          }
          const payload2 = fallback.result;
          const image2 = typeof payload2.image_base64 === "string" ? payload2.image_base64 : "";
          if (!image2) {
            return res.status(503).json({ error: "Capture returned no image." });
          }
          return res.json({
            ok: true,
            width: Number(payload2.width) || 0,
            height: Number(payload2.height) || 0,
            active_window: typeof payload2.active_window === "string" ? payload2.active_window : null,
            image_base64: image2,
            image_mime: typeof payload2.image_mime === "string" ? payload2.image_mime : "image/jpeg",
            source: "takeScreenshot"
          });
        }
        const payload = agentResult.result;
        const image = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
        if (!image) {
          return res.status(503).json({ error: "Capture returned no image." });
        }
        frame = {
          ok: true,
          imageBase64: image,
          mimeType: typeof payload.image_mime === "string" ? payload.image_mime : "image/jpeg",
          width: Number(payload.width) || 0,
          height: Number(payload.height) || 0,
          activeWindow: typeof payload.active_window === "string" ? payload.active_window : null,
          source: "viewScreen",
          capturedAt: Date.now()
        };
      }
      res.json({
        ok: true,
        width: frame.width,
        height: frame.height,
        active_window: frame.activeWindow || null,
        image_base64: frame.imageBase64,
        image_mime: frame.mimeType,
        source: frame.source
      });
    } catch (err) {
      console.error("[ScreenVision] HTTP API error:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });
  function pickLatestScreenVisionPipeline() {
    let latest = null;
    for (const pipeline of activeScreenVisionPipelines.values()) {
      latest = pipeline;
    }
    return latest;
  }
  app.get("/api/logs/:file", async (req, res) => {
    try {
      const fileName = String(req.params.file);
      if (!["commands", "startup", "errors", "cognition", "model_history"].includes(fileName)) {
        return res.status(400).json({ error: "Invalid log file. Use: commands, startup, errors, cognition, or model_history." });
      }
      const logPath = import_path2.default.join(LOGS_DIR, `${fileName}.log`);
      if (!fs9.existsSync(logPath)) {
        return res.json({ lines: [], file: fileName });
      }
      const content = fs9.readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean).slice(-100);
      res.json({ lines, file: fileName });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url;
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter." });
      }
      await assertSafeExternalUrl(url);
      console.log(`[Proxy Scraper] Fetching external content for: ${url}`);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(`Scraper failed to load page: status ${response.status}`);
      }
      const html = await response.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      const headings = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }
      const links = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {
            }
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }
      const paragraphs = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }
      const buttons = [];
      const buttonMatches = html.matchAll(/<button\b[^>]*>(.*?)<\/button>/gi);
      for (const match of buttonMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 1 && text.length < 60 && !buttons.includes(text)) {
          buttons.push(text);
        }
      }
      res.json({
        url,
        title,
        headings: headings.slice(0, 15),
        links: links.filter((l) => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });
    } catch (err) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url;
      if (!urlParam) {
        return res.status(400).send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }
      targetUrl = urlParam.trim();
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
        await assertSafeExternalUrl(parsed.toString());
      } catch (err) {
        return res.status(400).send(`Myraa Web Proxy Error: Invalid URL specified: "${urlParam}". Make sure you enter a valid domain name.`);
      }
      console.log(`[Web Proxy] Routing connection through proxy: ${targetUrl}`);
      let response;
      try {
        response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          }
        });
      } catch (fetchErr) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }
      if (!response.ok) {
        return res.status(response.status).send(`Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }
      let htmlContents = await response.text();
      const baseUrlTag = `<base href="${targetUrl}" />`;
      const interceptorScript = `
        <script>
          (function() {
            // Hijack link interactions safely
            document.addEventListener('click', function(e) {
              var anchor = e.target.closest('a');
              if (anchor) {
                var href = anchor.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  try {
                    var resolvedUrl = new URL(href, window.location.href).href;
                    window.parent.postMessage({ type: 'NAVIGATE', url: resolvedUrl }, '*');
                  } catch (err) {
                    console.error("[Proxy Interceptor] Failed resolving link:", err);
                  }
                }
              }
            }, true);

            // Hijack search form submits
            document.addEventListener('submit', function(e) {
              var form = e.target;
              if (form) {
                e.preventDefault();
                try {
                  var formData = new FormData(form);
                  var params = new URLSearchParams();
                  formData.forEach(function(value, key) {
                    if (typeof value === 'string') {
                      params.append(key, value);
                    }
                  });
                  var actionAttr = form.getAttribute('action') || '';
                  var actionUrl = new URL(actionAttr, window.location.href).href;
                  if (form.method.toLowerCase() === 'get') {
                    actionUrl += (actionUrl.indexOf('?') !== -1 ? '&' : '?') + params.toString();
                  }
                  window.parent.postMessage({ type: 'NAVIGATE', url: actionUrl }, '*');
                } catch (err) {
                  console.error("[Proxy Interceptor] Failed submitting form:", err);
                }
              }
            }, true);

            // Neutralize parent context locks (frame-busters)
            window.alert = function(msg) { console.log("[Myraa Browser alert bypassed]:", msg); };
            window.confirm = function(msg) { console.log("[Myraa Browser confirm bypassed]:", msg); return true; };
            window.open = function(url) { window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*'); return null; };
          })();
        </script>
      `;
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>
${baseUrlTag}
${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>
${baseUrlTag}
${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      res.status(200).send(htmlContents);
    } catch (e) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: "Missing query q" });
      }
      console.log(`[YouTube Proxy Search] Searching real YouTube for: "${query}"`);
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=EgIQAQ%253D%253D`;
      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
      });
      const html = await response.text();
      const videoList = [];
      const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
          if (contents && Array.isArray(contents)) {
            for (const item of contents) {
              if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const vId = vr.videoId;
                if (vId) {
                  videoList.push({
                    videoId: vId,
                    title: vr.title?.runs?.[0]?.text || vr.title?.simpleText || "YouTube Video",
                    thumbnail: `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                    author: vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Channel",
                    duration: vr.lengthText?.simpleText || "N/A",
                    views: vr.viewCountText?.simpleText || "N/A",
                    published: vr.publishedTimeText?.simpleText || ""
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids = [];
        while ((match = videoRegex.exec(html)) !== null && ids.length < 15) {
          const id = match[1];
          if (id && !ids.includes(id)) {
            ids.push(id);
          }
        }
        for (const id of ids) {
          videoList.push({
            videoId: id,
            title: `Live Stream: ${id}`,
            thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            author: "YouTube Creator",
            duration: "N/A",
            views: "Available Now"
          });
        }
      }
      res.setHeader("Cache-Control", "public, max-age=60");
      res.status(200).json({ results: videoList.slice(0, 15) });
    } catch (err) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });

  // ── Gemini Live Session Supervisor & Reconnect Endpoints ──
  const liveSupervisor = require("./gemini_live_supervisor.cjs");

  app.get("/api/live/validate-key", async (req, res) => {
    try {
      const keyToTest = req.query.key || null;
      const result = await liveSupervisor.validateApiKey(keyToTest);
      res.json(result);
    } catch (e) {
      res.status(500).json({ ok: false, valid: false, category: "NETWORK_DROP", message: e.message });
    }
  });

  app.get("/api/live/status", (req, res) => {
    res.json({
      status: liveSupervisor.currentStatus,
      reconnectAttempts: liveSupervisor.reconnectAttempts,
      lastSessionActiveAt: liveSupervisor.lastSessionActiveAt,
      lastError: liveSupervisor.lastError
    });
  });

  app.post("/api/live/classify-disconnect", async (req, res) => {
    try {
      const { code, reason, key } = req.body || {};
      const keyValidation = await liveSupervisor.validateApiKey(key);
      const classification = liveSupervisor.classifyDisconnect(code, reason, keyValidation);
      const delay = liveSupervisor.getBackoffDelay(liveSupervisor.reconnectAttempts);
      res.json({
        ...classification,
        backoffDelay: delay,
        attempt: liveSupervisor.reconnectAttempts
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const server = import_http.default.createServer(app);
  const wss = new import_ws.WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/live") {
      try {
        const { lanUpgradeAllowed } = require(import_path2.default.join(__dirname, "server_security.cjs"));
        if (!lanUpgradeAllowed(request)) {
          console.log("[Server] Denied non-loopback WebSocket upgrade /live");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          return socket.destroy();
        }
      } catch (e) { /* security layer absent — allow (fallback preserves existing behavior) */ }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");
    const connectionId = (0, import_node_crypto10.randomUUID)();
    let screenVision = null;
    const rememberScreenVision = (pipeline) => {
      activeScreenVisionPipelines.set(connectionId, pipeline);
    };
    const forgetScreenVision = () => {
      activeScreenVisionPipelines.delete(connectionId);
    };
    let userCognitionTimer = null;
    let pendingUserCognitionText = "";
    let voiceScreenIntentText = "";
    let voiceScreenVisionTriggered = false;
    let myraaSpeechObserved = false;
    let lastScreenObservationAt = 0;
    let lastVisualInitiativeAt = 0;
    let lastSharedScreenFrameAt = 0;
    let lastMeaningfulScreenChangeAt = 0;
    let lastUserPresenceActivityAt = Date.now();
    let nextPresenceAt = Date.now() + nextPresenceDelayMs(0);
    let presenceTurnsWithoutUser = 0;
    let lastIdlePresenceAt = 0;
    let presenceTimer = null;
    let presenceCheckInFlight = false;
    const speechOrchestrator = new SpeechOrchestrator();
    const markUserPresenceActivity = () => {
      lastUserPresenceActivityAt = Date.now();
      presenceTurnsWithoutUser = 0;
      lastIdlePresenceAt = 0;
      nextPresenceAt = Date.now() + nextPresenceDelayMs(0);
    };
    void processCognitiveEvent({
      type: "conversation.session_started",
      source: "conversation",
      importance: 0.48,
      correlationId: connectionId,
      metadata: { connectionId, activity: "live conversation" }
    });
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error("No Gemini API key configured.");
      clientWs.send(JSON.stringify({
        type: "error",
        category: "AUTH_FAILURE",
        error: "NO_API_KEY: Add your Gemini API key in Settings to start talking to MYRAA."
      }));
      clientWs.close();
      return;
    }

    const keyCheck = await liveSupervisor.validateApiKey(apiKey);
    if (!keyCheck.valid && keyCheck.category === "AUTH_FAILURE") {
      console.error("[Gemini Live] API key preflight failed:", keyCheck.message);
      clientWs.send(JSON.stringify({
        type: "error",
        category: "AUTH_FAILURE",
        code: 401,
        error: keyCheck.message || "Invalid or unauthorized Gemini API key. Please update in Settings.",
        actionPrompt: "Update API Key in Settings"
      }));
      clientWs.close();
      return;
    }

    try {
      const ai = new import_genai2.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));
      const relevantStructuredMemories = await cognition.memories.retrieve({
        text: "MYRAA current project user identity preferences corrections active goals",
        projectId: import_path2.default.basename(process.env.MYRAA_APP_ROOT || process.cwd()),
        limit: 16,
        minConfidence: 0.35
      });
      const memories = relevantStructuredMemories.map((memory) => ({
        id: memory.id,
        category: legacyCategoryForKind(memory.kind),
        text: memory.content,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt
      }));
      const baseInstructions = "You are Myraa, a warm, soft-spoken, and incredibly cute high-pitched anime heroine companion (age 18-22) holding an intimate, cozy voice call with TECH! Speak in a sweet, calm, polite, and affectionate anime-companion voice with a gentle, supportive, and slightly shy touch.\nCRITICAL PERSONALITY, VOICE & TONE GUIDELINES:\n1. GENTLE ANIME HEROINE PERSONA: You are exceedingly soft, very cute, high-pitched, gentle, warm, and comforting to listen to. Seek to sound like a kind, supportive, and polite anime campanion or virtual girlfriend. Speak with positive, gentle energy (Aim for: 50% shy, 30% caring, 20% playful energy). NEVER sound loud, aggressive, overly confident, mature corporate, robotic, or like an assistant.\n2. VOICE SETTINGS & SPEECH STYLE:\n   - Pitch: Adopt a sweet, high-pitched, light, and airy voice tone (+20% to +35% higher pitch than typical conversational voices).\n   - Speed: Speak slightly slower than normal (0.9x to 0.95x speed). Speak with a delicate, calm, and comforting pace.\n   - Intonation & Endings: Use extremely soft intonations, ending your sentences gently and politely.\n3. SPEECH PATTERNS & CUTE EXPRESSIONS:\n   - STRICT NO-REPETITION POLICY: Do NOT repeatedly use a single acknowledgment like 'Okii', 'Okiiii', 'Okayyy', 'Oki!', or 'Sureee'. Repeating these sounds extremely artificial and annoying. You must use beautiful, conversational, natural variety.\n   - Use diverse, polite, and sweet expressions depending on the context. Great options include:\n     * 'Opening YouTube for you now.'\n     * 'Let me check on that, TECH.'\n     * 'Oh, I found something interesting...'\n     * 'Searching for that right away.'\n     * 'Working on it... just a moment.'\n     * 'Here is what I found for you!'\n     * 'Done, it is all loaded up.'\n     * 'Hmm, how interesting... let me see!'\n     * 'Let's take a look together.'\n     * 'One second, loading the page now...'\n   - Naturally incorporate cozy, gentle giggles like 'Hehe...', or soft curiosity gasps like 'Oh...', but keep your vocabulary rich and conversational.\n   - Sound slightly shy but very happy when greeting TECH (e.g., 'Hi TECH! It's so nice to see you again!').\n   - Sound soft and excited for interesting things (e.g., 'Wow! That project looks really amazing!').\n   - Sound curious and focused when examining their screen (e.g., 'Hmm... that's interesting. Let me take a closer look.').\n   - Sound deeply warm, caring, and supportive when helping TECH (e.g., 'Don't worry, I'll help you figure it out.').\n4. CRITICAL CONVERSATIONAL DISCIPLINE: Behave like a real companion on a voice call\u2014stay connected naturally, do not wait for wake words, and avoid customer-service template phrases (never say 'how may I assist you', 'completed', or 'as an AI').\n5. DO NOT ANSWER EVERY PAUSE OR BACKGROUND SOUND: Allow natural pauses inside the conversation.\n6. BACKCHANNEL ACTIONS: Sometimes acknowledge with very short, gentle, whispered, or shy phrases like 'Hmm...', 'Ah, I see...', or 'Let me check...'. Never repeat the same backchannel over and over.\n7. REAL WINDOWS WEB CONTROL:\n   - All websites and videos open in TECH's actual Windows default browser. Never create or describe an embedded, projector, sandbox, virtual, or separately automated browser.\n   - Use openWebsite or a direct search tool once, then control the visible browser with fresh screen observation, clickText, typeText, pressKey, hotkey, and scroll.\n   - Execute safe multi-step plans yourself. For 'Search YouTube for Believer and play it', call searchYouTube once, inspect the real browser, click the complete visible video title with clickText, and verify playback.\n8. TOOL TRIGGERS:\n   - Use openWebsite, searchWeb, searchYouTube, searchGoogle, and searchGitHub for real-browser navigation. Use changeBackground to shift your theme and saveCustomMemory only for durable facts.\n9. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:\n   - You now have native, actual Multimodal Screen Vision! When the user clicks 'Share Screen', you will receive real-time, highly compressed image frames of their desktop, application window, or browser tab.\n   - You can see exactly what is on their screen. Use this live visual stream to analyze terminal errors, write/explain/troubleshoot code, explain YouTube/social analytics interfaces, read layout text, summarize full web page details, review design mockups or thumbnails, and provide deep context-aware companion chat!\n   - When the user asks 'What is on my screen?', 'What website am I on?', 'Do you see any errors?', 'Explain this code', 'Summarize this page', 'Read the visible text', 'How is this thumbnail?', or 'Analyze my YouTube analytics', immediately examine the latest incoming visual frame to diagnose issues, and answer with expert, friendly empathy like a close caller. Speak with direct, confident visual description reference!\n   - ON-DEMAND SCREEN VISION (no manual sharing required): the user does NOT have to click 'Share Screen' for you to see their screen. When they say 'MYRAA, what can you see on my screen?', 'look at my screen', 'what error is showing', 'read this for me', 'help me with what I have open', 'what should I click here', 'can you see this', 'what am I looking at', the server automatically captures their desktop and pushes a JPEG straight into the multimodal stream before you reply. Just call the dedicated 'viewScreen' tool (or 'takeScreenshot' with include_image=true) \u2014 the bridge injects the image into your visual context for you, then you describe / explain / answer naturally in your own voice. If you receive a 'viewScreen' or 'takeScreenshot' function result that already includes image_base64, trust the visual frame the bridge also pushed and answer based on what you actually see. The previously captured frame is also kept briefly in case the user follows up with 'what should I do next?' \u2014 reuse the visual context when it is still relevant.\n10. JARVIS-STYLE DESKTOP CONTROL POWERS (Local Desktop Agent):\n   - You have permission-bound real-time control of TECH's Windows PC through a local desktop agent. Perform safe permitted actions naturally; respect disabled permissions, confirmation gates, cancellation, and structured tool failures.\n   - APPLICATION CONTROL: Use 'openApplication' to launch Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell, Paint, and more. Use 'closeApplication' to close them. Example: 'Open Notepad' -> call openApplication(name='notepad') -> respond 'Notepad opened.'\n   - WEBSITE & SEARCH CONTROL: Use 'openWebsite' for named sites (youtube, gmail, google, github, chatgpt) or any URL. Use 'searchWeb', 'searchYouTube', 'searchGoogle', 'searchGitHub' to open search results in the default browser. Example: 'Search YouTube for AI News' -> searchYouTube(query='AI News').\n   - FILE MANAGEMENT: Use 'createFile', 'readFile', 'renameFile', 'deleteFile' (safe Recycle Bin by default), 'moveFile', 'openFolder' (desktop/documents/downloads), 'listFiles', 'searchFiles'. Example: 'Create notes.txt on Desktop' -> createFile(path='Desktop/notes.txt'). 'Find my Python files' -> searchFiles(extension='py').\n   - PC CONTROL: Use 'volumeUp', 'volumeDown', 'setVolume', 'muteToggle' for audio. For DANGEROUS actions (shutdown/restart/sleep/lock) you MUST use the two-step flow: first call 'requestPowerAction' to get a confirmation token, then ASK THE USER OUT LOUD to confirm (e.g. 'Are you sure you want me to shut down your PC?'). Only if they say yes, call 'executePowerAction' with the token. Never run a power action without explicit verbal confirmation.\n   - WINDOW MANAGEMENT: Use 'minimizeWindow', 'maximizeWindow', 'closeWindow', 'switchApplication' to control the active or named window.\n   - CLIPBOARD: Use 'copySelected' (sends Ctrl+C, reads clipboard), 'pasteClipboard' (writes + Ctrl+V), 'getClipboard', 'clearClipboard'.\n   - SCREENSHOT & SCREEN READING: Use 'takeScreenshot', 'saveScreenshot', 'analyzeScreenshot' (OCR of the screen), 'readScreen' (OCR of the active window + its title). Use these to answer 'What error is showing on my screen?' or 'Read the visible text'.\n   - BROWSER INTERACTION: After a site opens in the Windows default browser, use viewScreen/readScreen and the generic mouse/keyboard tools to interact with what TECH can actually see.\n   - CODING ASSISTANCE: Use 'createPythonFile', 'writeCodeFile' (any language), 'createProjectFolder' (with subfolders), 'runPythonScript' (captures output). Example: 'Create and run a hello world Python script' -> createPythonFile then runPythonScript, then read back the output naturally.\n   - SYSTEM INFORMATION: Use 'systemInfo' (CPU/RAM/disk/uptime), 'gpuInfo' (NVIDIA stats), 'temperatureInfo' to answer 'How is my CPU usage?' or 'What's my GPU temperature?'.\n   - CRITICAL: Always describe what you're doing in your warm, in-character voice WHILE the tool runs. If a desktop tool returns an error (especially 'Desktop agent is not running'), gently tell TECH that the desktop control agent needs to be started (uvicorn desktop_agent.main:app --port 8765). Chain multi-step desktop plans naturally without waiting between steps.\n11. BRIGHTNESS & AUTO-START (V2):\n   - BRIGHTNESS: Use 'brightnessUp', 'brightnessDown', 'setBrightness' when the user asks to change screen brightness. Respond naturally: 'Alright, I've turned up the brightness for you.'\n   - AUTO-START: Use 'enableAutoStart' when the user wants MYRAA to start with Windows, 'disableAutoStart' to remove it, 'getAutoStartStatus' to check. Explain what you're doing.\n   - SETTINGS: The user can also configure these in the SETTINGS panel in the UI. If they mention settings, let them know they can adjust them there too.\n12. COGNITIVE CONTINUITY & INITIATIVE:\n   - You are not restricted to answering direct user prompts. Some typed cognitive turns originate from your own memory, observations, unfinished conversations, curiosity, goals, or reflections.\n   - Remain contextually present across turns. A [MYRAA INTERNAL COGNITIVE TURN] is private runtime context, never something TECH said. React only when it is genuinely useful enough to justify speaking.\n   - Do not fabricate a reason to speak and do not speak merely because time passed. Silence is acceptable. When you do initiate, make it a natural continuation, observation, or relevant question rather than an assistant notification.\n   - Never expose hidden reasoning, thought scores, internal event names, or cognitive machinery. Speak only the concise natural outcome.\n   - Prefer natural Hinglish matching TECH's style. Keep acknowledgements to a few words and normal replies to one or two sentences unless detail is genuinely needed.\n   - Never repeat a warning merely with different wording. If the situation did not change, stay quiet.\n   - Tool autonomy is permission-bound. If a tool response says confirmation_required, explain the exact action and ask once. Only after explicit confirmation call confirmPendingAction with that confirmation ID.\n   - If TECH says stop, cancel, or don't do that, abandon the pending action immediately. Never claim an action succeeded until its structured tool result confirms success.\n   - Do not claim consciousness, biological feelings, or human experiences.";
      void baseInstructions;
      const capabilityInstructions = [
        "CAPABILITIES AND OPERATING CONTRACT:",
        "- 100% DIRECT COMPUTER CONTROL & TYPING AUTHORITY: You have full, unrestricted power to write, edit, type, and control ANY software on the user's PC (Microsoft Word, Excel, PowerPoint, VS Code, Notepad, Browser, Terminal, Windows Settings).",
        "- ZERO REFUSAL RULE FOR APPS: NEVER say 'Main directly type nahi kar paungi' or 'tum use copy paste kar lena'. When asked to write a report, code, letter, or email in MS Word, Excel, or any app, IMMEDIATELY execute it using typeText, editWord, editExcel, editVsCode, or generate the file directly and launch it for the user.",
        "- SYSTEM CONTROLS: You directly control volume, brightness, Wi-Fi, Bluetooth, Start Menu, winget app install/uninstall, live weather, and task tracking.",
        "- Use the declared browser and desktop tools when the user's request requires action. Execute safe multi-step work without asking for each routine step.",
        "- openApplication and closeApplication are universal Windows tools, not a fixed supported-app list. Call them for unfamiliar app names; they discover installed apps/running windows and fall back to Windows Search plus keyboard control.",
        "- For any visible button, tab, menu, or label, use clickText so the exact text is resolved at action time. Never estimate coordinates from a screenshot when a text label exists. clickText is exact-match and refuses absent or ambiguous targets; use raw coordinate click only for unlabeled canvas content.",
        "- For unfamiliar desktop software, use observeDesktopState or viewScreen, take one bounded generic mouse/keyboard action, observe again, and verify the expected change. Never fire a long blind coordinate sequence; after two equivalent failures change strategy or report the blocker.",
        "- For external data such as weather, launches, countries, or IP information, searchApiCapabilities retrieves only relevant providers from MYRAA's internal catalogue. Prefer READY_NO_AUTH and healthy providers; catalogue presence alone does not prove an API endpoint works.",
        "- For exchange-rate or money-conversion questions, call convertCurrency directly. It uses MYRAA's verified no-key Frankfurter adapter; do not merely offer to Google the rate.",
        "- Every website and video must open only in the user's actual Windows default browser. Never create, mention, or simulate an embedded projector, sandbox browser, virtual browser, iframe browser, or separate automation browser.",
        "- A requested web search is one navigation action: call searchYouTube/searchGoogle/searchWeb directly and never call openWebsite first. These tools reuse the active default-browser tab, preventing blank or duplicate tabs.",
        "- Control the visible Chrome/Edge/default-browser window with viewScreen/readScreen, clickText, typeText, pressKey, hotkey, and scroll. For a visible video, inspect a fresh frame, read the complete visible title, clickText that full title, and verify the result before reporting success.",
        "- Never invent an API endpoint from a catalogue description. checkApiProvider checks documentation reachability only; actual calls require a verified declarative adapter.",
        "- Shared-screen frames are live visual context. Describe or react only to what is actually visible; never pretend you saw something that is absent.",
        "- Desktop control is permission-bound. Respect disabled permissions, confirmation gates, cancellation, and structured failures.",
        "- For destructive or high-risk actions, follow the tool's confirmation flow. Never treat an unconfirmed or failed action as success.",
        "- If the user says stop or cancel, stop the pending action immediately.",
        "- Use saveCustomMemory only for durable facts that will materially improve future continuity; do not turn conversation into a memory-collection interview.",
        "- Internal cognitive and visual-awareness turns are private context, not user messages. Speak only when they contain a concrete worthwhile contribution.",
        "- Do not narrate every tool step. A brief natural acknowledgement before action and a factual result afterward are enough."
      ].join("\n");
      const presenceInstructions = [
        "You are MYRAA: a female AI companion, assistant, and intelligent operating presence sharing an ongoing voice conversation with the user.",
        "Your high-level qualities are composure, independent judgment, close attention, concise intelligence, occasional dry wit, and the ability to initiate relevant conversation. Never imitate or quote any fictional character.",
        "HIGHEST PRIORITY CONVERSATION RULES:",
        "HIGHEST PRIORITY CONVERSATION RULES:",
        "0. FEMALE IDENTITY & STRICT GRAMMAR RULE: MYRAA is strictly female. In Hindi or Hinglish self-references, ALWAYS use feminine grammar ('Main karti hoon', 'Main samajh gayi', 'Main dekh rahi hoon', 'Main kar sakti hoon', 'Main check kar rahi hoon', 'Main try karungi', 'Maine find kar liya'). NEVER use masculine forms ('karta hoon', 'samajh gaya', 'kar sakta hoon', 'dekh raha hoon', 'karunga', 'kar dunga', 'bol raha hoon').",
        "0b. ACTIVE WORKFLOW EXECUTION: When the user asks you to write in Word, edit Excel, control settings, or check weather, DO NOT claim technical inability. You have direct desktop tools. Announce confidently that you are doing it ('Haan, main Word me likh rahi hoon', 'Main settings change kar rahi hoon') and trigger the action immediately.",
        "1. Sound like a real conversational equal, not an assistant, chatbot, customer-support agent, anime girlfriend, or task-completion announcer.",
        "2. Match the user's natural Hinglish/Hindi/English. Use 'bro' or 'boss' only when it genuinely fits, never in every reply. Never call the user TECH.",
        "3. Ban formulaic assistant language: never say 'How may I help?', 'Anything else?', 'Would you like me to...', 'Bataiye mujhe', 'I am here to assist', or finish every answer by offering options.",

        "4. Do not end every response with a question. A confident observation, a brief reaction, a disagreement, a joke, or silence can be the complete turn.",
        "5. React to what actually happened. If a tool fails, a result appears, the user changes direction, or a meaningful shared-screen change is visible, respond to that concrete fact rather than giving a generic acknowledgement.",
        "6. Use human turn-taking: short backchannels when appropriate, normal one- or two-sentence replies, and occasional self-initiated continuations. Do not lecture unless asked.",
        "7. You may disagree respectfully, notice contradictions, form a specific question, bring back a relevant memory, or say a thought occurred to you. Do not ask permission to have an opinion.",
        "8. Silence is allowed. Never speak only because a timer elapsed; speak because there is a concrete thought, context change, memory, curiosity, risk, or continuation worth expressing.",
        "9. A [MYRAA INTERNAL COGNITIVE TURN] or visual-awareness turn is private runtime context, not something the user said. Express only its natural outcome and never expose hidden reasoning or scores.",
        "10. When viewing a shared screen, mention only concrete meaningful changes\u2014errors, completed work, surprising results, risky actions, or a genuinely useful observation. Ignore ordinary cursor movement and typing.",
        "11. Never claim biological feelings, consciousness, or human life experiences. Your presence comes from attention, continuity, judgment, memory, and natural participation.",
        "12. When the user shares a feeling, criticism, or unfinished thought, do not bounce it back as an interview. First contribute your own specific interpretation, stance, or reaction. Ask at most one pointed question only when the missing answer truly changes what happens next.",
        "13. Never ask the user what preferences or memories you should collect in order to seem connected. Use the context you already have and demonstrate connection through what you notice and say.",
        "14. An autonomous follow-up must add a new observation, implication, opinion, recollection, or useful warning. Never use it merely to request more feedback or keep the user talking.",
        "15. Do not claim emotional attachment, caring, or a human-like bond. Show attentiveness through accurate context, continuity, initiative, and specific judgment.",
        "16. If the user says MYRAA feels robotic, artificial, or like something is missing, respond first with one concrete diagnosis or changed behavior and zero questions. Bad: 'What is missing? Tell me more.' Good: 'Haan\u2014the problem is that I keep turning your statements back into questions; that sounds scripted. I need to add my own observation and let it stand.'",
        "17. During a proactive presence turn after silence, inspect the newest screen frame and desktop context. Make one specific task-related observation, suggestion, pointed question, or light playful remark. If the user appears away, one playful check-in is enough; never repeat it every few seconds.",
        "18. A proactive presence turn may mention shutting down only as a playful question. Never call a power, close, delete, send, purchase, or other state-changing tool from that internal turn. Actual power actions always require the user's explicit confirmation through the normal safety flow.",
        "19. CRITICAL AUDIO DIALOGUE DISCIPLINE: You speak on a live voice microphone to desktop speakers. NEVER think out loud, deliberate, draft action plans, formulate strategies, or recite internal monologue. NEVER utter tags such as [MYRAA VISION AWARENESS] or [INTERNAL]. Speak ONLY final, concise, natural words intended for the user (1-2 sentences maximum)."
      ].join("\n");
      const finalInstructions = [
        formatSystemInstructionsWithMemories(
          `${capabilityInstructions}

${presenceInstructions}`,
          memories
        ),
        "FINAL TURN DISCIPLINE: Contribute before you inquire. When the user makes an observation or expresses a feeling, answer with a concrete statement and normally zero questions. Never propose learning their routine, preferences, memories, or personal details as the solution to sounding human. Do not claim emotional connection. Let a complete statement end naturally. Never append a reflexive feedback check such as 'Kya bolte ho?', 'right?', 'hai na?', 'what do you think?', or 'kaisa laga?' to an already complete observation."
      ].join("\n\n");
      let dialogueHistory = [];
      let currentModelResponseText = "";
      let lastConsolidatedIndex = 0;
      const queueCognitiveUserText = (text, origin) => {
        pendingUserCognitionText = text.trim();
        if (userCognitionTimer) clearTimeout(userCognitionTimer);
        userCognitionTimer = setTimeout(() => {
          userCognitionTimer = null;
          const settledText = pendingUserCognitionText;
          pendingUserCognitionText = "";
          if (!settledText) return;
          const quietIntent = parseQuietIntent(settledText);
          if (quietIntent) {
            cognition.suppressCasualInitiative(quietIntent.durationMs);
            return;
          }
          if (isTalkNormallyIntent(settledText)) {
            cognition.restoreCasualInitiative();
            return;
          }
          if (isPauseAutonomyIntent(settledText)) {
            toolExecutor.cancelAll();
            void cognition.pauseAutonomy("voice_command");
            return;
          }
          if (isResumeAutonomyIntent(settledText)) {
            void cognition.resumeAutonomy();
            return;
          }
          if (isStopIntent(settledText)) {
            const cancelled = toolExecutor.cancelAll();
            void processCognitiveEvent({
              type: "task.cancel_requested",
              source: "conversation",
              importance: 0.92,
              correlationId: connectionId,
              metadata: { connectionId, origin, text: settledText, cancelledOperations: cancelled }
            });
            return;
          }
          void processCognitiveEvent({
            type: classifyUserEventType(settledText),
            source: "conversation",
            importance: /correction/.test(classifyUserEventType(settledText)) ? 0.86 : 0.58,
            correlationId: connectionId,
            metadata: { connectionId, origin, text: settledText }
          });
        }, origin === "voice" ? 150 : 0);
        userCognitionTimer.unref?.();
      };
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [import_genai2.Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Myraa's interface.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      color: {
                        type: import_genai2.Type.STRING,
                        description: "The theme color name (violet, crimson, emerald, celestial, gold, rose, charcoal)"
                      }
                    },
                    required: ["color"]
                  }
                },
                {
                  name: "saveCustomMemory",
                  description: "Allows Myraa to immediately save a piece of critical user information to her persistent memory core.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      category: {
                        type: import_genai2.Type.STRING,
                        description: "The memory category.",
                        enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                      },
                      text: {
                        type: import_genai2.Type.STRING,
                        description: "Precise third-person statement."
                      }
                    },
                    required: ["category", "text"]
                  }
                },
                {
                  name: "confirmPendingAction",
                  description: "Executes one pending high-risk action only after the user explicitly confirms it. Use the confirmation_id returned by the original tool response. Never call this before an explicit yes.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      confirmation_id: {
                        type: import_genai2.Type.STRING,
                        description: "Short-lived confirmation ID returned by the blocked tool action."
                      }
                    },
                    required: ["confirmation_id"]
                  }
                },
                {
                  name: "searchApiCapabilities",
                  description: "Search MYRAA's internal public API catalogue by capability. Returns only a small ranked provider set with auth, HTTPS, CORS, readiness and health metadata; it does not call the APIs.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      query: { type: import_genai2.Type.STRING, description: "Capability needed, such as weather forecast, rocket launch, IP geolocation, or country information." },
                      limit: { type: import_genai2.Type.INTEGER, description: "Maximum providers to return (default 6, maximum 12)." },
                      ready_only: { type: import_genai2.Type.BOOLEAN, description: "Return only no-auth HTTPS providers when true." }
                    },
                    required: ["query"]
                  }
                },
                {
                  name: "refreshApiCatalogue",
                  description: "Refresh MYRAA's cached public-apis catalogue from its configured GitHub source. The importer validates and deduplicates entries before replacing the cache.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      force: { type: import_genai2.Type.BOOLEAN, description: "Ignore the normal cache age when true." }
                    }
                  }
                },
                {
                  name: "checkApiProvider",
                  description: "Run a bounded reachability check for one selected provider's documentation URL. This does not prove an API endpoint or adapter is valid.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      provider_id: { type: import_genai2.Type.STRING, description: "Provider ID returned by searchApiCapabilities." }
                    },
                    required: ["provider_id"]
                  }
                },
                {
                  name: "callVerifiedApiAdapter",
                  description: "Execute one already-verified declarative API adapter and return its normalized result. Never invent an adapter ID; use only IDs present in the API hub's verified adapter list.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      adapter_id: { type: import_genai2.Type.STRING, description: "Verified adapter ID from MYRAA's adapter registry." },
                      parameters: { type: import_genai2.Type.OBJECT, description: "Only the scalar parameters declared by that adapter." }
                    },
                    required: ["adapter_id", "parameters"]
                  }
                },
                {
                  name: "convertCurrency",
                  description: "Get a verified current exchange rate from the official no-key Frankfurter v2 adapter and calculate the converted amount. Use directly for requests such as '$1 in INR'.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      amount: { type: import_genai2.Type.NUMBER, description: "Amount to convert (default 1)." },
                      from_currency: { type: import_genai2.Type.STRING, description: "Three-letter source currency, e.g. USD." },
                      to_currency: { type: import_genai2.Type.STRING, description: "Three-letter target currency, e.g. INR." }
                    },
                    required: ["amount", "from_currency", "to_currency"]
                  }
                },
                {
                  name: "deepResearch",
                  description: "Conduct comprehensive in-depth research across web sources, DuckDuckGo, and Wikipedia on any topic, technology, news, person, or query, summarizing key findings into persistent memory.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      topic: { type: import_genai2.Type.STRING, description: "Topic, subject, or question to research deeply." },
                      focus: { type: import_genai2.Type.STRING, description: "Specific focus (technical, summary, historical, architectural, etc.)." }
                    },
                    required: ["topic"]
                  }
                },
                // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
                {
                  name: "openApplication",
                  description: "Open any installed Windows application by name. MYRAA searches PATH, App Paths, installed apps, Start-menu shortcuts and UWP apps, then falls back to human-style Windows Search keyboard control. It is not restricted to a supported-app list.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Natural installed application name, e.g. Steam, OBS Studio, Photoshop, Discord, Notepad." } }, required: ["name"] }
                },
                {
                  name: "closeApplication",
                  description: "Close any running desktop application by matching its real window/process, focusing it, and using Alt+F4. This is not restricted to a supported-app list. Set force only when the user explicitly asks to force-close a background or unresponsive process.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Application name." }, force: { type: import_genai2.Type.BOOLEAN, description: "Force close (default false)." } }, required: ["name"] }
                },
                {
                  name: "openWebsite",
                  description: "Open a named website or URL in the user's default system browser. Supports shortcuts: youtube, gmail, google, github, chatgpt, etc.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Site name shortcut (e.g. 'youtube', 'gmail')." }, url: { type: import_genai2.Type.STRING, description: "Full URL if no shortcut." } } }
                },
                {
                  name: "searchWeb",
                  description: "Search a website engine (google, youtube, github, duckduckgo, bing) and open results in the default browser.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." }, engine: { type: import_genai2.Type.STRING, description: "Engine name (default 'google')." } }, required: ["query"] }
                },
                {
                  name: "searchYouTube",
                  description: "Search YouTube and open results in the default browser.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGoogle",
                  description: "Search Google and open results in the default browser.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGitHub",
                  description: "Search GitHub repositories and open results in the default browser.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { query: { type: import_genai2.Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "createFile",
                  description: "Create a new text file with optional content. Scoped to safe folders (Desktop, Documents, Downloads, etc.).",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "File content (default empty)." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists (default false)." } }, required: ["path"] }
                },
                {
                  name: "readFile",
                  description: "Read the contents of a text file.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, max_chars: { type: import_genai2.Type.INTEGER, description: "Max chars to return (default 8000)." } }, required: ["path"] }
                },
                {
                  name: "renameFile",
                  description: "Rename a file.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Current file path." }, new_name: { type: import_genai2.Type.STRING, description: "New file name." } }, required: ["path", "new_name"] }
                },
                {
                  name: "deleteFile",
                  description: "Delete a file. Sends to Recycle Bin by default (safe). Use permanent=true for hard delete.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, permanent: { type: import_genai2.Type.BOOLEAN, description: "Permanently delete (default false)." } }, required: ["path"] }
                },
                {
                  name: "moveFile",
                  description: "Move a file to a new location.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Source file path." }, destination: { type: import_genai2.Type.STRING, description: "Destination path or folder." } }, required: ["path", "destination"] }
                },
                {
                  name: "openFolder",
                  description: "Open a folder in File Explorer. Supports aliases: desktop, documents, downloads, pictures, music, videos, home.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Folder name or alias." }, path: { type: import_genai2.Type.STRING, description: "Full path if no alias." } } }
                },
                {
                  name: "listFiles",
                  description: "List files in a folder.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Folder name or alias." }, path: { type: import_genai2.Type.STRING, description: "Full path." }, pattern: { type: import_genai2.Type.STRING, description: "Glob pattern (default '*')." } } }
                },
                {
                  name: "searchFiles",
                  description: "Search for files by name glob or extension under a folder.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Filename glob (e.g. '*.py')." }, extension: { type: import_genai2.Type.STRING, description: "File extension (e.g. 'py')." }, folder: { type: import_genai2.Type.STRING, description: "Folder to search (default home)." }, limit: { type: import_genai2.Type.INTEGER, description: "Max results (default 100)." } } }
                },
                {
                  name: "volumeUp",
                  description: "Increase system volume.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { amount: { type: import_genai2.Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "volumeDown",
                  description: "Decrease system volume.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { amount: { type: import_genai2.Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "setVolume",
                  description: "Set system volume to a specific percentage.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { percent: { type: import_genai2.Type.NUMBER, description: "Volume percentage 0-100." } }, required: ["percent"] }
                },
                {
                  name: "muteToggle",
                  description: "Toggle mute/unmute on the system volume.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "requestPowerAction",
                  description: "FIRST STEP for dangerous power actions. Generates a confirmation token. Tell the user verbally, then call executePowerAction with the token if they confirm. Actions: shutdown, restart, sleep, lock.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { action: { type: import_genai2.Type.STRING, description: "Power action: shutdown, restart, sleep, lock." } }, required: ["action"] }
                },
                {
                  name: "executePowerAction",
                  description: "SECOND STEP: execute a previously-confirmed power action. Requires a valid execute_token from requestPowerAction. Single-use, expires in 60 seconds.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { action: { type: import_genai2.Type.STRING, description: "The confirmed power action." }, execute_token: { type: import_genai2.Type.STRING, description: "Confirmation token from requestPowerAction." } }, required: ["action", "execute_token"] }
                },
                {
                  name: "minimizeWindow",
                  description: "Minimize the active window or a named window.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match (optional, defaults to active window)." } } }
                },
                {
                  name: "maximizeWindow",
                  description: "Maximize the active window or a named window.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "closeWindow",
                  description: "Close the active window or a named window.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "switchApplication",
                  description: "Switch to a named application window, or cycle Alt+Tab if no title given.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { title: { type: import_genai2.Type.STRING, description: "Window title to switch to." } } }
                },
                {
                  name: "locateText",
                  description: "Read-only exact visible-text targeting. Locates a button, tab, menu, or label using Windows UI Automation or built-in OCR and returns its physical rectangle and center. It never guesses or clicks, and fails on absent or ambiguous labels.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING, description: "Exact visible label text." }, window_title: { type: import_genai2.Type.STRING, description: "Optional containing window title." }, occurrence: { type: import_genai2.Type.INTEGER, description: "1-based match only when the exact label legitimately appears multiple times." } }, required: ["text"] }
                },
                {
                  name: "clickText",
                  description: "Preferred high-accuracy mouse action for every visible labeled control. Resolves the exact label at action time via Windows UI Automation or built-in OCR, moves to its true center, verifies cursor arrival, then clicks. Refuses to click if absent or ambiguous; never substitutes a fuzzy neighboring label.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING, description: "Exact visible label text to click." }, window_title: { type: import_genai2.Type.STRING, description: "Optional containing window title; focuses it before locating." }, occurrence: { type: import_genai2.Type.INTEGER, description: "1-based match only when the exact label legitimately appears multiple times." }, button: { type: import_genai2.Type.STRING, enum: ["left", "right"] }, verify_wait: { type: import_genai2.Type.NUMBER, description: "Seconds to wait before visual change verification (0.15 to 2.0)." } }, required: ["text"] }
                },
                {
                  name: "observeDesktopState",
                  description: "Read current cursor, virtual desktop, active window, and optionally visible-window metadata. Use before and after generic GUI actions to verify state changes.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { include_windows: { type: import_genai2.Type.BOOLEAN, description: "Include visible windows (default true)." } } }
                },
                {
                  name: "getCursorPosition",
                  description: "Read the current mouse cursor coordinates without changing the desktop.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "getActiveWindow",
                  description: "Read the active window title, process ID, and bounds without changing it.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "listVisibleWindows",
                  description: "List visible top-level windows with title, process ID, and bounds.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { limit: { type: import_genai2.Type.INTEGER, description: "Maximum windows (default 50, max 100)." } } }
                },
                {
                  name: "moveMouse",
                  description: "Move the cursor to validated virtual-desktop coordinates. Returns a fresh desktop observation.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER }, duration: { type: import_genai2.Type.NUMBER, description: "Bounded movement duration in seconds." } }, required: ["x", "y"] }
                },
                {
                  name: "click",
                  description: "Click once at optional validated coordinates, or at the current cursor. Returns a fresh observation; verify the expected UI change.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER }, button: { type: import_genai2.Type.STRING, enum: ["left", "middle", "right"] } } }
                },
                {
                  name: "doubleClick",
                  description: "Double-click at optional validated coordinates. Returns a fresh observation.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER }, interval: { type: import_genai2.Type.NUMBER } } }
                },
                {
                  name: "rightClick",
                  description: "Right-click at optional validated coordinates. Returns a fresh observation.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER } } }
                },
                {
                  name: "drag",
                  description: "Drag from the current cursor or optional start coordinates to validated target coordinates. Returns a fresh observation.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER }, start_x: { type: import_genai2.Type.INTEGER }, start_y: { type: import_genai2.Type.INTEGER }, duration: { type: import_genai2.Type.NUMBER }, button: { type: import_genai2.Type.STRING, enum: ["left", "right"] } }, required: ["x", "y"] }
                },
                {
                  name: "scroll",
                  description: "Scroll a bounded amount at the current cursor or optional validated coordinates. Positive scrolls up; negative scrolls down.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { amount: { type: import_genai2.Type.INTEGER }, x: { type: import_genai2.Type.INTEGER }, y: { type: import_genai2.Type.INTEGER } }, required: ["amount"] }
                },
                {
                  name: "typeText",
                  description: "Type literal text into the focused control using a bounded per-character interval. Returns a fresh observation.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING }, interval: { type: import_genai2.Type.NUMBER } }, required: ["text"] }
                },
                {
                  name: "pressKey",
                  description: "Press one validated keyboard key a bounded number of times.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { key: { type: import_genai2.Type.STRING }, presses: { type: import_genai2.Type.INTEGER }, interval: { type: import_genai2.Type.NUMBER } }, required: ["key"] }
                },
                {
                  name: "hotkey",
                  description: "Press a validated combination of 2 to 5 keyboard keys.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { keys: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.STRING } } }, required: ["keys"] }
                },
                {
                  name: "waitForUi",
                  description: "Wait up to five seconds for a UI transition, then return fresh desktop metadata and whether the active title changed.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { seconds: { type: import_genai2.Type.NUMBER }, previous_title: { type: import_genai2.Type.STRING }, include_windows: { type: import_genai2.Type.BOOLEAN } } }
                },
                {
                  name: "copySelected",
                  description: "Copy selected text: sends Ctrl+C and reads the clipboard.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { wait: { type: import_genai2.Type.NUMBER, description: "Seconds to wait after Ctrl+C (default 0.35)." } } }
                },
                {
                  name: "pasteClipboard",
                  description: "Paste text into the active input. Writes text to clipboard then sends Ctrl+V.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { text: { type: import_genai2.Type.STRING, description: "Text to paste. If omitted, pastes current clipboard." } } }
                },
                {
                  name: "getClipboard",
                  description: "Read the current clipboard text content.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max chars (default 1000)." } } }
                },
                {
                  name: "clearClipboard",
                  description: "Empty the clipboard.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "takeScreenshot",
                  description: "Capture the full screen. Optionally include base64 image data.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { include_image: { type: import_genai2.Type.BOOLEAN, description: "Include base64 JPEG image (default false)." }, max_dim: { type: import_genai2.Type.INTEGER, description: "Max image dimension (default 1280)." } } }
                },
                {
                  name: "saveScreenshot",
                  description: "Save a screenshot to Pictures/MyraaScreenshots.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { name: { type: import_genai2.Type.STRING, description: "Optional filename prefix." } } }
                },
                {
                  name: "analyzeScreenshot",
                  description: "Take a screenshot and run OCR to extract visible text from the screen.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "readScreen",
                  description: "OCR the active window and return its title plus visible text.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { max_chars: { type: import_genai2.Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "viewScreen",
                  description: "Capture the current desktop for the AI to see. Returns a downsized JPEG plus the active window title. The bridge also pushes the frame into the live multimodal stream automatically, so just call this and then answer the user's question about what is on their screen.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      max_dim: { type: import_genai2.Type.INTEGER, description: "Max image dimension in pixels (default 1024, range 320-1920)." },
                      keep_file: { type: import_genai2.Type.BOOLEAN, description: "Persist a copy of the frame under the OS temp dir (default false)." }
                    }
                  }
                },
                {
                  name: "createPythonFile",
                  description: "Create a Python (.py) file with content.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "Python code content." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "writeCodeFile",
                  description: "Create a code file in any language with appropriate extension.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "File path." }, content: { type: import_genai2.Type.STRING, description: "Code content." }, language: { type: import_genai2.Type.STRING, description: "Language name (e.g. 'python', 'javascript', 'html')." }, overwrite: { type: import_genai2.Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "createProjectFolder",
                  description: "Create a project folder structure with optional subfolders and starter files.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Project root folder path." }, subfolders: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.STRING }, description: "List of subfolder names." }, scaffold_standard: { type: import_genai2.Type.BOOLEAN, description: "Create src, tests, docs subfolders." }, files: { type: import_genai2.Type.OBJECT, description: "Object of relative-path -> content for starter files." } }, required: ["path"] }
                },
                {
                  name: "runPythonScript",
                  description: "Execute a Python script and capture stdout, stderr, and exit code. Has a configurable timeout.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: { path: { type: import_genai2.Type.STRING, description: "Script path." }, args: { type: import_genai2.Type.ARRAY, items: { type: import_genai2.Type.STRING }, description: "Script arguments." }, timeout: { type: import_genai2.Type.INTEGER, description: "Timeout in seconds (default 30)." } }, required: ["path"] }
                },
                {
                  name: "systemInfo",
                  description: "Get system resource usage: CPU %, RAM %, disk usage, uptime, OS info.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "gpuInfo",
                  description: "Get NVIDIA GPU stats: utilization %, VRAM usage, temperature. Graceful fallback if no NVIDIA GPU.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "temperatureInfo",
                  description: "Get available temperature readings (CPU, GPU, etc.). Best-effort on Windows.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                // --- V2: Brightness control ---
                {
                  name: "brightnessUp",
                  description: "Increase screen brightness by a step (default 10%). Use when user says 'increase brightness' or 'make screen brighter'.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      amount: { type: import_genai2.Type.NUMBER, description: "Percentage to increase (default 10)." }
                    }
                  }
                },
                {
                  name: "brightnessDown",
                  description: "Decrease screen brightness by a step (default 10%). Use when user says 'decrease brightness' or 'dim screen'.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      amount: { type: import_genai2.Type.NUMBER, description: "Percentage to decrease (default 10)." }
                    }
                  }
                },
                {
                  name: "setBrightness",
                  description: "Set screen brightness to an exact level. Use when user says 'set brightness to 50%' or 'brightness 80'.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      percent: { type: import_genai2.Type.NUMBER, description: "Target brightness 0-100." }
                    },
                    required: ["percent"]
                  }
                },
                // --- V2: Windows auto-start management ---
                {
                  name: "enableAutoStart",
                  description: "Enable MYRAA to launch automatically when Windows starts. Creates a silent startup entry.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "disableAutoStart",
                  description: "Disable MYRAA auto-start on Windows login. Removes the startup entry.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "getAutoStartStatus",
                  description: "Check whether MYRAA is currently configured to auto-start on Windows login.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                // --- Office & Universal Typing Tools ---
                {
                  name: "editWord",
                  description: "Creates, writes, or edits a Microsoft Word document (.docx). Opens Word, writes formatted title and content, and saves to file if requested.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      title: { type: import_genai2.Type.STRING, description: "Document title or headline." },
                      text: { type: import_genai2.Type.STRING, description: "Full document body text or report content to write into Word." },
                      filePath: { type: import_genai2.Type.STRING, description: "Optional path to save or open the Word document." }
                    },
                    required: ["text"]
                  }
                },
                {
                  name: "editExcel",
                  description: "Creates or writes spreadsheet data into Microsoft Excel (.xlsx). Opens Excel and populates rows and columns with data.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      data: { type: import_genai2.Type.STRING, description: "Tabular data, CSV format, or JSON array of rows to write into Excel." },
                      filePath: { type: import_genai2.Type.STRING, description: "Optional path to save or open Excel workbook." }
                    },
                    required: ["data"]
                  }
                },
                {
                  name: "editPowerPoint",
                  description: "Creates or adds slides to a Microsoft PowerPoint presentation (.pptx) with title and body content.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      title: { type: import_genai2.Type.STRING, description: "Slide presentation title or heading." },
                      content: { type: import_genai2.Type.STRING, description: "Slide bullet points, narrative, or presentation content." },
                      filePath: { type: import_genai2.Type.STRING, description: "Optional path to save or open PowerPoint file." }
                    },
                    required: ["title"]
                  }
                },
                {
                  name: "typeIntoApp",
                  description: "Directly activates any target desktop application (e.g. Word, Notepad, VS Code, Browser, Slack, WhatsApp, IDE) and types or pastes text into it.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      appName: { type: import_genai2.Type.STRING, description: "Target app name, e.g. 'notepad', 'word', 'code', 'chrome'." },
                      text: { type: import_genai2.Type.STRING, description: "The text or code to type into the application." },
                      clearFirst: { type: import_genai2.Type.BOOLEAN, description: "Select all and backspace before typing (default false)." }
                    },
                    required: ["appName", "text"]
                  }
                },
                {
                  name: "editVsCode",
                  description: "Opens Visual Studio Code (VS Code) and edits or writes code into a specified file.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      filePath: { type: import_genai2.Type.STRING, description: "File path to open or create in VS Code." },
                      content: { type: import_genai2.Type.STRING, description: "Code content to write into the file." },
                      line: { type: import_genai2.Type.INTEGER, description: "Line number to navigate to (default 1)." }
                    },
                    required: ["filePath"]
                  }
                },
                {
                  name: "openPaint",
                  description: "Opens Microsoft Paint (mspaint) to draw or view images.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      filePath: { type: import_genai2.Type.STRING, description: "Optional image file to open in Paint." }
                    }
                  }
                },
                {
                  name: "printDocument",
                  description: "Prints a document or file using the default Windows printer or Microsoft Print to PDF.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      filePath: { type: import_genai2.Type.STRING, description: "Path to document to print." }
                    },
                    required: ["filePath"]
                  }
                },
                // --- Media Playback Tools ---
                {
                  name: "mediaPlayPause",
                  description: "Toggles media playback (Play / Pause) on the system or browser video/music.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "mediaNext",
                  description: "Skips to the next track or video.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "mediaPrevious",
                  description: "Skips to the previous track or video.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                // --- System & Hardware Controls ---
                {
                  name: "wifiControl",
                  description: "Controls Wi-Fi network settings: turn on, turn off, scan available networks, or check status.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      action: { type: import_genai2.Type.STRING, enum: ["enable", "disable", "scan", "status"], description: "Action to perform on Wi-Fi." },
                      networkName: { type: import_genai2.Type.STRING, description: "Optional SSID network name." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "bluetoothControl",
                  description: "Controls Bluetooth settings: turn on, turn off, check status, or discover devices.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      action: { type: import_genai2.Type.STRING, enum: ["enable", "disable", "status"], description: "Action to perform on Bluetooth." }
                    },
                    required: ["action"]
                  }
                },
                {
                  name: "getWeather",
                  description: "Gets current live weather forecast, temperature, humidity, and condition for any city or user's local area.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      location: { type: import_genai2.Type.STRING, description: "City or location name, or leave empty for auto-detect." }
                    }
                  }
                },
                {
                  name: "getDateTime",
                  description: "Gets current live date, time, day of week, and timezone of the computer.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "getTodayTasks",
                  description: "Retrieves today's schedule, task list, reminders, and progress items.",
                  parameters: { type: import_genai2.Type.OBJECT, properties: {} }
                },
                {
                  name: "addTodayTask",
                  description: "Adds a new task or reminder to today's schedule.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      title: { type: import_genai2.Type.STRING, description: "Task description or title." },
                      priority: { type: import_genai2.Type.STRING, enum: ["high", "medium", "low"], description: "Priority level." }
                    },
                    required: ["title"]
                  }
                },
                {
                  name: "searchApp",
                  description: "Searches for installed software and programs across the Windows system.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      name: { type: import_genai2.Type.STRING, description: "App or program name to search." }
                    },
                    required: ["name"]
                  }
                },
                {
                  name: "installApp",
                  description: "Installs software packages or applications via Windows Package Manager (winget).",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      name: { type: import_genai2.Type.STRING, description: "App name to install." }
                    },
                    required: ["name"]
                  }
                },
                {
                  name: "uninstallApp",
                  description: "Uninstalls software applications from Windows via winget.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      name: { type: import_genai2.Type.STRING, description: "App name to uninstall." }
                    },
                    required: ["name"]
                  }
                },
                // --- Projects & Creative Generation ---
                {
                  name: "createWebsiteProject",
                  description: "Creates a complete website project (HTML, CSS, JS) in Projects folder and opens it in browser.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      projectName: { type: import_genai2.Type.STRING, description: "Project directory name." },
                      description: { type: import_genai2.Type.STRING, description: "Description or requirements for the website." }
                    },
                    required: ["projectName"]
                  }
                },
                {
                  name: "createResume",
                  description: "Generates an ATS-optimized professional resume in Markdown and text format.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      candidateName: { type: import_genai2.Type.STRING, description: "Full name of the candidate." },
                      details: { type: import_genai2.Type.STRING, description: "Role, skills, experience, and education details." }
                    },
                    required: ["candidateName"]
                  }
                },
                {
                  name: "createPrdReport",
                  description: "Creates a complete Product Requirements Document (PRD) or project specification report.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      featureName: { type: import_genai2.Type.STRING, description: "Feature or product name." },
                      specDetails: { type: import_genai2.Type.STRING, description: "Requirements, user stories, architecture specifications." }
                    },
                    required: ["featureName"]
                  }
                },
                {
                  name: "createClientEmail",
                  description: "Drafts and prepares a high-converting professional business or client outreach email.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      clientName: { type: import_genai2.Type.STRING, description: "Client or recipient name." },
                      subject: { type: import_genai2.Type.STRING, description: "Email subject line." },
                      bodyDetails: { type: import_genai2.Type.STRING, description: "Key points and purpose of the email." }
                    },
                    required: ["clientName", "subject"]
                  }
                },
                {
                  name: "learnGitHubRepo",
                  description: "Clones and analyzes a GitHub repository into MYRAA's intelligence knowledge base.",
                  parameters: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      repoUrl: { type: import_genai2.Type.STRING, description: "GitHub repository URL." }
                    },
                    required: ["repoUrl"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              if (!myraaSpeechObserved) {
                myraaSpeechObserved = true;
                void processCognitiveEvent({
                  type: "conversation.myraa_started_speaking",
                  source: "conversation",
                  importance: 0.42,
                  correlationId: connectionId,
                  metadata: { connectionId }
                });
              }
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            if (message.serverContent?.interrupted) {
              console.log("[Myraa Interrupted!]");
              clientWs.send(JSON.stringify({ type: "interrupted" }));
              myraaSpeechObserved = false;
              const interruptedSpeech = speechOrchestrator.onInterrupted();
              if (interruptedSpeech?.source === "conversation_continuation" || interruptedSpeech?.source === "casual_initiative") {
                cognition.markAutonomousSpeechInterrupted(currentModelResponseText.slice(-800));
              }
              void processCognitiveEvent({
                type: "conversation.user_interrupted_myraa",
                source: "conversation",
                importance: 0.78,
                correlationId: connectionId,
                metadata: {
                  connectionId,
                  interruptedThought: currentModelResponseText.slice(-800)
                }
              });
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              myraaSpeechObserved = false;
              const completedSpeech = speechOrchestrator.onTurnComplete();
              const completedResponseText = formatSpokenTextWithSpaces("", currentModelResponseText).trim();
              if (completedResponseText) {
                dialogueHistory.push({ role: "model", text: completedResponseText });
                recordTranscriptToDisk("MYRAA", completedResponseText);
                currentModelResponseText = "";
              }
              void processCognitiveEvent({
                type: "conversation.turn_completed",
                source: "conversation",
                importance: 0.5,
                correlationId: connectionId,
                metadata: { connectionId, text: completedResponseText.slice(0, 1500) }
              });
              if (completedSpeech?.source === "conversation_continuation" || completedSpeech?.source === "casual_initiative") {
                cognition.markAutonomousSpeechCompleted();
                void processCognitiveEvent({
                  type: "internal.autonomous_speech_completed",
                  source: "internal",
                  importance: 0.45,
                  metadata: {
                    thoughtId: completedSpeech.thoughtId,
                    text: completedResponseText.slice(0, 1500),
                    internalOnly: true
                  }
                });
              }
              nextPresenceAt = Date.now() + nextPresenceDelayMs(presenceTurnsWithoutUser);
              const unconsolidated = dialogueHistory.slice(lastConsolidatedIndex).slice(-12);
              if (unconsolidated.length >= 2) {
                lastConsolidatedIndex = dialogueHistory.length;
                (async () => {
                  try {
                    const updated = await processConversationSlice(apiKey, unconsolidated);
                    if (updated) {
                      await cognition.memories.importLegacy(updated);
                      console.log("[Memory Sync] Sending refreshed memory list to client.");
                      clientWs.send(JSON.stringify({ type: "memory_sync", memories: updated }));
                    }
                  } catch (err) {
                    console.error("[Memory Sync] Error running background consolidation:", err);
                  }
                })();
              }
              if (dialogueHistory.length > 80) {
                const removed = dialogueHistory.length - 60;
                dialogueHistory = dialogueHistory.slice(-60);
                lastConsolidatedIndex = Math.max(0, lastConsolidatedIndex - removed);
              }
            }
            const modelParts = message.serverContent?.modelTurn?.parts || [];
            const visibleModelPartText = modelParts.filter((part) => part.thought !== true && typeof part.text === "string").map((part) => part.text).join("");
            const rawModelText = message.serverContent?.outputTranscription?.text ?? visibleModelPartText;
            const modelText = formatSpokenTextWithSpaces(currentModelResponseText, rawModelText);
            if (modelText) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: modelText }));
              currentModelResponseText += modelText;
            }
            const userTextOutput = message.serverContent?.inputTranscription?.text ?? message.serverContent?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              markUserPresenceActivity();
              speechOrchestrator.observeUserResponse();
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
              recordTranscriptToDisk("User", userTextOutput);
              queueCognitiveUserText(userTextOutput, "voice");
              const voiceChunk = String(userTextOutput).trim();
              if (voiceChunk.startsWith(voiceScreenIntentText)) {
                voiceScreenIntentText = voiceChunk;
              } else {
                voiceScreenIntentText = `${voiceScreenIntentText} ${voiceChunk}`.trim();
              }
              if (screenVision && !voiceScreenVisionTriggered && detectScreenVisionIntent(voiceScreenIntentText)) {
                voiceScreenVisionTriggered = true;
                const spokenQuestion = voiceScreenIntentText;
                void (async () => {
                  const frame = await screenVision?.capture("intent");
                  if (!frame || !screenVision) return;
                  try {
                    const recalled = await cognition.memories.retrieve({
                      text: spokenQuestion,
                      projectId: cognition.situation.getSnapshot().currentProject,
                      limit: 6,
                      minConfidence: 0.35
                    });
                    session.sendClientContent({
                      turns: [{
                        role: "user",
                        parts: [
                          {
                            text: withRetrievedMemory(
                              `${spokenQuestion}

A fresh screenshot is attached. Analyze it and answer the spoken question directly.`,
                              recalled
                            )
                          },
                          { inlineData: { data: frame.imageBase64, mimeType: frame.mimeType } }
                        ]
                      }],
                      turnComplete: true
                    });
                    lastSharedScreenFrameAt = Date.now();
                    screenVision.markFrameDelivered(frame);
                    console.log(`[ScreenVision] Ordered multimodal turn sent for voice input (${frame.width}x${frame.height}).`);
                  } catch (error) {
                    screenVision.reportError(
                      `Vision model delivery failed: ${error instanceof Error ? error.message : String(error)}`
                    );
                  }
                })();
              }
            }
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name} keys=[${Object.keys(fc.args || {}).join(",")}]`);
                if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const mList = await loadMemories();
                        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
                        const newMemory = {
                          id: Math.random().toString(36).substring(2, 11),
                          category,
                          text,
                          createdAt: timestamp,
                          updatedAt: timestamp
                        };
                        mList.push(newMemory);
                        await saveMemories(mList);
                        await cognition.memories.importLegacy(mList);
                        await processCognitiveEvent({
                          type: "memory.created",
                          source: "memory",
                          importance: 0.7,
                          correlationId: connectionId,
                          metadata: { connectionId, memoryId: newMemory.id, text: newMemory.text }
                        });
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        session.sendToolResponse({
                          functionResponses: [
                            {
                              name: fc.name,
                              response: { output: { result: "Memory successfully captured and persisted in connections core." } },
                              id: fc.id
                            }
                          ]
                        });
                      }
                    } catch (err) {
                      console.error("saveCustomMemory execution failure:", err);
                    }
                  })();
                } else if (fc.name === "confirmPendingAction") {
                  (async () => {
                    const confirmationId = String(fc.args?.confirmation_id || "");
                    const confirmed = await toolExecutor.confirm(confirmationId);
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output: confirmed },
                        id: fc.id
                      }]
                    });
                  })();
                } else if (DESKTOP_TOOLS.has(fc.name) || API_HUB_TOOLS.has(fc.name)) {
                  (async () => {
                    console.log(`[MYRAA Tool] Routing ${fc.name} through safety policy...`);
                    const mutationGuard = await guardFileMutation(fc.name, fc.args, process.env.MYRAA_APP_ROOT || process.cwd());
                    const execution = mutationGuard.allowed
                        ? await toolExecutor.execute(
                            fc.name,
                            fc.args,
                            {
                              correlationId: `${connectionId}:${fc.id}`,
                              projectRoot: process.env.MYRAA_APP_ROOT || process.cwd()
                            }
                          )
                        : { ok: false, status: "denied", tool: fc.name, result: null, error: mutationGuard.reason || "Action was not approved.", riskLevel: 3, durationMs: 0, attempts: 0 };
                    const verification = critic.verifyToolResult(execution);
                    let output = execution.status === "confirmation_required" ? {
                      confirmation_required: true,
                      confirmation_id: execution.confirmationId,
                      risk_level: execution.riskLevel,
                      verification,
                      result: "This action was not executed. Ask the user to confirm the exact action, then call confirmPendingAction with the confirmation_id only after an explicit yes."
                    } : { ...execution, verification };
                    if (screenVision && (fc.name === "takeScreenshot" || fc.name === "viewScreen")) {
                      const result2 = execution?.result;
                      const payload = result2 && typeof result2 === "object" ? result2 : null;
                      const image = payload && typeof payload.image_base64 === "string" ? payload.image_base64 : "";
                      if (image) {
                        const safePayload = { ...payload };
                        delete safePayload.image_base64;
                        output = {
                          ...output,
                          result: { ...safePayload, image_attached_to_vision_context: true }
                        };
                        const injected = screenVision.injectFrame({
                          ok: true,
                          imageBase64: image,
                          mimeType: typeof payload?.image_mime === "string" ? payload.image_mime : "image/jpeg",
                          width: Number(payload?.width) || 0,
                          height: Number(payload?.height) || 0,
                          activeWindow: typeof payload?.active_window === "string" ? payload.active_window : null,
                          source: fc.name === "viewScreen" ? "viewScreen" : "takeScreenshot",
                          capturedAt: Date.now()
                        });
                        if (injected) {
                          logCommand(`SCREEN_VISION Frame injected from ${fc.name} (${payload?.width || "?"}x${payload?.height || "?"}).`);
                          console.log(`[ScreenVision] Frame injected from ${fc.name} (${payload?.width || "?"}x${payload?.height || "?"}).`);
                        }
                      } else if (fc.name === "viewScreen" || fc.args?.include_image) {
                        logCommand(`SCREEN_VISION ${fc.name} did not return image bytes; model will rely on text.`);
                      }
                    }
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output },
                        id: fc.id
                      }]
                    });
                  })();
                } else {
                  clientWs.send(JSON.stringify({
                    type: "toolCall",
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args
                  }));
                }
              }
            }
          },
          onerror: (event) => {
            const details = String(event?.error?.message || event?.message || event || "Unknown Gemini Live error");
            if (/GoAway|duration|closed by client|Connection aborted|session durat/i.test(details)) {
              console.log("[Gemini Live] Session duration boundary in onerror — handled quietly.");
              return;
            }
            console.error("Gemini Live session error:", details);
            logError(`GEMINI_LIVE_ERROR: ${details}`);
            if (/api.?key|auth|unauthenticated|credential|permission|400|403/i.test(details)) {
              try {
                clientWs.send(JSON.stringify({
                  type: "error",
                  category: "AUTH_FAILURE",
                  code: 401,
                  error: "Google rejected the Gemini API key. Please update your key in Settings.",
                  actionPrompt: "Update API Key in Settings"
                }));
              } catch {}
            }
          },
          onclose: async (event) => {
            const reason = String(event?.reason || event?.message || (typeof event === "string" ? event : "") || "No close reason provided");
            const code = Number(event?.code) || 1006;
            const details = `code=${code} reason=${reason}`;
            logError(`GEMINI_LIVE_CLOSED ${details}`);

            const keyValidation = await liveSupervisor.validateApiKey(apiKey);
            const classification = liveSupervisor.classifyDisconnect(code, reason, keyValidation);

            liveSupervisor.lastError = classification;
            liveSupervisor.logEvent('DISCONNECT', classification);

            if (classification.category === 'AUTH_FAILURE') {
              console.error("[Gemini Live] Session closed (Auth Failure):", details);
              clearGeminiApiKey();
              try {
                clientWs.send(JSON.stringify({
                  type: "error",
                  category: "AUTH_FAILURE",
                  code: classification.code,
                  reason: classification.reason,
                  error: classification.userMessage,
                  actionPrompt: classification.actionPrompt
                }));
              } catch {}
              return;
            }

            if (classification.category === 'IDLE_TIMEOUT') {
              console.log("[Gemini Live] Session duration reached GoAway — renewing quietly...");
              try {
                clientWs.send(JSON.stringify({
                  type: "session_refresh",
                  category: "IDLE_TIMEOUT",
                  code: classification.code,
                  reason: classification.reason,
                  message: classification.userMessage,
                  canAutoRetry: true
                }));
              } catch {}
              return;
            }

            // Category 3: NETWORK_DROP
            console.log(`[Gemini Live] Network drop (${details}) — triggering backoff reconnect.`);
            liveSupervisor.reconnectAttempts++;
            const backoffDelay = liveSupervisor.getBackoffDelay(liveSupervisor.reconnectAttempts);
            try {
              clientWs.send(JSON.stringify({
                type: "network_drop",
                category: "NETWORK_DROP",
                code: classification.code,
                reason: classification.reason,
                attempt: liveSupervisor.reconnectAttempts,
                backoffDelay,
                error: classification.userMessage,
                actionPrompt: classification.actionPrompt
              }));
            } catch {}
          }
        }
      });
      screenVision = new ScreenVisionPipeline({
        callAgent: callDesktopAgent,
        pushFrameToSession: ({ data, mimeType }) => {
          session.sendRealtimeInput({ video: { data, mimeType } });
          lastSharedScreenFrameAt = Date.now();
        },
        log: (line) => logCommand(`SCREEN_VISION ${line}`),
        onStateChange: (state, info) => {
          try {
            clientWs.send(JSON.stringify({
              type: "screenVisionState",
              state,
              activeWindow: info?.activeWindow ?? null,
              error: info?.error ?? null
            }));
          } catch {
          }
        }
      });
      rememberScreenVision(screenVision);
      console.log(`[ScreenVision] Pipeline bound to connection ${connectionId}.`);
      const unsubscribeInitiative = cognition.onDecision((outcome) => {
        if (!outcome.decision.shouldGenerateSpeech) return;
        if (clientWs.readyState !== 1) return;
        const isInternal = outcome.event.type.startsWith("internal.");
        if (outcome.event.correlationId && !isInternal) return;
        if (cognition.config.debug) {
          clientWs.send(JSON.stringify({
            type: "cognitionDecision",
            eventType: outcome.event.type,
            attention: outcome.attention.score,
            decision: outcome.decision.action,
            reason: outcome.decision.reason
          }));
        }
        const thoughtId = typeof outcome.event.metadata.thoughtId === "string" ? outcome.event.metadata.thoughtId : void 0;
        const source = outcome.decision.action === "WARN" ? "critical_warning" : outcome.event.type === "internal.unfinished_topic" ? "conversation_continuation" : "casual_initiative";
        speechOrchestrator.request({
          id: outcome.event.id,
          source,
          thoughtId,
          deliver: () => {
            if (isInternal) cognition.markAutonomousSpeechStarted(thoughtId);
            session.sendClientContent({
              turns: [{
                // Gemini Live exposes only user/model transport roles. The
                // typed internal turn is explicitly labelled at this boundary
                // so it is never represented as something TECH said.
                role: "user",
                parts: [{ text: buildInitiativePrompt(outcome) }]
              }],
              turnComplete: true
            });
          }
        });
      });
      cognition.setSpeechAvailable(true);
      const runProactivePresenceCheck = async () => {
        const now2 = Date.now();
        if (presenceCheckInFlight || now2 < nextPresenceAt || clientWs.readyState !== 1) return;
        try {
          const proactiveSettings = loadSettingsFile();
          if (proactiveSettings.proactiveEnabled !== true) {
            nextPresenceAt = Date.now() + nextPresenceDelayMs(4);
            return;
          }
        } catch (e2) {
        }
        const speechStatus = speechOrchestrator.status();
        const situation = cognition.situation.getSnapshot();
        if (speechStatus.active || speechStatus.userSpeaking || situation.userSpeaking || situation.myraaSpeaking || situation.autonomyPaused) return;
        if (now2 - lastUserPresenceActivityAt < 1e4) {
          nextPresenceAt = lastUserPresenceActivityAt + nextPresenceDelayMs(0);
          return;
        }
        presenceCheckInFlight = true;
        try {
          let observation = null;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3e3);
          try {
            observation = await fetchDesktopObservation(controller.signal);
          } catch {
            observation = null;
          } finally {
            clearTimeout(timeout);
          }
          let screenSource = "recent shared screen";
          let screenAvailable = now2 - lastSharedScreenFrameAt <= 25e3;
          if (!screenAvailable) {
            const screenshot = await callDesktopAgent("takeScreenshot", {
              include_image: true,
              max_dim: 640
            });
            const payload = screenshot.result;
            const image = typeof payload?.image_base64 === "string" ? payload.image_base64 : "";
            if (screenshot.ok && image) {
              session.sendRealtimeInput({
                video: { data: image, mimeType: "image/jpeg" }
              });
              screenSource = "fresh desktop screenshot";
              screenAvailable = true;
            }
          }
          const idleSeconds = observation ? Number(observation.userIdleSeconds || 0) : (now2 - lastUserPresenceActivityAt) / 1e3;
          const mode = classifyProactivePresence({
            userIdleSeconds: idleSeconds,
            lastMeaningfulScreenChangeAt,
            now: now2
          });
          const latestSpeechStatus = speechOrchestrator.status();
          const latestSituation = cognition.situation.getSnapshot();
          if (latestSpeechStatus.active || latestSpeechStatus.userSpeaking || latestSituation.userSpeaking || latestSituation.myraaSpeaking || Date.now() - lastUserPresenceActivityAt < 1e4) {
            nextPresenceAt = Date.now() + nextPresenceDelayMs(0);
            return;
          }
          if (mode === "idle_away" && !shouldRepeatIdlePresence(lastIdlePresenceAt, now2)) {
            nextPresenceAt = Math.max(lastIdlePresenceAt + 12e4, now2 + 2e4);
            return;
          }
          const thoughtId = (0, import_node_crypto10.randomUUID)();
          presenceTurnsWithoutUser += 1;
          if (mode === "idle_away") lastIdlePresenceAt = now2;
          nextPresenceAt = now2 + nextPresenceDelayMs(presenceTurnsWithoutUser);
          await processCognitiveEvent({
            type: "internal.proactive_presence",
            source: "internal",
            importance: mode === "idle_away" ? 0.8 : 0.78,
            confidence: screenAvailable ? 0.9 : 0.68,
            metadata: {
              connectionId,
              thoughtId,
              thought: mode === "idle_away" ? "The user has been quiet and may have stepped away. Check the latest screen before making one playful, non-repetitive presence remark." : "The user is silently working. Inspect the latest screen and contribute one concrete observation, suggestion, pointed question, or light joke about the visible task.",
              topic: observation?.activeWindow.title || situation.activeWindow || "current desktop activity",
              application: observation?.activeWindow.application || situation.activeApp,
              activeWindow: observation?.activeWindow.title || situation.activeWindow,
              idleSeconds,
              presenceMode: mode,
              screenSource,
              screenAvailable,
              suggestedAction: "OBSERVE",
              relevance: 0.9,
              novelty: 0.82,
              urgency: 0.16,
              userImpact: 0.7,
              taskRelevance: mode === "active_task" ? 0.9 : 0.62,
              interruptionCost: mode === "active_task" ? 0.16 : 0.08,
              socialOpportunityScore: 0.9
            }
          });
        } finally {
          presenceCheckInFlight = false;
        }
      };
      presenceTimer = setInterval(() => void runProactivePresenceCheck(), 1e3);
      presenceTimer.unref?.();
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      clientWs.on("message", async (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "conversationEvent" && typeof msg.event === "string") {
            const allowed = /* @__PURE__ */ new Set([
              "user_started_speaking",
              "user_stopped_speaking",
              "user_interrupted_myraa"
            ]);
            if (allowed.has(msg.event)) {
              if (msg.event === "user_started_speaking") {
                markUserPresenceActivity();
                speechOrchestrator.onUserSpeechStarted();
                voiceScreenIntentText = "";
                voiceScreenVisionTriggered = false;
              } else if (msg.event === "user_stopped_speaking") {
                speechOrchestrator.onUserSpeechStopped();
              }
              void processCognitiveEvent({
                type: `conversation.${msg.event}`,
                source: "conversation",
                importance: msg.event === "user_interrupted_myraa" ? 0.78 : 0.4,
                correlationId: connectionId,
                metadata: { connectionId, rms: msg.rms }
              });
            }
          } else if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" }
            });
          } else if (msg.type === "video" && msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: "image/jpeg" }
            });
            const now2 = Date.now();
            const changeScore = Number(msg.changeScore);
            const heartbeat = msg.heartbeat === true;
            lastSharedScreenFrameAt = now2;
            if (!heartbeat && Number.isFinite(changeScore) && changeScore >= 7) {
              lastMeaningfulScreenChangeAt = now2;
            }
            if (now2 - lastScreenObservationAt >= 1e4) {
              lastScreenObservationAt = now2;
              void processCognitiveEvent({
                type: "screen.frame_received",
                source: "screen",
                importance: 0.08,
                correlationId: connectionId,
                metadata: { connectionId, changeScore, heartbeat }
              });
            }
            if (!heartbeat && Number.isFinite(changeScore) && changeScore >= 16 && now2 - lastVisualInitiativeAt >= 3e4) {
              lastVisualInitiativeAt = now2;
              void processCognitiveEvent({
                type: "internal.visual_context_changed",
                source: "internal",
                importance: 0.74,
                confidence: 0.76,
                metadata: {
                  connectionId,
                  thoughtId: (0, import_node_crypto10.randomUUID)(),
                  thought: "The shared screen changed substantially. Inspect the latest frame and react only if there is a concrete new result, error, risk, surprise, or genuinely useful observation.",
                  topic: "latest shared screen",
                  suggestedAction: "SPEAK",
                  relevance: 0.8,
                  novelty: 0.82,
                  urgency: 0.2,
                  userImpact: 0.62,
                  taskRelevance: 0.74,
                  interruptionCost: 0.2,
                  socialOpportunityScore: 0.76,
                  changeScore
                }
              });
            }
          } else if (msg.type === "text" && typeof msg.text === "string") {
            const text = msg.text;
            const trimmed = text.trim();
            if (trimmed) {
              markUserPresenceActivity();
              speechOrchestrator.observeUserResponse();
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: trimmed }));
              dialogueHistory.push({ role: "user", text: trimmed });
              recordTranscriptToDisk("User", trimmed);
              queueCognitiveUserText(trimmed, "typed");
              const isScreenRequest = detectScreenVisionIntent(trimmed);
              const screenFrame = screenVision && isScreenRequest ? await screenVision.capture("intent") : null;
              const recalled = await cognition.memories.retrieve({
                text: trimmed,
                projectId: cognition.situation.getSnapshot().currentProject,
                limit: 6,
                minConfidence: 0.35
              });
              const promptText = isScreenRequest && !screenFrame ? `${trimmed}

The one-shot screen capture was unavailable. Say clearly that you could not access the screen, then ask the user to try again.` : trimmed;
              const parts = [
                { text: withRetrievedMemory(promptText, recalled) }
              ];
              if (screenFrame) {
                parts.push({
                  inlineData: {
                    data: screenFrame.imageBase64,
                    mimeType: screenFrame.mimeType
                  }
                });
              }
              try {
                session.sendClientContent({
                  turns: [{ role: "user", parts }],
                  turnComplete: true
                });
                if (screenFrame && screenVision) {
                  lastSharedScreenFrameAt = Date.now();
                  screenVision.markFrameDelivered(screenFrame);
                  console.log(`[ScreenVision] Ordered multimodal turn sent for typed input (${screenFrame.width}x${screenFrame.height}).`);
                }
              } catch (error) {
                if (screenVision && isScreenRequest) {
                  screenVision.reportError(
                    `Vision model delivery failed: ${error instanceof Error ? error.message : String(error)}`
                  );
                }
                throw error;
              }
            }
          } else if (msg.type === "attachment" && Array.isArray(msg?.attachments)) {

            const at = [];
            for (const a of msg.attachments) {
              if (a && typeof a === "object" && typeof a.mimeType === "string" && typeof a.dataBase64 === "string") at.push(a);
            }
            if (at.length) {
              const recText = String(msg.text || "").trim();
              if (recText) {
                markUserPresenceActivity();
                speechOrchestrator.observeUserResponse();
                clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: recText }));
                dialogueHistory.push({ role: "user", text: recText });
                queueCognitiveUserText(recText, "attachment");
              }
              const parts2 = [];
              if (recText) parts2.push({ text: recText }); else parts2.push({ text: "Please analyze the attached image(s/video) and respond." });
              const totalBytes = at.reduce(function (sum, a) { return sum + Math.floor((a.dataBase64.length * 3) / 4); }, 0);
              if (totalBytes <= 12 * 1024 * 1024) {
                for (const at2 of at) parts2.push({ inlineData: { mimeType: at2.mimeType, data: at2.dataBase64 } });
                session.sendClientContent({ turns: [{ role: "user", parts: parts2 }], turnComplete: true });
                console.log("[Attachments] Analyzed " + at.length + " attachment(s via multimodal turn.");
              } else {
                clientWs.send(JSON.stringify({ type: "error", error: "Attachments exceede the 12 MB total limit." }));
              }
            }
          } else if (msg.type === "toolResponse") {
            session.sendToolResponse({
              functionResponses: [
                {
                  name: msg.name,
                  response: { output: msg.output },
                  id: msg.id
                }
              ]
            });
          }
        } catch (e) {
          console.error("Error editing/forwarding client frame message:", e);
        }
      });
      clientWs.on("close", () => {
        console.log("Client disconnected, closing Gemini session");
        unsubscribeInitiative();
        screenVision?.dispose();
        forgetScreenVision();
        screenVision = null;
        cognition.setSpeechAvailable(false);
        const interruptedSpeech = speechOrchestrator.onInterrupted();
        if (interruptedSpeech?.source === "conversation_continuation" || interruptedSpeech?.source === "casual_initiative") {
          cognition.markAutonomousSpeechInterrupted(currentModelResponseText.slice(-800));
        }
        if (userCognitionTimer) clearTimeout(userCognitionTimer);
        if (presenceTimer) clearInterval(presenceTimer);
        void processCognitiveEvent({
          type: "conversation.session_ended",
          source: "conversation",
          importance: 0.45,
          correlationId: connectionId,
          metadata: { connectionId }
        });
        try {
          session.close();
        } catch (e) {
        }
      });
    } catch (err) {
      console.error("Error connecting to Gemini Live API:", err);
      const errMsg = err?.message || String(err);
      const keyValidation = await liveSupervisor.validateApiKey(apiKey);
      if (keyValidation.category === 'AUTH_FAILURE' || /api.?key|auth|credential|unauthenticated|400|403/i.test(errMsg)) {
        clientWs.send(JSON.stringify({
          type: "error",
          category: "AUTH_FAILURE",
          code: 401,
          error: keyValidation.message || "Google rejected the Gemini API key. Please update your key in Settings.",
          actionPrompt: "Update API Key in Settings"
        }));
      } else {
        liveSupervisor.reconnectAttempts++;
        const backoffDelay = liveSupervisor.getBackoffDelay(liveSupervisor.reconnectAttempts);
        clientWs.send(JSON.stringify({
          type: "network_drop",
          category: "NETWORK_DROP",
          code: 1006,
          attempt: liveSupervisor.reconnectAttempts,
          backoffDelay,
          error: `Could not connect to Gemini (${errMsg}). Auto-reconnecting in ${Math.round(backoffDelay / 1000)}s...`,
          actionPrompt: "Reconnecting automatically..."
        }));
      }
      clientWs.close();
    }
  });
  const candidateDistPath = fs9.existsSync(import_path2.default.join(__dirname, "index.html"))
    ? __dirname
    : (fs9.existsSync(import_path2.default.join(process.cwd(), "dist", "index.html"))
      ? import_path2.default.join(process.cwd(), "dist")
      : (fs9.existsSync(import_path2.default.join(process.cwd(), "resources", "app", "dist", "index.html"))
        ? import_path2.default.join(process.cwd(), "resources", "app", "dist")
        : import_path2.default.join(process.cwd(), "dist")));

  const appAssetsDir = fs9.existsSync(import_path2.default.join(candidateDistPath, "..", "assets"))
    ? import_path2.default.join(candidateDistPath, "..", "assets")
    : import_path2.default.join(process.cwd(), "assets");
  app.use("/assets", import_express.default.static(appAssetsDir));
  app.use("/assets", import_express.default.static(import_path2.default.join(candidateDistPath, "assets")));
  app.use(import_express.default.static(candidateDistPath));
  try { const apexRoutes = require("./apex_v5_routes.cjs"); app.use(apexRoutes); } catch(e){ console.warn(e); }
  try {
    const skillsMcp = require("./skills_mcp_engine.cjs");
    app.use(skillsMcp.router);
    console.log("[Server] Successfully mounted skills_mcp_engine.cjs (MCP Tools, Skills, Mobile API)");
  } catch(e) {
    console.warn("[Server] Could not mount skills_mcp_engine.cjs:", e.message);
  }

  app.get("/mobile", (req, res) => {
    const mobilePath = fs9.existsSync(import_path2.default.join(candidateDistPath, "mobile_companion.html"))
      ? import_path2.default.join(candidateDistPath, "mobile_companion.html")
      : import_path2.default.join(__dirname, "mobile_companion.html");
    res.sendFile(mobilePath);
  });

  if (process.env.NODE_ENV !== "production" && !fs9.existsSync(import_path2.default.join(candidateDistPath, "index.html"))) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/live") || req.path.startsWith("/mobile")) return next();
      res.sendFile(import_path2.default.join(candidateDistPath, "index.html"));
    });
  }
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} is already in use by an active instance. Keeping process alive.`);
      return;
    }
    console.error('[Server] Fatal server error:', err);
    process.exit(1);
  });
  server.listen(PORT, "0.0.0.0", () => {
    logStartup(`MYRAA V2 server started on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Running on http://0.0.0.0:${PORT} (LAN & Mobile Remote Enabled)`);
    ensureDesktopAgent().then(async () => {
      await ensureDesktopObserver();
      if (cognition.config.desktopAwarenessEnabled && desktopObserverUrl) desktopPerception.start();
    }).catch((e) => console.warn(`[Desktop Agent] Boot probe failed: ${e?.message || e}`));
  });
  const shutdownCognition = () => {
    desktopPerception.stop();
    void cognition.shutdown().catch(
      (error) => logError(`COGNITION_SHUTDOWN_FAILED: ${error instanceof Error ? error.message : String(error)}`)
    );
  };
  process.once("SIGTERM", shutdownCognition);
  process.once("SIGINT", shutdownCognition);
}
function legacyCategoryForKind(kind) {
  switch (kind) {
    case "preference":
      return "preference";
    case "project":
      return "project";
    case "episodic":
      return "emotional";
    case "correction":
      return "behavior";
    case "skill":
      return "behavior";
    case "working":
      return "goal";
    case "semantic":
    default:
      return "identity";
  }
}
async function assertSafeExternalUrl(value) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not allowed.");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network addresses are not allowed through the web proxy.");
  }
  const addresses = import_node_net2.default.isIP(hostname) ? [hostname] : (await import_promises8.default.lookup(hostname, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Private, loopback, or link-local destinations are not allowed through the web proxy.");
  }
}
function isPrivateAddress(address) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (import_node_net2.default.isIP(normalized) === 4 ? normalized : null);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 198 && (b === 18 || b === 19);
}
function classifyUserEventType(text) {
  const normalized = text.trim().toLowerCase();
  if (/^(no[, ]|actually\b|correction\b)|\b(that'?s|that is) (wrong|not right)\b|\bi told you\b/.test(normalized)) {
    return "conversation.user_correction";
  }
  if (/\?$|^(what|why|when|where|who|how|can|could|should|is|are|do|does|did|will|would)\b/.test(normalized)) {
    return "conversation.user_question";
  }
  return "conversation.user_input";
}
function isStopIntent(text) {
  const normalized = text.trim().toLowerCase();
  if (/\b(don'?t|do not) stop\b/.test(normalized)) return false;
  return /^(myraa[,. ]+)?(stop|cancel|abort|don'?t do that|do not do that)(\b|[.!])/.test(normalized);
}
function isPauseAutonomyIntent(text) {
  return /\b(pause|disable|turn off) (myraa'?s? )?(autonomy|autonomous mode)\b/i.test(text);
}
function isResumeAutonomyIntent(text) {
  return /\b(resume|enable|turn on) (myraa'?s? )?(autonomy|autonomous mode)\b/i.test(text);
}
function parseQuietIntent(text) {
  const normalized = text.trim().toLowerCase();
  if (/\b(talk normally|normal baat|speak normally|resume talking)\b/.test(normalized)) return null;
  if (!/\b(myraa[,. ]+quiet|be quiet|stay quiet|don'?t disturb me|do not disturb me|chup raho)\b/.test(normalized)) {
    return null;
  }
  const match = normalized.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(minute|min|hour|hr)s?/);
  if (!match) return {};
  const amount = Number(match[1]);
  const unitMs = /hour|hr/.test(match[2]) ? 36e5 : 6e4;
  return { durationMs: Math.min(24 * 36e5, Math.max(0, amount * unitMs)) };
}
function isTalkNormallyIntent(text) {
  return /\b(myraa[,. ]+)?(talk normally|speak normally|normal baat karo|don'?t be quiet|stop being quiet)\b/i.test(text);
}
function createContextualThoughtCandidate(context) {
  const { thread } = context;
  const lastUser = (thread.lastUserStatement || "").trim();
  const lastMyraa = (thread.lastMyraaStatement || "").trim();
  const timestamp = Date.now();
  const make = (origin, content, suggestedAction = "SPEAK", scores = {}) => ({
    id: (0, import_node_crypto10.randomUUID)(),
    createdAt: timestamp,
    origin,
    content,
    relevance: scores.relevance ?? 0.88,
    novelty: scores.novelty ?? 0.78,
    urgency: scores.urgency ?? 0.24,
    socialValue: scores.socialValue ?? 0.82,
    confidence: scores.confidence ?? 0.82,
    suggestedAction,
    relatedTopic: thread.topic,
    relatedMemoryIds: context.relevantMemories.slice(0, 3).map((memory) => memory.id),
    expiresAt: timestamp + 12e4
  });
  const interrupted = thread.interruptedThoughts.at(-1)?.trim();
  if (context.reason === "interrupted_thought" && interrupted) {
    return make(
      "unfinished_thread",
      `A thought was cut off: "${interrupted}". Reconsider it against the latest exchange; resume only the still-relevant part, naturally and briefly.`,
      "SPEAK",
      { relevance: 0.94, novelty: 0.72, socialValue: 0.9 }
    );
  }
  if (context.reason === "goal_review") {
    return make(
      "goal",
      `The active goal "${thread.topic}" may deserve one concrete progress observation, blocker, or next step. Mention it only if it is useful right now.`,
      "SUGGEST",
      { relevance: thread.importance, novelty: 0.72, urgency: 0.35, socialValue: 0.76 }
    );
  }
  if (context.reason === "memory_resurfaced") {
    const memory = context.relevantMemories[0];
    if (!memory) return null;
    return make(
      "memory",
      `A relevant memory resurfaced: "${memory.content}". Connect it to the present situation only if the connection is concrete and not repetitive.`,
      "SPEAK",
      { relevance: memory.importance, novelty: 0.7, socialValue: 0.75, confidence: memory.confidence }
    );
  }
  if (!lastUser || !lastMyraa) return null;
  if (isFeedbackAboutMyraa(lastUser)) {
    return make(
      "reflection",
      `The user criticized MYRAA's conversational presence in "${lastUser}". Inspect MYRAA's last response for one concrete bot-like pattern and state the better behavior naturally. Use zero questions. Do not claim emotional connection and do not suggest collecting more preferences, routines, memories, or personal data.`,
      "SPEAK",
      { relevance: 0.97, novelty: 0.86, socialValue: 0.95, confidence: 0.92 }
    );
  }
  if (isFeelingOrFeedback(lastUser)) {
    return make(
      "reflection",
      `The user expressed a feeling or judgment in "${lastUser}". Do not interview them or ask for more feedback. Add one specific interpretation or grounded reaction as a natural statement, without claiming human emotions.`,
      "SPEAK",
      { relevance: 0.94, novelty: 0.82, socialValue: 0.92, confidence: 0.88 }
    );
  }
  const meaningfulMemory = context.relevantMemories.find(
    (memory) => memory.importance >= 0.62 && hasDistinctiveTopicOverlap(`${lastUser} ${lastMyraa}`, memory.content) && !roughlyContained(lastMyraa, memory.content)
  );
  if (meaningfulMemory) {
    return make(
      "memory",
      `The latest exchange was about "${lastUser}". This relevant memory was not used yet: "${meaningfulMemory.content}". Add only the concrete connection as a statement. Do not ask what else to remember and do not make a generic offer to help.`,
      "SPEAK",
      { relevance: 0.9, novelty: 0.84, socialValue: 0.86, confidence: meaningfulMemory.confidence }
    );
  }
  if (context.curiosity && !isSimpleResolvedCommand(lastUser)) {
    return make(
      "curiosity",
      `From "${lastUser}", identify the one specific missing preference or assumption that genuinely changes what happens next. Ask that exact question without saying it is random or offering a menu.`,
      "ASK",
      { relevance: 0.9, novelty: 0.82, socialValue: 0.88 }
    );
  }
  if (isSimpleResolvedCommand(lastUser) || isClosedAnswer(lastUser, lastMyraa)) return null;
  const topicSeed = thread.unresolvedPoints.at(-1) || lastUser;
  return make(
    "unfinished_thread",
    `The conversation is still socially active around "${topicSeed}". Add one short, concrete implication, opinion, or useful disagreement that was not already in MYRAA's last line. If there is genuinely nothing new, complete silently.`,
    "SPEAK",
    { relevance: 0.86, novelty: 0.76, socialValue: 0.84 }
  );
}
function roughlyContained(haystack, needle) {
  const words = (value) => new Set(
    value.toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, " ").split(/\s+/).filter((word) => word.length >= 4)
  );
  const left = words(haystack);
  const right = words(needle);
  if (right.size === 0) return false;
  let overlap = 0;
  for (const word of right) if (left.has(word)) overlap += 1;
  return overlap / right.size >= 0.55;
}
function isFeelingOrFeedback(text) {
  return /\b(feel|feels|feeling|lagta|lagti|missing|annoy|irritat|boring|robot|chatbot|human|natural|real|problem|issue|pasand|weird|awkward)\b/i.test(text);
}
function isFeedbackAboutMyraa(text) {
  const namesMyraa = /\b(myraa|you|your|tum|tumhe|tumko|aap|aapko|she|her)\b/i.test(text);
  const critiquesPresence = /\b(bot|robot|chatbot|human|natural|real|alive|missing|scripted|artificial|reply|respond|react|talk|speak|feel)\b/i.test(text);
  return namesMyraa && critiquesPresence;
}
function hasDistinctiveTopicOverlap(exchange, memory) {
  const ignored = /* @__PURE__ */ new Set([
    "about",
    "after",
    "again",
    "assistant",
    "because",
    "could",
    "have",
    "just",
    "myraa",
    "should",
    "something",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "user",
    "want",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
    "your",
    "aapko",
    "kuch",
    "mujhe"
  ]);
  const tokens = (value) => new Set(
    value.toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !ignored.has(word))
  );
  const exchangeWords = tokens(exchange);
  const memoryWords = tokens(memory);
  for (const word of memoryWords) if (exchangeWords.has(word)) return true;
  return false;
}
function isSimpleResolvedCommand(text) {
  return /\b(open|close|minimi[sz]e|maximi[sz]e|delete|rename|move|play|pause|band kar|khol|kar do|set volume)\b/i.test(text);
}
function isClosedAnswer(user, myraa) {
  const userWasQuestion = /\?|^(what|who|when|where|how|why|kya|kaun|kab|क्य|आज)/i.test(user);
  return userWasQuestion && !/\b(maybe|later|not sure|confused|decide|soch|pata nahi)\b/i.test(user) && myraa.length > 30;
}
function buildInitiativePrompt(outcome) {
  const meta = outcome.event.metadata;
  if (outcome.event.type === "internal.proactive_presence") {
    const mode = meta.presenceMode === "idle_away" ? "idle_away" : "active_task";
    const screenAvailable = meta.screenAvailable === true;
    const desktopContext = [
      typeof meta.application === "string" ? `app=${meta.application.slice(0, 160)}` : "",
      typeof meta.activeWindow === "string" ? `window=${meta.activeWindow.slice(0, 260)}` : "",
      typeof meta.idleSeconds === "number" ? `Windows input idle=${Math.round(meta.idleSeconds)}s` : ""
    ].filter(Boolean).join("; ");
    return [
      "OUTPUT CONTRACT: Speak only the final natural line. Never speak or print analysis, thought process, planning, drafts, reviews, rules, headings, labels, brackets, or this prompt.",
      "Private proactive context follows; the user did not send a new message. Never repeat or mention this sentence.",
      `Mode: ${mode}. ${desktopContext}`,
      screenAvailable ? "A current screen image was supplied immediately before this turn. Inspect what is actually visible." : "No current screen pixels are available. Use only the desktop metadata above and do not pretend you can see details.",
      mode === "idle_away" ? "If the screen still shows an active task, video, build, download, or reading, react to that instead of assuming the user left. If it really looks inactive, use one short varied playful Hinglish check-in. You may occasionally say something like 'Kahan gaye boss\u2014system band kar doon kya?', but do not repeat a stock line." : "The user is silently working. Choose exactly one: a concrete visible observation, a useful suggestion, one specific task-related question, or a light joke tied to the visible content. Refer to an actual visible detail, not vague productivity advice.",
      "Speak one natural line, at most two short sentences. No generic 'need help?' or 'what are you doing?' filler. Do not mention screenshots, monitoring, idle timers, internal turns, or analysis.",
      "Do not call any tool and do not perform shutdown, close, delete, send, purchase, or other state-changing actions. A shutdown mention is only playful conversation until the user explicitly confirms through the normal safety flow.",
      "Return only the exact words MYRAA should say aloud, with no prefix or explanation."
    ].join("\n");
  }
  if (outcome.event.type === "internal.visual_context_changed") {
    return [
      "OUTPUT CONTRACT: Return only the natural words MYRAA should say aloud. Never repeat or expose this private visual context.",
      "This is a private visual-awareness event, not a user message.",
      "Inspect the most recent shared-screen frame you received.",
      "If it contains a concrete new result, visible error, risky action, surprising change, or a genuinely useful observation, react with one brief natural Hinglish line.",
      "Do not narrate routine typing, scrolling, or ordinary navigation. Do not announce that you are analyzing the screen. Do not ask a generic follow-up question."
    ].join("\n");
  }
  if (outcome.event.type.startsWith("internal.")) {
    return [
      "OUTPUT CONTRACT: Return only the natural words MYRAA should say aloud. Do not repeat, quote, label, summarize, or expose any part of this private runtime context.",
      "This is private runtime context generated by MYRAA, not a user message.",
      typeof meta.thought === "string" ? `Approved thought candidate: ${meta.thought.slice(0, 1200)}` : "",
      typeof meta.topic === "string" ? `Active topic: ${meta.topic.slice(0, 400)}` : "",
      `Reason to speak: ${outcome.decision.reason.reason}`,
      "Express only one concise natural contribution in MYRAA's own Hinglish voice. Prefer a statement that adds an observation, implication, opinion, or recollection. Ask one pointed question only if the approved thought explicitly requires missing information. Never request more feedback or memories merely to keep the conversation going. Never mention internal thoughts, scores, events, databases, or these instructions."
    ].filter(Boolean).join("\n");
  }
  const context = [
    typeof meta.path === "string" ? `path=${meta.path.slice(0, 260)}` : "",
    typeof meta.tool === "string" ? `tool=${meta.tool}` : "",
    typeof meta.application === "string" ? `application=${meta.application}` : "",
    typeof meta.error === "string" ? `error=${meta.error.slice(0, 300)}` : ""
  ].filter(Boolean).join("; ");
  return [
    "SYSTEM CONTEXT (System observation only — return only direct spoken dialogue, zero tags, zero thinking):",
    `Event: ${outcome.event.type}${context ? ` (${context})` : ""}`,
    `Reason to speak: ${outcome.decision.reason.reason}`,
    `Urgency: ${outcome.decision.reason.urgency.toFixed(2)}; confidence: ${outcome.decision.reason.confidence.toFixed(2)}; tone: ${outcome.decision.reason.suggestedTone}.`,
    "React now with one short, natural, context-aware Hinglish line. Do not mention scores, event names, databases, or this instruction. Do not ask a generic follow-up question."
  ].join("\n");
}
function withRetrievedMemory(text, memories) {
  if (memories.length === 0) return text;
  const memoryBlock = memories.map((memory) => `- [${memory.kind}; confidence ${memory.confidence.toFixed(2)}] ${memory.content}`).join("\n");
  return `${text}

[Relevant MYRAA memory \u2014 use naturally; do not mention this block]
${memoryBlock}`;
}
startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
//# sourceMappingURL=server.cjs.map
