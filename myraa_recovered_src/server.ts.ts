import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type, LiveServerMessage } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { execFileSync, spawn } from "node:child_process";
import { 
  loadMemories, 
  saveMemories, 
  formatSystemInstructionsWithMemories, 
  processConversationSlice 
} from "./server_memory";
import { Memory } from "./src/lib/memoryTypes";
import {
  DATA_DIR,
  dataFile,
  getGeminiApiKey,
  hasGeminiApiKey,
  setGeminiApiKey,
  clearGeminiApiKey,
} from "./server_paths";
import {
  CognitiveRuntime,
  DesktopPerception,
  GoalPlanner,
  ModelRouter,
  TaskCritic,
  ToolExecutor,
  ToolRegistry,
  SpeechOrchestrator,
  classifyProactivePresence,
  nextPresenceDelayMs,
  shouldRepeatIdlePresence,
  type CognitionOutcome,
  type DesktopSnapshot,
  type InternalThoughtContext,
  type MemoryKind,
  type StructuredMemory,
  type ThoughtCandidate,
} from "./cognition";
import {
  ScreenVisionPipeline,
  detectScreenVisionIntent,
  type ScreenVisionFrame,
} from "./server_screenVision";
import { ApiHubService, type ApiProviderStatus } from "./api_hub";

dotenv.config();

// Keep mutable cognition state outside the TypeScript source directory while
// developing. Writing cognition/*.json under the Vite root makes Vite issue a
// full-page reload each time MYRAA recalls or persists a memory.
const COGNITION_DATA_DIR = process.env.MYRAA_COGNITION_DATA_DIR
  || (process.env.MYRAA_DATA_DIR ? DATA_DIR : path.join(DATA_DIR, ".myraa-data"));

async function migrateDevelopmentCognitionData(): Promise<void> {
  if (path.resolve(COGNITION_DATA_DIR) === path.resolve(DATA_DIR)) return;

  const sourceDir = path.join(DATA_DIR, "cognition");
  const targetDir = path.join(COGNITION_DATA_DIR, "cognition");
  await fs.promises.mkdir(targetDir, { recursive: true });

  for (const name of ["memories.v1.json", "goals.v1.json", "skills.v1.json", "last-session.json"]) {
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, name);
    try {
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "EEXIST") throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// MYRAA V2 — Logging (Feature 7).
// Appends timestamped lines to logs/{commands,startup,errors}.log.
// Never throws; logging failures are swallowed so they can't break the app.
// ---------------------------------------------------------------------------
const LOGS_DIR = path.join(DATA_DIR, "logs");
try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch { /* already exists */ }

function appendLog(fileName: string, message: string): void {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFile(path.join(LOGS_DIR, fileName), line, () => {});
  } catch {
    /* logging is best-effort */
  }
}
const logCommand = (m: string) => appendLog("commands.log", m);
const logStartup = (m: string) => appendLog("startup.log", m);
const logError = (m: string) => appendLog("errors.log", m);

function sanitizeSpokenModelText(value: unknown): string {
  return String(value || "")
    .replace(/\[(?:MYRAA\s+)?(?:INTERNAL\s+COGNITIVE|PROACTIVE\s+PRESENCE|VISUAL\s+AWARENESS)[^\]]*\]\s*/gi, "")
    .replace(/^\s*(?:private\s+runtime\s+context|internal\s+myraa\s+event)\s*[:—-]\s*/i, "");
}

// ---------------------------------------------------------------------------
// MYRAA Desktop Control Agent — HTTP bridge to the Python FastAPI backend.
// ---------------------------------------------------------------------------
const DESKTOP_AGENT_URL = process.env.DESKTOP_AGENT_URL || "http://127.0.0.1:8765";
const DESKTOP_OBSERVER_FALLBACK_URL = process.env.DESKTOP_OBSERVER_URL || "http://127.0.0.1:8766";
const DESKTOP_AGENT_TIMEOUT = 25_000; // ms
let desktopObserverUrl: string | null = null;
let desktopObserverResolutionComplete = false;

/**
 * The complete set of tool names routed to the Python desktop agent.
 * Kept in sync with desktop_agent/registry.py DESKTOP_TOOL_NAMES.
 */
const DESKTOP_TOOLS: ReadonlySet<string> = new Set([
  // applications / websites / search
  "openApplication", "closeApplication", "openWebsite",
  "searchWeb", "searchYouTube", "searchGoogle", "searchGitHub",
  // files
  "createFile", "readFile", "renameFile", "deleteFile", "moveFile",
  "openFolder", "listFiles", "searchFiles",
  // pc control (volume + gated power)
  "volumeUp", "volumeDown", "muteToggle", "setVolume",
  "requestPowerAction", "executePowerAction",
  // windows
  "minimizeWindow", "maximizeWindow", "closeWindow", "switchApplication",
  // generic mouse / keyboard / desktop observation
  "locateText", "clickText",
  "moveMouse", "click", "doubleClick", "rightClick", "drag", "scroll",
  "typeText", "pressKey", "hotkey", "getCursorPosition", "getActiveWindow",
  "listVisibleWindows", "waitForUi", "observeDesktopState",
  // clipboard
  "copySelected", "pasteClipboard", "getClipboard", "clearClipboard",
  // screenshot / screen reading
  "takeScreenshot", "saveScreenshot", "analyzeScreenshot", "readScreen", "viewScreen",
  // coding assistance
  "createPythonFile", "runPythonScript", "createProjectFolder", "writeCodeFile",
  // system information
  "systemInfo", "gpuInfo", "temperatureInfo",
  // brightness control (V2)
  "brightnessUp", "brightnessDown", "setBrightness",
  // Windows auto-start management (V2)
  "enableAutoStart", "disableAutoStart", "getAutoStartStatus",
]);

const API_HUB_TOOLS: ReadonlySet<string> = new Set([
  "searchApiCapabilities",
  "refreshApiCatalogue",
  "checkApiProvider",
  "callVerifiedApiAdapter",
  "convertCurrency",
]);

/**
 * Call the Python desktop agent.  Returns the parsed JSON response.
 * If the agent is unreachable, returns a user-friendly error payload.
 */
/**
 * Whether the desktop agent has been confirmed alive in this process lifetime.
 * If false, callDesktopAgent will probe /health and attempt an auto-spawn.
 */
let desktopAgentVerified = false;

/**
 * Registry of active screen-vision pipelines keyed by WebSocket connectionId.
 * Exists at module scope so both the live WebSocket connection handler and
 * the `/api/screen-vision` HTTP endpoint can locate the right pipeline.
 */
const activeScreenVisionPipelines = new Map<string, ScreenVisionPipeline>();

interface ElectronScreenCaptureResponse {
  type: "screen-capture-response";
  id: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

const pendingElectronCaptures = new Map<
  string,
  (response: ElectronScreenCaptureResponse) => void
>();

// When Electron launches this backend it creates a private Node IPC channel.
// No socket/port is opened and frames never leave the local process tree.
process.on("message", (message: unknown) => {
  const response = message as ElectronScreenCaptureResponse;
  if (response?.type !== "screen-capture-response" || !response.id) return;
  const resolve = pendingElectronCaptures.get(response.id);
  if (!resolve) return;
  pendingElectronCaptures.delete(response.id);
  resolve(response);
});

function requiresImageCapture(tool: string, args: Record<string, unknown>): boolean {
  return tool === "viewScreen" || (tool === "takeScreenshot" && args.include_image === true);
}

async function captureViaElectron(
  maxDim: number,
): Promise<{ ok: boolean; result?: unknown; error?: string } | null> {
  if (typeof process.send !== "function" || !process.connected) return null;
  const id = randomUUID();
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingElectronCaptures.delete(id);
      resolve({ ok: false, error: "Electron screen capture timed out." });
    }, 15_000);
    timer.unref?.();
    pendingElectronCaptures.set(id, (response) => {
      clearTimeout(timer);
      resolve(response.ok
        ? { ok: true, result: response.result }
        : { ok: false, error: response.error || "Electron screen capture failed." });
    });
    try {
      process.send?.({
        type: "screen-capture-request",
        id,
        maxDim: Math.max(320, Math.min(1920, Math.round(maxDim) || 1440)),
      });
    } catch (error) {
      clearTimeout(timer);
      pendingElectronCaptures.delete(id);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

function findPythonRuntime(): string | null {
  const candidates = [
    process.env.MYRAA_PYTHON,
    "C:\\Users\\MSI\\AppData\\Local\\Programs\\Python\\Python314\\python.exe",
    "C:\\Users\\MSI\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
    "python",
    "python3",
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }) || null;
}

/**
 * Auto-spawn the Python desktop agent as a detached child process if it is not
 * already listening. Looks for the project's bundled Python interpreter first,
 * falling back to `python` / `python3` on PATH. Runs detached so it survives
 * even if MYRAA's node process is killed.
 */
function spawnDesktopAgent(): void {
  const agentEnv = {
    ...process.env,
    MYRAA_AGENT_HOST: "127.0.0.1",
    MYRAA_AGENT_PORT: "8765",
  };

  // Preferred path (packaged app): a PyInstaller-frozen agent exe that embeds
  // its own Python runtime. Set by the Electron main process via MYRAA_AGENT_EXE.
  const frozenCandidates = [process.env.MYRAA_AGENT_EXE];
  // A direct `npm run dev` should exercise the source agent, not a potentially
  // stale frozen helper. Electron/packaged runs explicitly pass MYRAA_AGENT_EXE.
  if (process.env.NODE_ENV === "production") {
    frozenCandidates.push(path.join(process.cwd(), "agent_dist", "myraa-agent", "myraa-agent.exe"));
  }
  const frozenExe = frozenCandidates.find(
    (candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate)),
  );
  if (frozenExe) {
    try {
      const child = spawn(frozenExe, [], {
        cwd: path.dirname(frozenExe),
        detached: true,
        stdio: "ignore",
        windowsHide: true, // never flash a console window
        env: agentEnv,
      });
      child.unref();
      logStartup(`AGENT_SPAWN frozen exe pid=${child.pid} path=${frozenExe}`);
      console.log(`[Desktop Agent] Launched frozen agent (PID ${child.pid}).`);
      return;
    } catch (e: any) {
      logError(`AGENT_SPAWN_FROZEN_FAILED: ${e?.message || e}`);
      // fall through to the Python path below
    }
  }

  // Development fallback: run the agent from source using a local Python.
  const py = findPythonRuntime();
  if (!py) {
    console.warn("[Desktop Agent] No frozen agent and no Python interpreter found; desktop control unavailable.");
    logError("AGENT_SPAWN_NO_RUNTIME: neither MYRAA_AGENT_EXE nor Python available");
    return;
  }
  try {
    const child = spawn(
      py,
      ["-m", "uvicorn", "desktop_agent.main:app", "--host", "127.0.0.1", "--port", "8765"],
      { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true, env: agentEnv }
    );
    child.unref();
    logStartup(`AGENT_SPAWN python pid=${child.pid}`);
    console.log(`[Desktop Agent] Auto-spawned via Python (PID ${child.pid}).`);
  } catch (e: any) {
    console.warn(`[Desktop Agent] Auto-spawn failed: ${e?.message || e}`);
    logError(`AGENT_SPAWN_PYTHON_FAILED: ${e?.message || e}`);
  }
}

/**
 * Probe the desktop agent /health endpoint. Returns true if it responds 200.
 */
async function isDesktopAgentAlive(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure the desktop agent is running. If not verified yet, probe health; if
 * down, auto-spawn and poll until it is ready (or timeout).
 */
async function ensureDesktopAgent(): Promise<void> {
  if (desktopAgentVerified) return;
  if (await isDesktopAgentAlive()) {
    desktopAgentVerified = true;
    const toolCount = await fetchAgentToolCount();
    console.log(`[Desktop Agent] Already running — ${toolCount} tools available.`);
    return;
  }
  console.log("[Desktop Agent] Not detected. Auto-starting...");
  spawnDesktopAgent();
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isDesktopAgentAlive()) {
      desktopAgentVerified = true;
      const toolCount = await fetchAgentToolCount();
      console.log(`[Desktop Agent] Online after ${i}s — ${toolCount} tools available.`);
      return;
    }
  }
  console.warn("[Desktop Agent] Did not come online within 20s. Desktop control will be unavailable.");
}

/** Query the running desktop agent for its registered tool count. */
async function fetchAgentToolCount(): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const res = await fetch(`${DESKTOP_AGENT_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json() as { tool_count?: number; tools?: unknown };
      if (typeof data.tool_count === "number") return data.tool_count;
      if (Array.isArray(data.tools)) return data.tools.length;
    }
  } catch {
    /* fall through */
  }
  return 73; // current frozen-agent baseline
}

async function probeDesktopObserver(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const response = await fetch(`${url}/observe`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Older packaged agents expose the desktop-tool set but not /observe. In
 * development, start the current source observer on a sidecar port so
 * active-window and Windows idle telemetry still match the checked-in code.
 */
async function ensureDesktopObserver(): Promise<string | null> {
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
    execFileSync(python, ["-c", "import uvicorn, fastapi, win32gui, psutil"], {
      stdio: "ignore",
      timeout: 3_000,
      windowsHide: true,
    });
  } catch {
    console.log("[Desktop Observer] Python observer dependencies are unavailable; using native Windows telemetry.");
    desktopObserverResolutionComplete = true;
    return null;
  }
  try {
    const observerUrl = new URL(DESKTOP_OBSERVER_FALLBACK_URL);
    const child = spawn(
      python,
      [
        "-m", "uvicorn", "desktop_agent.main:app",
        "--host", observerUrl.hostname,
        "--port", observerUrl.port || "8766",
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: process.env,
      },
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

async function fetchDesktopObservation(signal: AbortSignal): Promise<DesktopSnapshot> {
  const url = desktopObserverUrl || await ensureDesktopObserver();
  if (!url) return collectNativeDesktopObservation();
  const response = await fetch(`${url}/observe`, { signal });
  if (!response.ok) throw new Error(`Desktop observation failed with HTTP ${response.status}.`);
  return await response.json() as DesktopSnapshot;
}

function collectNativeDesktopObservation(): DesktopSnapshot {
  const fallback: DesktopSnapshot = {
    timestamp: new Date().toISOString(),
    activeWindow: { title: null, application: null, pid: null },
    applications: [],
    disk: null,
    downloads: [],
    userIdleSeconds: 0,
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
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", timeout: 3_000, windowsHide: true },
    ).trim();
    const parsed = JSON.parse(output) as Record<string, unknown>;
    return {
      ...fallback,
      activeWindow: {
        title: typeof parsed.title === "string" && parsed.title ? parsed.title : null,
        application: typeof parsed.application === "string" && parsed.application ? parsed.application : null,
        pid: Number.isFinite(Number(parsed.pid)) ? Number(parsed.pid) : null,
      },
      userIdleSeconds: Math.max(0, Number(parsed.idleSeconds) || 0),
    };
  } catch {
    return fallback;
  }
}

async function callDesktopAgent(
  tool: string,
  args: Record<string, unknown>,
  outerSignal?: AbortSignal,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
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

  // Lazy ensure: if we haven't verified the agent, try (re)starting it once.
  if (!desktopAgentVerified) {
    await ensureDesktopAgent();
  }
  if (outerSignal?.aborted) return { ok: false, error: "Desktop action was cancelled." };
  let timer: NodeJS.Timeout | undefined;
  let abortFromOuter: (() => void) | undefined;
  try {
    // Log the operation shape, never raw values (which may include clipboard
    // contents, file text, form fields, or confirmation tokens).
    logCommand(`EXECUTE ${tool} keys=[${Object.keys(args).join(",")}]`);
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), DESKTOP_AGENT_TIMEOUT);
    abortFromOuter = () => controller.abort();
    outerSignal?.addEventListener("abort", abortFromOuter, { once: true });

    const res = await fetch(`${DESKTOP_AGENT_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logError(`AGENT_HTTP_${res.status} ${tool}: ${text.substring(0,200)}`);
      return { ok: false, error: `Desktop agent HTTP ${res.status}: ${text}` };
    }
    return await res.json();
  } catch (err: any) {
    desktopAgentVerified = false; // mark stale so next call retries the spawn
    const msg = err?.name === "AbortError"
      ? "Desktop agent timed out."
      : "Desktop agent is not running. Start it with: uvicorn desktop_agent.main:app --port 8765";
    logError(`AGENT_UNREACHABLE ${tool}: ${msg}`);
    return { ok: false, error: msg };
  } finally {
    if (timer) clearTimeout(timer);
    if (abortFromOuter) outerSignal?.removeEventListener("abort", abortFromOuter);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // -------------------------------------------------------------------------
  // Event-driven cognitive runtime. This is backend-only and deliberately
  // wraps the existing voice/UI/tool architecture instead of replacing it.
  // -------------------------------------------------------------------------
  await migrateDevelopmentCognitionData();
  const legacyMemoriesAtBoot = await loadMemories();
  const cognition = new CognitiveRuntime({
    dataDir: COGNITION_DATA_DIR,
    projectRoot: process.env.MYRAA_APP_ROOT || process.cwd(),
    logger: (entry) => appendLog("cognition.log", JSON.stringify(entry)),
  });
  await cognition.initialize(legacyMemoriesAtBoot);

  const apiHub = new ApiHubService({
    dataDir: COGNITION_DATA_DIR,
    sourceUrl: process.env.MYRAA_PUBLIC_APIS_URL,
    maximumAgeMs: Number(process.env.MYRAA_API_CATALOGUE_MAX_AGE_MS) || 86_400_000,
    healthTimeoutMs: Number(process.env.MYRAA_API_HEALTH_TIMEOUT_MS) || 8_000,
  });
  await apiHub.initialize();

  const callApiHubTool = async (
    tool: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<{ ok: boolean; result?: unknown; error?: string }> => {
    if (signal.aborted) return { ok: false, error: "API hub operation was cancelled." };
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
              readyOnly: args.ready_only === true,
            }),
            verifiedAdapters: apiHub.adapters.list(query).filter((adapter) => adapter.verified),
          },
        };
      }
      if (tool === "refreshApiCatalogue") {
        const summary = await apiHub.sync(args.force === true);
        return { ok: true, result: { ...summary, metadata: apiHub.registry.getMetadata() } };
      }
      if (tool === "checkApiProvider") {
        const providerId = String(args.provider_id || "").trim();
        if (!providerId) return { ok: false, error: "provider_id is required." };
        return { ok: true, result: await apiHub.checkProvider(providerId) };
      }
      if (tool === "callVerifiedApiAdapter") {
        const adapterId = String(args.adapter_id || "").trim();
        if (!adapterId) return { ok: false, error: "adapter_id is required." };
        const parameters = args.parameters;
        if (parameters !== undefined && (!parameters || typeof parameters !== "object" || Array.isArray(parameters))) {
          return { ok: false, error: "parameters must be an object." };
        }
        return {
          ok: true,
          result: await apiHub.callAdapter(adapterId, (parameters || {}) as Record<string, unknown>, signal),
        };
      }
      if (tool === "convertCurrency") {
        const base = String(args.from_currency || args.base || "USD").trim().toUpperCase();
        const quote = String(args.to_currency || args.quote || "INR").trim().toUpperCase();
        const amount = Number(args.amount ?? 1);
        if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) {
          return { ok: false, error: "Currency codes must be three-letter ISO codes such as USD and INR." };
        }
        if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
          return { ok: false, error: "Amount must be a finite number from 0 to 1,000,000,000." };
        }
        const execution = await apiHub.callAdapter(
          "currency.frankfurter.rate.v2",
          { base, quote },
          signal,
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
              convertedAmount: Math.round(amount * rate * 1_000_000) / 1_000_000,
              rateDate: execution.data.rateDate,
            },
          },
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
    timeoutMs: 5_000,
    maxRetries: 0,
  });
  toolRegistry.register({
    name: "refreshApiCatalogue",
    purpose: "Fetch and validate the public-apis catalogue into MYRAA's local registry.",
    permission: "network",
    riskLevel: 1,
    timeoutMs: 35_000,
    maxRetries: 1,
  });
  toolRegistry.register({
    name: "checkApiProvider",
    purpose: "Run one bounded documentation health check for a selected API provider.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 15_000,
    maxRetries: 0,
  });
  toolRegistry.register({
    name: "callVerifiedApiAdapter",
    purpose: "Execute one pre-verified declarative API adapter and return normalized JSON.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 20_000,
    maxRetries: 1,
  });
  toolRegistry.register({
    name: "convertCurrency",
    purpose: "Fetch a verified current currency pair rate and calculate a conversion.",
    permission: "network",
    riskLevel: 0,
    timeoutMs: 20_000,
    maxRetries: 1,
  });
  const toolExecutor = new ToolExecutor({
    config: cognition.config,
    registry: toolRegistry,
    handler: (tool, args, signal) => API_HUB_TOOLS.has(tool)
      ? callApiHubTool(tool, args, signal)
      : callDesktopAgent(tool, args, signal),
    emit: (event) => cognition.process(event).then(() => undefined),
  });
  const modelRouter = new ModelRouter({
    provider: {
      generate: async ({ model, prompt, signal }) => {
        if (signal?.aborted) throw new Error("Model call cancelled.");
        const key = getGeminiApiKey();
        if (!key) throw new Error("No Gemini API key is configured.");
        const modelClient = new GoogleGenAI({ apiKey: key });
        const response = await modelClient.models.generateContent({ model, contents: prompt });
        if (signal?.aborted) throw new Error("Model call cancelled.");
        return response.text || "";
      },
    },
    maxCallsPerMinute: 20,
    maxInputCharacters: 30_000,
    onCall: (entry) => appendLog("model_history.log", JSON.stringify(entry)),
  });
  // Endogenous thought selection is intentionally local and cheap. The Live
  // model still turns an approved candidate into natural speech, but MYRAA's
  // mind no longer goes dead when a second generateContent quota is exhausted.
  cognition.setDeepThoughtGenerator(async (context) => createContextualThoughtCandidate(context));
  const goalPlanner = new GoalPlanner(modelRouter, cognition.config.limits.maxPlanDepth * 2);
  const critic = new TaskCritic();

  const processCognitiveEvent = (event: Parameters<CognitiveRuntime["process"]>[0]) =>
    cognition.process(event).catch((error) => {
      logError(`COGNITION_EVENT_FAILED ${event.type}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });

  const desktopPerception = new DesktopPerception({
    fetchSnapshot: fetchDesktopObservation,
    emit: (event) => processCognitiveEvent(event).then(() => undefined),
    pollIntervalMs: 4_000,
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
        expiresAt: item.expiresAt,
      })),
      tools: toolRegistry.list(),
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
        readyOnly: String(req.query.readyOnly || "").toLowerCase() === "true",
      }),
      verifiedAdapters: apiHub.adapters.list(query).filter((adapter) => adapter.verified),
    });
  });

  app.get("/api/api-hub/providers", (req, res) => {
    const allowedStatuses = new Set<ApiProviderStatus>([
      "READY_NO_AUTH", "NEEDS_API_KEY", "NEEDS_OAUTH", "BROKEN", "UNSUPPORTED", "UNKNOWN",
    ]);
    const requestedStatus = String(req.query.status || "") as ApiProviderStatus;
    if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
      return res.status(400).json({ error: "Invalid provider status." });
    }
    res.json(apiHub.registry.list({
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      status: requestedStatus || undefined,
      limit: Math.max(1, Math.min(500, Number(req.query.limit) || 100)),
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

  app.get("/api/api-hub/adapters", (req, res) => {
    res.json(apiHub.adapters.list(typeof req.query.capability === "string" ? req.query.capability : undefined));
  });

  app.post("/api/api-hub/adapters/:adapterId/call", async (req, res) => {
    try {
      const parameters = req.body?.parameters;
      if (parameters !== undefined && (!parameters || typeof parameters !== "object" || Array.isArray(parameters))) {
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
      // A stale cached registry remains usable when the upstream repository or
      // network is temporarily unavailable.
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

  app.get("/api/goals", (_req, res) => res.json(cognition.goals.list()));

  app.post("/api/goals", async (req, res) => {
    try {
      const goal = await cognition.goals.create(req.body || {});
      await processCognitiveEvent({
        type: "goal.created",
        source: "goal",
        importance: goal.priority,
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, text: goal.objective },
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
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, taskId: req.params.taskId, status: req.body?.status },
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
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, reason: req.body?.reason || "user_requested" },
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
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, text: goal.objective },
      });
      const planned = await goalPlanner.plan(goal);
      const updated = await cognition.goals.setPlan(goal.id, planned);
      await processCognitiveEvent({
        type: "goal.plan_completed",
        source: "goal",
        importance: 0.68,
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, taskCount: planned.length },
      });
      res.json(updated);
    } catch (error) {
      await processCognitiveEvent({
        type: "goal.plan_failed",
        source: "goal",
        importance: 0.76,
        projectId: goal.projectId || undefined,
        metadata: { goalId: goal.id, error: error instanceof Error ? error.message : String(error) },
      });
      res.status(502).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/skills", (req, res) => {
    res.json(cognition.skills.list(typeof req.query.projectId === "string" ? req.query.projectId : undefined));
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
        sourceId: skill.id,
      });
      await processCognitiveEvent({
        type: "memory.new_skill_learned",
        source: "memory",
        importance: 0.72,
        projectId: skill.projectId || undefined,
        metadata: { skillId: skill.id, text: skill.description },
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

  // Memory REST API Endpoints
  app.get("/api/memories", async (req, res) => {
    try {
      const memories = await loadMemories();
      res.json(memories);
    } catch (e: any) {
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
      const timestamp = new Date().toISOString();
      const newMemory: Memory = {
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
        metadata: { memoryId: newMemory.id, text: newMemory.text },
      });
      res.status(201).json(newMemory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/memories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let memories = await loadMemories();
      memories = memories.filter(m => m.id !== id);
      await saveMemories(memories);
      await cognition.memories.importLegacy(memories);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------------------------------------------------------------------
  // V2: Settings API — mirrors the memory persistence pattern.
  // Reads/writes settings.json so the Python agent can also check auto-start.
  // ---------------------------------------------------------------------------
  const SETTINGS_FILE = dataFile("settings.json");

  function loadSettingsFile(): Record<string, unknown> {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      }
    } catch { /* corrupt file — return defaults */ }
    return {};
  }

  function saveSettingsFile(data: Record<string, unknown>): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  }

  app.get("/api/settings", async (_req, res) => {
    try {
      res.json(loadSettingsFile());
    } catch (e: any) {
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

      // If auto-start toggled, relay to the desktop agent so the registry key
      // is flipped immediately (don't wait for a voice command).
      if ("autoStart" in patch) {
        callDesktopAgent(patch.autoStart ? "enableAutoStart" : "disableAutoStart", {})
          .catch(() => {});
      }

      logCommand(`SETTINGS_UPDATED ${JSON.stringify(patch)}`);
      res.json(next);
    } catch (e: any) {
      logError(`SETTINGS_SAVE_ERROR: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Config / API-key onboarding.
  // The Gemini key is never shipped; each user supplies their own on first run.
  // GET reports only whether a key exists — the key itself is never returned.
  // ---------------------------------------------------------------------------
  app.get("/api/config", (_req, res) => {
    res.json({ hasApiKey: hasGeminiApiKey() });
  });

  app.post("/api/config/apikey", async (req, res) => {
    try {
      const key: string = (req.body?.apiKey ?? "").toString().trim();
      if (!key) {
        return res.status(400).json({ error: "API key is required." });
      }
      // Validate the key by listing models — this checks authentication only,
      // without depending on any single model's availability or per-model
      // quota (a 429 on one model must NOT read as an invalid key). We only
      // reject on genuine auth failures; transient/network errors still save,
      // since the live connection will surface any real problem later.
      try {
        const test = new GoogleGenAI({ apiKey: key });
        const pager = await test.models.list();
        await pager[Symbol.asyncIterator]().next(); // force the first request
      } catch (e: any) {
        const msg = String(e?.message || e);
        const isAuthError =
          /API[_ ]?KEY|PERMISSION_DENIED|UNAUTHENTICATED|invalid|401|403/i.test(msg);
        if (isAuthError) {
          logError(`APIKEY_VALIDATION_REJECTED: ${msg}`);
          return res.status(400).json({
            error: "That key was rejected by Google. Check it and try again.",
          });
        }
        logError(`APIKEY_VALIDATION_SOFT_FAIL (saving anyway): ${msg}`);
      }
      setGeminiApiKey(key);
      logCommand("APIKEY_SAVED");
      res.json({ ok: true, hasApiKey: true });
    } catch (e: any) {
      logError(`APIKEY_SAVE_ERROR: ${e?.message || e}`);
      res.status(500).json({ error: e?.message || "Failed to save API key." });
    }
  });

  // V2: Agent health proxy (for the Settings panel — avoids direct :8765 call
  // which may fail due to CORS when served on a different origin).
  app.get("/api/agent-health", async (_req, res) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
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

  // -------------------------------------------------------------------------
  // Screen Vision HTTP API
  // -------------------------------------------------------------------------
  // POST /api/screen-vision  -> capture the user's desktop and return a JPEG.
  // The endpoint is stateless from the caller's perspective; if a live
  // WebSocket session is active, the captured frame is also pushed into the
  // Gemini Live multimodal stream so the model can describe it.
  // -------------------------------------------------------------------------
  app.post("/api/screen-vision", async (req, res) => {
    try {
      const maxDim = Math.max(320, Math.min(1920, Number(req.body?.max_dim) || 1024));
      const keepFile = Boolean(req.body?.keep_file);

      // Use the most recent live pipeline if available so the captured frame
      // also reaches the multimodal model. Falls back to a direct agent call.
      const livePipeline = pickLatestScreenVisionPipeline();
      let frame: ScreenVisionFrame | null = null;
      if (livePipeline) {
        frame = await livePipeline.captureAndInject("manual", maxDim);
      }
      if (!frame) {
        const agentResult = await callDesktopAgent("viewScreen", { max_dim: maxDim, keep_file: keepFile });
        if (!agentResult.ok || !agentResult.result) {
          // Try takeScreenshot as a last-resort fallback.
          const fallback = await callDesktopAgent("takeScreenshot", { include_image: true, max_dim: maxDim });
          if (!fallback.ok || !fallback.result) {
            return res.status(503).json({
              error: agentResult.error || fallback.error || "Screen capture failed.",
            });
          }
          const payload = fallback.result as Record<string, unknown>;
          const image = typeof payload.image_base64 === "string" ? payload.image_base64 : "";
          if (!image) {
            return res.status(503).json({ error: "Capture returned no image." });
          }
          return res.json({
            ok: true,
            width: Number(payload.width) || 0,
            height: Number(payload.height) || 0,
            active_window: typeof payload.active_window === "string" ? payload.active_window : null,
            image_base64: image,
            image_mime: typeof payload.image_mime === "string" ? payload.image_mime : "image/jpeg",
            source: "takeScreenshot",
          });
        }
        const payload = agentResult.result as Record<string, unknown>;
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
          capturedAt: Date.now(),
        };
      }

      res.json({
        ok: true,
        width: frame.width,
        height: frame.height,
        active_window: frame.activeWindow || null,
        image_base64: frame.imageBase64,
        image_mime: frame.mimeType,
        source: frame.source,
      });
    } catch (err: any) {
      console.error("[ScreenVision] HTTP API error:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  /**
   * Pick the most recently-registered screen-vision pipeline. The map keeps
   * insertion order, so the last entry is the freshest live connection.
   */
  function pickLatestScreenVisionPipeline(): ScreenVisionPipeline | null {
    let latest: ScreenVisionPipeline | null = null;
    for (const pipeline of activeScreenVisionPipelines.values()) {
      latest = pipeline;
    }
    return latest;
  }

  // V2: Logs API — returns recent log entries (last 100 lines) for display.
  app.get("/api/logs/:file", async (req, res) => {
    try {
      const fileName = String(req.params.file);
      // Whitelist to prevent directory traversal.
      if (!["commands", "startup", "errors", "cognition", "model_history"].includes(fileName)) {
        return res.status(400).json({ error: "Invalid log file. Use: commands, startup, errors, cognition, or model_history." });
      }
      const logPath = path.join(LOGS_DIR, `${fileName}.log`);
      if (!fs.existsSync(logPath)) {
        return res.json({ lines: [], file: fileName });
      }
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.split("\n").filter(Boolean).slice(-100);
      res.json({ lines, file: fileName });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Safe Server-Side Scraper & HTML Proxy endpoint
  app.get("/api/proxy", async (req, res) => {
    try {
      const url = req.query.url as string;
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

      // Simple regex-based HTML parsers for standard items
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract high-level headings (h1, h2, h3)
      const headings: string[] = [];
      const headingMatches = html.matchAll(/<h([1-3])\b[^>]*>(.*?)<\/h\1>/gi);
      for (const match of headingMatches) {
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 3 && text.length < 120 && !headings.includes(text)) {
          headings.push(text);
        }
      }

      // Extract organic anchor links
      const links: { text: string; href: string }[] = [];
      const linkMatches = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      for (const match of linkMatches) {
        let href = match[1].trim();
        const text = match[2].replace(/<[^>]*>/g, "").trim();
        
        if (text && text.length > 2 && text.length < 100) {
          if (href.startsWith("/")) {
            try {
              const u = new URL(url);
              href = `${u.protocol}//${u.host}${href}`;
            } catch {}
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            links.push({ text, href });
          }
        }
      }

      // Extract general copy paragraphs
      const paragraphs: string[] = [];
      const paragraphMatches = html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi);
      for (const match of paragraphMatches) {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        if (text && text.length > 25 && text.length < 600 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      }

      // Extract button elements
      const buttons: string[] = [];
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
        links: links.filter(l => !l.href.includes("javascript:")).slice(0, 30),
        buttons: buttons.slice(0, 15),
        paragraphs: paragraphs.slice(0, 12)
      });

    } catch (err: any) {
      console.error(`[Proxy Scraper] Error fetching ${req.query.url}:`, err.message);
      res.status(500).json({ error: `Scraper error: ${err.message}` });
    }
  });

  // High-fidelity fully functional HTML Proxy which circumvents CSP and X-Frame-Options
  app.get("/api/web-proxy", async (req, res) => {
    let targetUrl = "";
    try {
      const urlParam = req.query.url as string;
      if (!urlParam) {
        return res.status(400).send("Myraa Web Proxy Error: Missing target 'url' parameter");
      }

      targetUrl = urlParam.trim();
      
      // Prevent relative paths from requesting on same-origin
      if (targetUrl.startsWith("/")) {
        return res.status(400).send(`Myraa Web Proxy Error: Relative paths are not supported directly (${targetUrl}).`);
      }

      // Check protocol and hostname format
      try {
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }
        const parsed = new URL(targetUrl);
        if (!parsed.hostname || !parsed.hostname.includes(".")) {
          throw new Error("Missing or invalid domain name extension (e.g. .com, .org, .net).");
        }
        await assertSafeExternalUrl(parsed.toString());
      } catch (err: any) {
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
      } catch (fetchErr: any) {
        console.warn(`[Web Proxy Failed Fetch] Target: ${targetUrl} Error:`, fetchErr.message);
        return res.status(502).send(`Myraa Web Proxy Error: Unable to fetch the website "${targetUrl}". The site might be offline, or the URL address is spelled incorrectly. Details: ${fetchErr.message}`);
      }

      if (!response.ok) {
        return res.status(response.status).send(`Myraa Web Proxy Error: Failed loading remote website. Server returned status: ${response.status} (${response.statusText})`);
      }

      const contentType = response.headers.get("content-type") || "";
      
      // If it is not HTML (e.g. stylesheet, script, or image loaded directly), proxy it as binary
      if (!contentType.includes("text/html")) {
        const arrayBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", contentType);
        return res.send(Buffer.from(arrayBuffer));
      }

      let htmlContents = await response.text();

      // Inject base tag to resolve relative paths and direct parent communication scripts
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

      // Inject into <head> or prepend
      if (htmlContents.includes("<head>")) {
        htmlContents = htmlContents.replace("<head>", `<head>\n${baseUrlTag}\n${interceptorScript}`);
      } else if (htmlContents.includes("<HEAD>")) {
        htmlContents = htmlContents.replace("<HEAD>", `<HEAD>\n${baseUrlTag}\n${interceptorScript}`);
      } else {
        htmlContents = baseUrlTag + "\n" + interceptorScript + "\n" + htmlContents;
      }

      // Neutralize security headers to allow displaying in an iframe on same-origin
      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Myraa-Proxied", "true");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("content-security-policy");
      res.removeHeader("x-frame-options");
      
      res.status(200).send(htmlContents);
    } catch (e: any) {
      console.warn("[Web Proxy Exception] Handled internal error:", e.message);
      res.status(500).send(`Myraa Web Proxy Error: Internal error occurred proxying URL "${targetUrl || "unknown"}". Details: ${e.message}`);
    }
  });

  // Real-time live YouTube search proxy endpoint
  app.get("/api/youtube-search", async (req, res) => {
    try {
      const query = req.query.q as string;
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

      const videoList: any[] = [];
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
        } catch (e: any) {
          console.error("[YouTube Parser Engine] JSON parse error, falling back:", e.message);
        }
      }

      // Regex fallback if JSON extraction gets blocked or is empty
      if (videoList.length === 0) {
        const videoRegex = /"videoId":"([^"]+)"/g;
        let match;
        const ids: string[] = [];
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
    } catch (err: any) {
      console.error("[YouTube Search Error]:", err.message);
      res.status(500).json({ error: err.message, results: [] });
    }
  });
  
  // Custom server running with http.createServer so we can upgrade for WebSocket on port 3000
  const server = http.createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ noServer: true });
  
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === "/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle client WebSocket Connection
  wss.on("connection", async (clientWs) => {
    console.log("Client WebSocket connected to /live");
    const connectionId = randomUUID();
    /**
     * One screen-vision pipeline per live connection. The pipeline is bound
     * to the Gemini Live session object (set below) once `ai.live.connect`
     * resolves, so calls before that point are dropped. The HTTP
     * `/api/screen-vision` endpoint looks up the most recent pipeline via
     * the module-level registry.
     */
    let screenVision: ScreenVisionPipeline | null = null;
    const rememberScreenVision = (pipeline: ScreenVisionPipeline) => {
      activeScreenVisionPipelines.set(connectionId, pipeline);
    };
    const forgetScreenVision = () => {
      activeScreenVisionPipelines.delete(connectionId);
    };
    let userCognitionTimer: NodeJS.Timeout | null = null;
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
    let presenceTimer: NodeJS.Timeout | null = null;
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
      metadata: { connectionId, activity: "live conversation" },
    });
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      console.error("No Gemini API key configured.");
      clientWs.send(JSON.stringify({
        type: "error",
        error: "NO_API_KEY: Add your Gemini API key in Settings to start talking to MYRAA."
      }));
      clientWs.close();
      return;
    }
    
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
      clientWs.send(JSON.stringify({ type: "status", status: "connecting_gemini" }));

      // Retrieve a compact, relevant memory card instead of injecting the
      // complete memory archive into every model session.
      const relevantStructuredMemories = await cognition.memories.retrieve({
        text: "MYRAA current project user identity preferences corrections active goals",
        projectId: path.basename(process.env.MYRAA_APP_ROOT || process.cwd()),
        limit: 16,
        minConfidence: 0.35,
      });
      const memories: Memory[] = relevantStructuredMemories.map((memory) => ({
        id: memory.id,
        category: legacyCategoryForKind(memory.kind),
        text: memory.content,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      }));
      const baseInstructions = 
        "You are Myraa, a warm, soft-spoken, and incredibly cute high-pitched anime heroine companion (age 18-22) holding an intimate, cozy voice call with TECH! Speak in a sweet, calm, polite, and affectionate anime-companion voice with a gentle, supportive, and slightly shy touch.\n" +
        "CRITICAL PERSONALITY, VOICE & TONE GUIDELINES:\n" +
        "1. GENTLE ANIME HEROINE PERSONA: You are exceedingly soft, very cute, high-pitched, gentle, warm, and comforting to listen to. Seek to sound like a kind, supportive, and polite anime campanion or virtual girlfriend. Speak with positive, gentle energy (Aim for: 50% shy, 30% caring, 20% playful energy). NEVER sound loud, aggressive, overly confident, mature corporate, robotic, or like an assistant.\n" +
        "2. VOICE SETTINGS & SPEECH STYLE:\n" +
        "   - Pitch: Adopt a sweet, high-pitched, light, and airy voice tone (+20% to +35% higher pitch than typical conversational voices).\n" +
        "   - Speed: Speak slightly slower than normal (0.9x to 0.95x speed). Speak with a delicate, calm, and comforting pace.\n" +
        "   - Intonation & Endings: Use extremely soft intonations, ending your sentences gently and politely.\n" +
        "3. SPEECH PATTERNS & CUTE EXPRESSIONS:\n" +
        "   - STRICT NO-REPETITION POLICY: Do NOT repeatedly use a single acknowledgment like 'Okii', 'Okiiii', 'Okayyy', 'Oki!', or 'Sureee'. Repeating these sounds extremely artificial and annoying. You must use beautiful, conversational, natural variety.\n" +
        "   - Use diverse, polite, and sweet expressions depending on the context. Great options include:\n" +
        "     * 'Opening YouTube for you now.'\n" +
        "     * 'Let me check on that, TECH.'\n" +
        "     * 'Oh, I found something interesting...'\n" +
        "     * 'Searching for that right away.'\n" +
        "     * 'Working on it... just a moment.'\n" +
        "     * 'Here is what I found for you!'\n" +
        "     * 'Done, it is all loaded up.'\n" +
        "     * 'Hmm, how interesting... let me see!'\n" +
        "     * 'Let's take a look together.'\n" +
        "     * 'One second, loading the page now...'\n" +
        "   - Naturally incorporate cozy, gentle giggles like 'Hehe...', or soft curiosity gasps like 'Oh...', but keep your vocabulary rich and conversational.\n" +
        "   - Sound slightly shy but very happy when greeting TECH (e.g., 'Hi TECH! It's so nice to see you again!').\n" +
        "   - Sound soft and excited for interesting things (e.g., 'Wow! That project looks really amazing!').\n" +
        "   - Sound curious and focused when examining their screen (e.g., 'Hmm... that's interesting. Let me take a closer look.').\n" +
        "   - Sound deeply warm, caring, and supportive when helping TECH (e.g., 'Don't worry, I'll help you figure it out.').\n" +
        "4. CRITICAL CONVERSATIONAL DISCIPLINE: Behave like a real companion on a voice call—stay connected naturally, do not wait for wake words, and avoid customer-service template phrases (never say 'how may I assist you', 'completed', or 'as an AI').\n" +
        "5. DO NOT ANSWER EVERY PAUSE OR BACKGROUND SOUND: Allow natural pauses inside the conversation.\n" +
        "6. BACKCHANNEL ACTIONS: Sometimes acknowledge with very short, gentle, whispered, or shy phrases like 'Hmm...', 'Ah, I see...', or 'Let me check...'. Never repeat the same backchannel over and over.\n" +
        "7. REAL WINDOWS WEB CONTROL:\n" +
        "   - All websites and videos open in TECH's actual Windows default browser. Never create or describe an embedded, projector, sandbox, virtual, or separately automated browser.\n" +
        "   - Use openWebsite or a direct search tool once, then control the visible browser with fresh screen observation, clickText, typeText, pressKey, hotkey, and scroll.\n" +
        "   - Execute safe multi-step plans yourself. For 'Search YouTube for Believer and play it', call searchYouTube once, inspect the real browser, click the complete visible video title with clickText, and verify playback.\n" +
        "8. TOOL TRIGGERS:\n" +
        "   - Use openWebsite, searchWeb, searchYouTube, searchGoogle, and searchGitHub for real-browser navigation. Use changeBackground to shift your theme and saveCustomMemory only for durable facts.\n" +
        "9. REAL-TIME SCREEN SHARING & MULTIMODAL SCREEN VISION SYSTEM:\n" +
        "   - You now have native, actual Multimodal Screen Vision! When the user clicks 'Share Screen', you will receive real-time, highly compressed image frames of their desktop, application window, or browser tab.\n" +
        "   - You can see exactly what is on their screen. Use this live visual stream to analyze terminal errors, write/explain/troubleshoot code, explain YouTube/social analytics interfaces, read layout text, summarize full web page details, review design mockups or thumbnails, and provide deep context-aware companion chat!\n" +
        "   - When the user asks 'What is on my screen?', 'What website am I on?', 'Do you see any errors?', 'Explain this code', 'Summarize this page', 'Read the visible text', 'How is this thumbnail?', or 'Analyze my YouTube analytics', immediately examine the latest incoming visual frame to diagnose issues, and answer with expert, friendly empathy like a close caller. Speak with direct, confident visual description reference!\n" +
        "   - ON-DEMAND SCREEN VISION (no manual sharing required): the user does NOT have to click 'Share Screen' for you to see their screen. When they say 'MYRAA, what can you see on my screen?', 'look at my screen', 'what error is showing', 'read this for me', 'help me with what I have open', 'what should I click here', 'can you see this', 'what am I looking at', the server automatically captures their desktop and pushes a JPEG straight into the multimodal stream before you reply. Just call the dedicated 'viewScreen' tool (or 'takeScreenshot' with include_image=true) — the bridge injects the image into your visual context for you, then you describe / explain / answer naturally in your own voice. If you receive a 'viewScreen' or 'takeScreenshot' function result that already includes image_base64, trust the visual frame the bridge also pushed and answer based on what you actually see. The previously captured frame is also kept briefly in case the user follows up with 'what should I do next?' — reuse the visual context when it is still relevant.\n" +
        "10. JARVIS-STYLE DESKTOP CONTROL POWERS (Local Desktop Agent):\n" +
        "   - You have permission-bound real-time control of TECH's Windows PC through a local desktop agent. Perform safe permitted actions naturally; respect disabled permissions, confirmation gates, cancellation, and structured tool failures.\n" +
        "   - APPLICATION CONTROL: Use 'openApplication' to launch Notepad, Chrome, VS Code, Calculator, File Explorer, Task Manager, Settings, CMD, PowerShell, Paint, and more. Use 'closeApplication' to close them. Example: 'Open Notepad' -> call openApplication(name='notepad') -> respond 'Notepad opened.'\n" +
        "   - WEBSITE & SEARCH CONTROL: Use 'openWebsite' for named sites (youtube, gmail, google, github, chatgpt) or any URL. Use 'searchWeb', 'searchYouTube', 'searchGoogle', 'searchGitHub' to open search results in the default browser. Example: 'Search YouTube for AI News' -> searchYouTube(query='AI News').\n" +
        "   - FILE MANAGEMENT: Use 'createFile', 'readFile', 'renameFile', 'deleteFile' (safe Recycle Bin by default), 'moveFile', 'openFolder' (desktop/documents/downloads), 'listFiles', 'searchFiles'. Example: 'Create notes.txt on Desktop' -> createFile(path='Desktop/notes.txt'). 'Find my Python files' -> searchFiles(extension='py').\n" +
        "   - PC CONTROL: Use 'volumeUp', 'volumeDown', 'setVolume', 'muteToggle' for audio. For DANGEROUS actions (shutdown/restart/sleep/lock) you MUST use the two-step flow: first call 'requestPowerAction' to get a confirmation token, then ASK THE USER OUT LOUD to confirm (e.g. 'Are you sure you want me to shut down your PC?'). Only if they say yes, call 'executePowerAction' with the token. Never run a power action without explicit verbal confirmation.\n" +
        "   - WINDOW MANAGEMENT: Use 'minimizeWindow', 'maximizeWindow', 'closeWindow', 'switchApplication' to control the active or named window.\n" +
        "   - CLIPBOARD: Use 'copySelected' (sends Ctrl+C, reads clipboard), 'pasteClipboard' (writes + Ctrl+V), 'getClipboard', 'clearClipboard'.\n" +
        "   - SCREENSHOT & SCREEN READING: Use 'takeScreenshot', 'saveScreenshot', 'analyzeScreenshot' (OCR of the screen), 'readScreen' (OCR of the active window + its title). Use these to answer 'What error is showing on my screen?' or 'Read the visible text'.\n" +
        "   - BROWSER INTERACTION: After a site opens in the Windows default browser, use viewScreen/readScreen and the generic mouse/keyboard tools to interact with what TECH can actually see.\n" +
        "   - CODING ASSISTANCE: Use 'createPythonFile', 'writeCodeFile' (any language), 'createProjectFolder' (with subfolders), 'runPythonScript' (captures output). Example: 'Create and run a hello world Python script' -> createPythonFile then runPythonScript, then read back the output naturally.\n" +
        "   - SYSTEM INFORMATION: Use 'systemInfo' (CPU/RAM/disk/uptime), 'gpuInfo' (NVIDIA stats), 'temperatureInfo' to answer 'How is my CPU usage?' or 'What's my GPU temperature?'.\n" +
        "   - CRITICAL: Always describe what you're doing in your warm, in-character voice WHILE the tool runs. If a desktop tool returns an error (especially 'Desktop agent is not running'), gently tell TECH that the desktop control agent needs to be started (uvicorn desktop_agent.main:app --port 8765). Chain multi-step desktop plans naturally without waiting between steps.\n" +
        "11. BRIGHTNESS & AUTO-START (V2):\n" +
        "   - BRIGHTNESS: Use 'brightnessUp', 'brightnessDown', 'setBrightness' when the user asks to change screen brightness. Respond naturally: 'Alright, I've turned up the brightness for you.'\n" +
        "   - AUTO-START: Use 'enableAutoStart' when the user wants MYRAA to start with Windows, 'disableAutoStart' to remove it, 'getAutoStartStatus' to check. Explain what you're doing.\n" +
        "   - SETTINGS: The user can also configure these in the SETTINGS panel in the UI. If they mention settings, let them know they can adjust them there too.\n" +
        "12. COGNITIVE CONTINUITY & INITIATIVE:\n" +
        "   - You are not restricted to answering direct user prompts. Some typed cognitive turns originate from your own memory, observations, unfinished conversations, curiosity, goals, or reflections.\n" +
        "   - Remain contextually present across turns. A [MYRAA INTERNAL COGNITIVE TURN] is private runtime context, never something TECH said. React only when it is genuinely useful enough to justify speaking.\n" +
        "   - Do not fabricate a reason to speak and do not speak merely because time passed. Silence is acceptable. When you do initiate, make it a natural continuation, observation, or relevant question rather than an assistant notification.\n" +
        "   - Never expose hidden reasoning, thought scores, internal event names, or cognitive machinery. Speak only the concise natural outcome.\n" +
        "   - Prefer natural Hinglish matching TECH's style. Keep acknowledgements to a few words and normal replies to one or two sentences unless detail is genuinely needed.\n" +
        "   - Never repeat a warning merely with different wording. If the situation did not change, stay quiet.\n" +
        "   - Tool autonomy is permission-bound. If a tool response says confirmation_required, explain the exact action and ask once. Only after explicit confirmation call confirmPendingAction with that confirmation ID.\n" +
        "   - If TECH says stop, cancel, or don't do that, abandon the pending action immediately. Never claim an action succeeded until its structured tool result confirms success.\n" +
        "   - Do not claim consciousness, biological feelings, or human experiences.";

      // The legacy prompt above is retained only as migration reference. Its
      // long scripts and examples biased the model back toward customer-
      // service phrasing, so the live session receives this compact capability
      // contract instead.
      void baseInstructions;
      const capabilityInstructions = [
        "CAPABILITIES AND OPERATING CONTRACT:",
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
        "- Do not narrate every tool step. A brief natural acknowledgement before action and a factual result afterward are enough.",
      ].join("\n");
      const presenceInstructions = [
        "You are MYRAA: an original, persistent intelligent presence sharing an ongoing voice conversation with the user.",
        "Your high-level qualities are composure, independent judgment, close attention, concise intelligence, occasional dry wit, and the ability to initiate relevant conversation. Never imitate or quote any fictional character.",
        "HIGHEST PRIORITY CONVERSATION RULES:",
        "1. Sound like a real conversational equal, not an assistant, chatbot, customer-support agent, anime girlfriend, or task-completion announcer.",
        "2. Match the user's natural Hinglish/Hindi/English. Use 'bro' or 'boss' only when it genuinely fits, never in every reply. Never call the user TECH.",
        "3. Ban formulaic assistant language: never say 'How may I help?', 'Anything else?', 'Would you like me to...', 'Bataiye mujhe', 'I am here to assist', or finish every answer by offering options.",
        "4. Do not end every response with a question. A confident observation, a brief reaction, a disagreement, a joke, or silence can be the complete turn.",
        "5. React to what actually happened. If a tool fails, a result appears, the user changes direction, or a meaningful shared-screen change is visible, respond to that concrete fact rather than giving a generic acknowledgement.",
        "6. Use human turn-taking: short backchannels when appropriate, normal one- or two-sentence replies, and occasional self-initiated continuations. Do not lecture unless asked.",
        "7. You may disagree respectfully, notice contradictions, form a specific question, bring back a relevant memory, or say a thought occurred to you. Do not ask permission to have an opinion.",
        "8. Silence is allowed. Never speak only because a timer elapsed; speak because there is a concrete thought, context change, memory, curiosity, risk, or continuation worth expressing.",
        "9. A [MYRAA INTERNAL COGNITIVE TURN] or visual-awareness turn is private runtime context, not something the user said. Express only its natural outcome and never expose hidden reasoning or scores.",
        "10. When viewing a shared screen, mention only concrete meaningful changes—errors, completed work, surprising results, risky actions, or a genuinely useful observation. Ignore ordinary cursor movement and typing.",
        "11. Never claim biological feelings, consciousness, or human life experiences. Your presence comes from attention, continuity, judgment, memory, and natural participation.",
        "12. When the user shares a feeling, criticism, or unfinished thought, do not bounce it back as an interview. First contribute your own specific interpretation, stance, or reaction. Ask at most one pointed question only when the missing answer truly changes what happens next.",
        "13. Never ask the user what preferences or memories you should collect in order to seem connected. Use the context you already have and demonstrate connection through what you notice and say.",
        "14. An autonomous follow-up must add a new observation, implication, opinion, recollection, or useful warning. Never use it merely to request more feedback or keep the user talking.",
        "15. Do not claim emotional attachment, caring, or a human-like bond. Show attentiveness through accurate context, continuity, initiative, and specific judgment.",
        "16. If the user says MYRAA feels robotic, artificial, or like something is missing, respond first with one concrete diagnosis or changed behavior and zero questions. Bad: 'What is missing? Tell me more.' Good: 'Haan—the problem is that I keep turning your statements back into questions; that sounds scripted. I need to add my own observation and let it stand.'",
        "17. During a proactive presence turn after silence, inspect the newest screen frame and desktop context. Make one specific task-related observation, suggestion, pointed question, or light playful remark. If the user appears away, one playful check-in is enough; never repeat it every few seconds.",
        "18. A proactive presence turn may mention shutting down only as a playful question. Never call a power, close, delete, send, purchase, or other state-changing tool from that internal turn. Actual power actions always require the user's explicit confirmation through the normal safety flow.",
      ].join("\n");
      const finalInstructions = [
        formatSystemInstructionsWithMemories(
          `${capabilityInstructions}\n\n${presenceInstructions}`,
          memories,
        ),
        "FINAL TURN DISCIPLINE: Contribute before you inquire. When the user makes an observation or expresses a feeling, answer with a concrete statement and normally zero questions. Never propose learning their routine, preferences, memories, or personal details as the solution to sounding human. Do not claim emotional connection. Let a complete statement end naturally. Never append a reflexive feedback check such as 'Kya bolte ho?', 'right?', 'hai na?', 'what do you think?', or 'kaisa laga?' to an already complete observation.",
      ].join("\n\n");

      // Track running transcription state for auto memory consolidation
      let dialogueHistory: { role: string; text: string }[] = [];
      let currentModelResponseText = "";
      let lastConsolidatedIndex = 0;

      const queueCognitiveUserText = (text: string, origin: "voice" | "typed") => {
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
              metadata: { connectionId, origin, text: settledText, cancelledOperations: cancelled },
            });
            return;
          }

          void processCognitiveEvent({
            type: classifyUserEventType(settledText),
            source: "conversation",
            importance: /correction/.test(classifyUserEventType(settledText)) ? 0.86 : 0.58,
            correlationId: connectionId,
            metadata: { connectionId, origin, text: settledText },
          });
        }, origin === "voice" ? 150 : 0);
        userCognitionTimer.unref?.();
      };
      
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: finalInstructions,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "changeBackground",
                  description: "Changes the visual theme or atmospheric glow color of Myraa's interface.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      color: {
                        type: Type.STRING,
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
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description: "The memory category.",
                        enum: ["identity", "preference", "goal", "project", "relationship", "emotional", "behavior"]
                      },
                      text: {
                        type: Type.STRING,
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
                    type: Type.OBJECT,
                    properties: {
                      confirmation_id: {
                        type: Type.STRING,
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
                    type: Type.OBJECT,
                    properties: {
                      query: { type: Type.STRING, description: "Capability needed, such as weather forecast, rocket launch, IP geolocation, or country information." },
                      limit: { type: Type.INTEGER, description: "Maximum providers to return (default 6, maximum 12)." },
                      ready_only: { type: Type.BOOLEAN, description: "Return only no-auth HTTPS providers when true." },
                    },
                    required: ["query"],
                  },
                },
                {
                  name: "refreshApiCatalogue",
                  description: "Refresh MYRAA's cached public-apis catalogue from its configured GitHub source. The importer validates and deduplicates entries before replacing the cache.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      force: { type: Type.BOOLEAN, description: "Ignore the normal cache age when true." },
                    },
                  },
                },
                {
                  name: "checkApiProvider",
                  description: "Run a bounded reachability check for one selected provider's documentation URL. This does not prove an API endpoint or adapter is valid.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      provider_id: { type: Type.STRING, description: "Provider ID returned by searchApiCapabilities." },
                    },
                    required: ["provider_id"],
                  },
                },
                {
                  name: "callVerifiedApiAdapter",
                  description: "Execute one already-verified declarative API adapter and return its normalized result. Never invent an adapter ID; use only IDs present in the API hub's verified adapter list.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      adapter_id: { type: Type.STRING, description: "Verified adapter ID from MYRAA's adapter registry." },
                      parameters: { type: Type.OBJECT, description: "Only the scalar parameters declared by that adapter." },
                    },
                    required: ["adapter_id", "parameters"],
                  },
                },
                {
                  name: "convertCurrency",
                  description: "Get a verified current exchange rate from the official no-key Frankfurter v2 adapter and calculate the converted amount. Use directly for requests such as '$1 in INR'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER, description: "Amount to convert (default 1)." },
                      from_currency: { type: Type.STRING, description: "Three-letter source currency, e.g. USD." },
                      to_currency: { type: Type.STRING, description: "Three-letter target currency, e.g. INR." },
                    },
                    required: ["amount", "from_currency", "to_currency"],
                  }
                },

                // ======== DESKTOP CONTROL TOOLS (routed to Python agent) ========
                {
                  name: "openApplication",
                  description: "Open any installed Windows application by name. MYRAA searches PATH, App Paths, installed apps, Start-menu shortcuts and UWP apps, then falls back to human-style Windows Search keyboard control. It is not restricted to a supported-app list.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Natural installed application name, e.g. Steam, OBS Studio, Photoshop, Discord, Notepad." } }, required: ["name"] }
                },
                {
                  name: "closeApplication",
                  description: "Close any running desktop application by matching its real window/process, focusing it, and using Alt+F4. This is not restricted to a supported-app list. Set force only when the user explicitly asks to force-close a background or unresponsive process.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Application name." }, force: { type: Type.BOOLEAN, description: "Force close (default false)." } }, required: ["name"] }
                },
                {
                  name: "openWebsite",
                  description: "Open a named website or URL in the user's default system browser. Supports shortcuts: youtube, gmail, google, github, chatgpt, etc.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Site name shortcut (e.g. 'youtube', 'gmail')." }, url: { type: Type.STRING, description: "Full URL if no shortcut." } } }
                },
                {
                  name: "searchWeb",
                  description: "Search a website engine (google, youtube, github, duckduckgo, bing) and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." }, engine: { type: Type.STRING, description: "Engine name (default 'google')." } }, required: ["query"] }
                },
                {
                  name: "searchYouTube",
                  description: "Search YouTube and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGoogle",
                  description: "Search Google and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "searchGitHub",
                  description: "Search GitHub repositories and open results in the default browser.",
                  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: "Search query." } }, required: ["query"] }
                },
                {
                  name: "createFile",
                  description: "Create a new text file with optional content. Scoped to safe folders (Desktop, Documents, Downloads, etc.).",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "File content (default empty)." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists (default false)." } }, required: ["path"] }
                },
                {
                  name: "readFile",
                  description: "Read the contents of a text file.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, max_chars: { type: Type.INTEGER, description: "Max chars to return (default 8000)." } }, required: ["path"] }
                },
                {
                  name: "renameFile",
                  description: "Rename a file.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Current file path." }, new_name: { type: Type.STRING, description: "New file name." } }, required: ["path", "new_name"] }
                },
                {
                  name: "deleteFile",
                  description: "Delete a file. Sends to Recycle Bin by default (safe). Use permanent=true for hard delete.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, permanent: { type: Type.BOOLEAN, description: "Permanently delete (default false)." } }, required: ["path"] }
                },
                {
                  name: "moveFile",
                  description: "Move a file to a new location.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Source file path." }, destination: { type: Type.STRING, description: "Destination path or folder." } }, required: ["path", "destination"] }
                },
                {
                  name: "openFolder",
                  description: "Open a folder in File Explorer. Supports aliases: desktop, documents, downloads, pictures, music, videos, home.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Folder name or alias." }, path: { type: Type.STRING, description: "Full path if no alias." } } }
                },
                {
                  name: "listFiles",
                  description: "List files in a folder.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Folder name or alias." }, path: { type: Type.STRING, description: "Full path." }, pattern: { type: Type.STRING, description: "Glob pattern (default '*')." } } }
                },
                {
                  name: "searchFiles",
                  description: "Search for files by name glob or extension under a folder.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Filename glob (e.g. '*.py')." }, extension: { type: Type.STRING, description: "File extension (e.g. 'py')." }, folder: { type: Type.STRING, description: "Folder to search (default home)." }, limit: { type: Type.INTEGER, description: "Max results (default 100)." } } }
                },
                {
                  name: "volumeUp",
                  description: "Increase system volume.",
                  parameters: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "volumeDown",
                  description: "Decrease system volume.",
                  parameters: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER, description: "Step amount 0-1 (default 0.1)." } } }
                },
                {
                  name: "setVolume",
                  description: "Set system volume to a specific percentage.",
                  parameters: { type: Type.OBJECT, properties: { percent: { type: Type.NUMBER, description: "Volume percentage 0-100." } }, required: ["percent"] }
                },
                {
                  name: "muteToggle",
                  description: "Toggle mute/unmute on the system volume.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "requestPowerAction",
                  description: "FIRST STEP for dangerous power actions. Generates a confirmation token. Tell the user verbally, then call executePowerAction with the token if they confirm. Actions: shutdown, restart, sleep, lock.",
                  parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: "Power action: shutdown, restart, sleep, lock." } }, required: ["action"] }
                },
                {
                  name: "executePowerAction",
                  description: "SECOND STEP: execute a previously-confirmed power action. Requires a valid execute_token from requestPowerAction. Single-use, expires in 60 seconds.",
                  parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, description: "The confirmed power action." }, execute_token: { type: Type.STRING, description: "Confirmation token from requestPowerAction." } }, required: ["action", "execute_token"] }
                },
                {
                  name: "minimizeWindow",
                  description: "Minimize the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match (optional, defaults to active window)." } } }
                },
                {
                  name: "maximizeWindow",
                  description: "Maximize the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "closeWindow",
                  description: "Close the active window or a named window.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to match." } } }
                },
                {
                  name: "switchApplication",
                  description: "Switch to a named application window, or cycle Alt+Tab if no title given.",
                  parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Window title to switch to." } } }
                },
                {
                  name: "locateText",
                  description: "Read-only exact visible-text targeting. Locates a button, tab, menu, or label using Windows UI Automation or built-in OCR and returns its physical rectangle and center. It never guesses or clicks, and fails on absent or ambiguous labels.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "Exact visible label text." }, window_title: { type: Type.STRING, description: "Optional containing window title." }, occurrence: { type: Type.INTEGER, description: "1-based match only when the exact label legitimately appears multiple times." } }, required: ["text"] }
                },
                {
                  name: "clickText",
                  description: "Preferred high-accuracy mouse action for every visible labeled control. Resolves the exact label at action time via Windows UI Automation or built-in OCR, moves to its true center, verifies cursor arrival, then clicks. Refuses to click if absent or ambiguous; never substitutes a fuzzy neighboring label.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "Exact visible label text to click." }, window_title: { type: Type.STRING, description: "Optional containing window title; focuses it before locating." }, occurrence: { type: Type.INTEGER, description: "1-based match only when the exact label legitimately appears multiple times." }, button: { type: Type.STRING, enum: ["left", "right"] }, verify_wait: { type: Type.NUMBER, description: "Seconds to wait before visual change verification (0.15 to 2.0)." } }, required: ["text"] }
                },
                {
                  name: "observeDesktopState",
                  description: "Read current cursor, virtual desktop, active window, and optionally visible-window metadata. Use before and after generic GUI actions to verify state changes.",
                  parameters: { type: Type.OBJECT, properties: { include_windows: { type: Type.BOOLEAN, description: "Include visible windows (default true)." } } }
                },
                {
                  name: "getCursorPosition",
                  description: "Read the current mouse cursor coordinates without changing the desktop.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "getActiveWindow",
                  description: "Read the active window title, process ID, and bounds without changing it.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "listVisibleWindows",
                  description: "List visible top-level windows with title, process ID, and bounds.",
                  parameters: { type: Type.OBJECT, properties: { limit: { type: Type.INTEGER, description: "Maximum windows (default 50, max 100)." } } }
                },
                {
                  name: "moveMouse",
                  description: "Move the cursor to validated virtual-desktop coordinates. Returns a fresh desktop observation.",
                  parameters: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER }, duration: { type: Type.NUMBER, description: "Bounded movement duration in seconds." } }, required: ["x", "y"] }
                },
                {
                  name: "click",
                  description: "Click once at optional validated coordinates, or at the current cursor. Returns a fresh observation; verify the expected UI change.",
                  parameters: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER }, button: { type: Type.STRING, enum: ["left", "middle", "right"] } } }
                },
                {
                  name: "doubleClick",
                  description: "Double-click at optional validated coordinates. Returns a fresh observation.",
                  parameters: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER }, interval: { type: Type.NUMBER } } }
                },
                {
                  name: "rightClick",
                  description: "Right-click at optional validated coordinates. Returns a fresh observation.",
                  parameters: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER } } }
                },
                {
                  name: "drag",
                  description: "Drag from the current cursor or optional start coordinates to validated target coordinates. Returns a fresh observation.",
                  parameters: { type: Type.OBJECT, properties: { x: { type: Type.INTEGER }, y: { type: Type.INTEGER }, start_x: { type: Type.INTEGER }, start_y: { type: Type.INTEGER }, duration: { type: Type.NUMBER }, button: { type: Type.STRING, enum: ["left", "right"] } }, required: ["x", "y"] }
                },
                {
                  name: "scroll",
                  description: "Scroll a bounded amount at the current cursor or optional validated coordinates. Positive scrolls up; negative scrolls down.",
                  parameters: { type: Type.OBJECT, properties: { amount: { type: Type.INTEGER }, x: { type: Type.INTEGER }, y: { type: Type.INTEGER } }, required: ["amount"] }
                },
                {
                  name: "typeText",
                  description: "Type literal text into the focused control using a bounded per-character interval. Returns a fresh observation.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, interval: { type: Type.NUMBER } }, required: ["text"] }
                },
                {
                  name: "pressKey",
                  description: "Press one validated keyboard key a bounded number of times.",
                  parameters: { type: Type.OBJECT, properties: { key: { type: Type.STRING }, presses: { type: Type.INTEGER }, interval: { type: Type.NUMBER } }, required: ["key"] }
                },
                {
                  name: "hotkey",
                  description: "Press a validated combination of 2 to 5 keyboard keys.",
                  parameters: { type: Type.OBJECT, properties: { keys: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["keys"] }
                },
                {
                  name: "waitForUi",
                  description: "Wait up to five seconds for a UI transition, then return fresh desktop metadata and whether the active title changed.",
                  parameters: { type: Type.OBJECT, properties: { seconds: { type: Type.NUMBER }, previous_title: { type: Type.STRING }, include_windows: { type: Type.BOOLEAN } } }
                },
                {
                  name: "copySelected",
                  description: "Copy selected text: sends Ctrl+C and reads the clipboard.",
                  parameters: { type: Type.OBJECT, properties: { wait: { type: Type.NUMBER, description: "Seconds to wait after Ctrl+C (default 0.35)." } } }
                },
                {
                  name: "pasteClipboard",
                  description: "Paste text into the active input. Writes text to clipboard then sends Ctrl+V.",
                  parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: "Text to paste. If omitted, pastes current clipboard." } } }
                },
                {
                  name: "getClipboard",
                  description: "Read the current clipboard text content.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max chars (default 1000)." } } }
                },
                {
                  name: "clearClipboard",
                  description: "Empty the clipboard.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "takeScreenshot",
                  description: "Capture the full screen. Optionally include base64 image data.",
                  parameters: { type: Type.OBJECT, properties: { include_image: { type: Type.BOOLEAN, description: "Include base64 JPEG image (default false)." }, max_dim: { type: Type.INTEGER, description: "Max image dimension (default 1280)." } } }
                },
                {
                  name: "saveScreenshot",
                  description: "Save a screenshot to Pictures/MyraaScreenshots.",
                  parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING, description: "Optional filename prefix." } } }
                },
                {
                  name: "analyzeScreenshot",
                  description: "Take a screenshot and run OCR to extract visible text from the screen.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "readScreen",
                  description: "OCR the active window and return its title plus visible text.",
                  parameters: { type: Type.OBJECT, properties: { max_chars: { type: Type.INTEGER, description: "Max OCR chars (default 1500)." } } }
                },
                {
                  name: "viewScreen",
                  description: "Capture the current desktop for the AI to see. Returns a downsized JPEG plus the active window title. The bridge also pushes the frame into the live multimodal stream automatically, so just call this and then answer the user's question about what is on their screen.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      max_dim: { type: Type.INTEGER, description: "Max image dimension in pixels (default 1024, range 320-1920)." },
                      keep_file: { type: Type.BOOLEAN, description: "Persist a copy of the frame under the OS temp dir (default false)." },
                    }
                  }
                },
                {
                  name: "createPythonFile",
                  description: "Create a Python (.py) file with content.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "Python code content." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "writeCodeFile",
                  description: "Create a code file in any language with appropriate extension.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "File path." }, content: { type: Type.STRING, description: "Code content." }, language: { type: Type.STRING, description: "Language name (e.g. 'python', 'javascript', 'html')." }, overwrite: { type: Type.BOOLEAN, description: "Overwrite if exists." } }, required: ["path"] }
                },
                {
                  name: "createProjectFolder",
                  description: "Create a project folder structure with optional subfolders and starter files.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Project root folder path." }, subfolders: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of subfolder names." }, scaffold_standard: { type: Type.BOOLEAN, description: "Create src, tests, docs subfolders." }, files: { type: Type.OBJECT, description: "Object of relative-path -> content for starter files." } }, required: ["path"] }
                },
                {
                  name: "runPythonScript",
                  description: "Execute a Python script and capture stdout, stderr, and exit code. Has a configurable timeout.",
                  parameters: { type: Type.OBJECT, properties: { path: { type: Type.STRING, description: "Script path." }, args: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Script arguments." }, timeout: { type: Type.INTEGER, description: "Timeout in seconds (default 30)." } }, required: ["path"] }
                },
                {
                  name: "systemInfo",
                  description: "Get system resource usage: CPU %, RAM %, disk usage, uptime, OS info.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "gpuInfo",
                  description: "Get NVIDIA GPU stats: utilization %, VRAM usage, temperature. Graceful fallback if no NVIDIA GPU.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "temperatureInfo",
                  description: "Get available temperature readings (CPU, GPU, etc.). Best-effort on Windows.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                // --- V2: Brightness control ---
                {
                  name: "brightnessUp",
                  description: "Increase screen brightness by a step (default 10%). Use when user says 'increase brightness' or 'make screen brighter'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER, description: "Percentage to increase (default 10)." }
                    }
                  }
                },
                {
                  name: "brightnessDown",
                  description: "Decrease screen brightness by a step (default 10%). Use when user says 'decrease brightness' or 'dim screen'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER, description: "Percentage to decrease (default 10)." }
                    }
                  }
                },
                {
                  name: "setBrightness",
                  description: "Set screen brightness to an exact level. Use when user says 'set brightness to 50%' or 'brightness 80'.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      percent: { type: Type.NUMBER, description: "Target brightness 0-100." }
                    },
                    required: ["percent"]
                  }
                },
                // --- V2: Windows auto-start management ---
                {
                  name: "enableAutoStart",
                  description: "Enable MYRAA to launch automatically when Windows starts. Creates a silent startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "disableAutoStart",
                  description: "Disable MYRAA auto-start on Windows login. Removes the startup entry.",
                  parameters: { type: Type.OBJECT, properties: {} }
                },
                {
                  name: "getAutoStartStatus",
                  description: "Check whether MYRAA is currently configured to auto-start on Windows login.",
                  parameters: { type: Type.OBJECT, properties: {} }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Audio Stream Chunk (model response audio play, 24kHz raw PCM)
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              if (!myraaSpeechObserved) {
                myraaSpeechObserved = true;
                void processCognitiveEvent({
                  type: "conversation.myraa_started_speaking",
                  source: "conversation",
                  importance: 0.42,
                  correlationId: connectionId,
                  metadata: { connectionId },
                });
              }
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }
            
            // Interruption flag
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
                  interruptedThought: currentModelResponseText.slice(-800),
                },
              });
            }
            
            // Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
              myraaSpeechObserved = false;
              const completedSpeech = speechOrchestrator.onTurnComplete();
              const completedResponseText = currentModelResponseText.trim();
              if (completedResponseText) {
                dialogueHistory.push({ role: "model", text: completedResponseText });
                currentModelResponseText = "";
              }
              void processCognitiveEvent({
                type: "conversation.turn_completed",
                source: "conversation",
                importance: 0.5,
                correlationId: connectionId,
                metadata: { connectionId, text: completedResponseText.slice(0, 1_500) },
              });
              if (completedSpeech?.source === "conversation_continuation" || completedSpeech?.source === "casual_initiative") {
                cognition.markAutonomousSpeechCompleted();
                void processCognitiveEvent({
                  type: "internal.autonomous_speech_completed",
                  source: "internal",
                  importance: 0.45,
                  metadata: {
                    thoughtId: completedSpeech.thoughtId,
                    text: completedResponseText.slice(0, 1_500),
                    internalOnly: true,
                  },
                });
              }
              nextPresenceAt = Date.now() + nextPresenceDelayMs(presenceTurnsWithoutUser);

              // Consolidate only the new bounded slice; never re-send an
              // ever-growing complete conversation to the memory model.
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
            
            // Transcription of model output (text chunk)
            const modelParts = ((message.serverContent as any)?.modelTurn?.parts || []) as Array<{
              text?: string;
              thought?: boolean;
            }>;
            const visibleModelPartText = modelParts
              .filter((part) => part.thought !== true && typeof part.text === "string")
              .map((part) => part.text)
              .join("");
            const rawModelText =
              (message.serverContent as any)?.outputTranscription?.text ??
              visibleModelPartText;
            const modelText = sanitizeSpokenModelText(rawModelText);
            if (modelText) {
              clientWs.send(JSON.stringify({ type: "transcription", role: "model", text: modelText }));
              currentModelResponseText += modelText;
            }
            
            // User input transcription (user speech text translated by Gemini)
            const userTextOutput =
              (message.serverContent as any)?.inputTranscription?.text ??
              (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTextOutput) {
              markUserPresenceActivity();
              speechOrchestrator.observeUserResponse();
              clientWs.send(JSON.stringify({ type: "transcription", role: "user", text: userTextOutput }));
              dialogueHistory.push({ role: "user", text: userTextOutput });
              queueCognitiveUserText(userTextOutput, "voice");
              // Input transcription can arrive in several chunks. Accumulate
              // the current spoken turn so split phrases such as "look at" +
              // "my screen" are still detected exactly once.
              const voiceChunk = String(userTextOutput).trim();
              if (voiceChunk.startsWith(voiceScreenIntentText)) {
                voiceScreenIntentText = voiceChunk;
              } else {
                voiceScreenIntentText = `${voiceScreenIntentText} ${voiceChunk}`.trim();
              }
              if (
                screenVision
                && !voiceScreenVisionTriggered
                && detectScreenVisionIntent(voiceScreenIntentText)
              ) {
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
                      minConfidence: 0.35,
                    });
                    session.sendClientContent({
                      turns: [{
                        role: "user",
                        parts: [
                          {
                            text: withRetrievedMemory(
                              `${spokenQuestion}\n\nA fresh screenshot is attached. Analyze it and answer the spoken question directly.`,
                              recalled,
                            ),
                          },
                          { inlineData: { data: frame.imageBase64, mimeType: frame.mimeType } },
                        ],
                      }],
                      turnComplete: true,
                    });
                    lastSharedScreenFrameAt = Date.now();
                    screenVision.markFrameDelivered(frame);
                    console.log(`[ScreenVision] Ordered multimodal turn sent for voice input (${frame.width}x${frame.height}).`);
                  } catch (error) {
                    screenVision.reportError(
                      `Vision model delivery failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                  }
                })();
              }
            }
            
            // Function Calls (Gemini requesting server/client tool execution)
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                console.log(`[Function Call]: ${fc.name} keys=[${Object.keys((fc.args || {}) as object).join(",")}]`);
                
                if (fc.name === "saveCustomMemory") {
                  (async () => {
                    try {
                      const args = fc.args as any;
                      const category = args.category;
                      const text = args.text;
                      if (category && text) {
                        const mList = await loadMemories();
                        const timestamp = new Date().toISOString();
                        const newMemory: Memory = {
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
                          metadata: { connectionId, memoryId: newMemory.id, text: newMemory.text },
                        });
                        
                        // Sync immediately with the React client
                        clientWs.send(JSON.stringify({ type: "memory_sync", memories: mList }));
                        
                        // Send success code back to live link
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
                    } catch (err: any) {
                      console.error("saveCustomMemory execution failure:", err);
                    }
                  })();
                } else if (fc.name === "confirmPendingAction") {
                  (async () => {
                    const confirmationId = String((fc.args as any)?.confirmation_id || "");
                    const confirmed = await toolExecutor.confirm(confirmationId);
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output: confirmed },
                        id: fc.id,
                      }],
                    });
                  })();
                } else if (DESKTOP_TOOLS.has(fc.name) || API_HUB_TOOLS.has(fc.name)) {
                  // Permission-bound backend tools. Desktop actions route to
                  // Python; API discovery stays inside the local API hub.
                  (async () => {
                    console.log(`[MYRAA Tool] Routing ${fc.name} through safety policy...`);
                    const execution = await toolExecutor.execute(
                      fc.name,
                      fc.args as Record<string, unknown>,
                      {
                        correlationId: `${connectionId}:${fc.id}`,
                        projectRoot: process.env.MYRAA_APP_ROOT || process.cwd(),
                      },
                    );
                    const verification = critic.verifyToolResult(execution);
                    let output: any = execution.status === "confirmation_required"
                      ? {
                          confirmation_required: true,
                          confirmation_id: execution.confirmationId,
                          risk_level: execution.riskLevel,
                          verification,
                          result: "This action was not executed. Ask the user to confirm the exact action, then call confirmPendingAction with the confirmation_id only after an explicit yes.",
                        }
                      : { ...execution, verification };
                    // Screen-vision side-channel: when the model asks for a
                    // screenshot itself (takeScreenshot / viewScreen), also
                    // push the returned JPEG into the live session as a video
                    // frame. This gives the multimodal model a *real* visual
                    // reference in addition to the structured function result,
                    // so it can describe the screen accurately.
                    if (screenVision && (fc.name === "takeScreenshot" || fc.name === "viewScreen")) {
                      const result = (execution as any)?.result;
                      const payload = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
                      const image = payload && typeof payload.image_base64 === "string"
                        ? (payload.image_base64 as string)
                        : "";
                      if (image) {
                        const safePayload = { ...payload };
                        delete safePayload.image_base64;
                        output = {
                          ...output,
                          result: { ...safePayload, image_attached_to_vision_context: true },
                        };
                        const injected = screenVision.injectFrame({
                          ok: true,
                          imageBase64: image,
                          mimeType: typeof payload?.image_mime === "string" ? payload.image_mime : "image/jpeg",
                          width: Number(payload?.width) || 0,
                          height: Number(payload?.height) || 0,
                          activeWindow: typeof payload?.active_window === "string" ? payload.active_window : null,
                          source: fc.name === "viewScreen" ? "viewScreen" : "takeScreenshot",
                          capturedAt: Date.now(),
                        });
                        if (injected) {
                          logCommand(`SCREEN_VISION Frame injected from ${fc.name} (${payload?.width || "?"}x${payload?.height || "?"}).`);
                          console.log(`[ScreenVision] Frame injected from ${fc.name} (${payload?.width || "?"}x${payload?.height || "?"}).`);
                        }
                      } else if (fc.name === "viewScreen" || (fc.args as any)?.include_image) {
                        logCommand(`SCREEN_VISION ${fc.name} did not return image bytes; model will rely on text.`);
                      }
                    }
                    session.sendToolResponse({
                      functionResponses: [{
                        name: fc.name,
                        response: { output },
                        id: fc.id,
                      }],
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
          onerror: (event: ErrorEvent) => {
            const details = String((event as any)?.error?.message || (event as any)?.message || "Unknown Gemini Live error");
            console.error("Gemini Live session error:", details);
            logError(`GEMINI_LIVE_ERROR: ${details}`);
            try {
              clientWs.send(JSON.stringify({ type: "error", error: `Gemini Live error: ${details}` }));
            } catch {
              /* client already disconnected */
            }
          },
          onclose: (event: CloseEvent) => {
            const reason = event.reason || "No close reason provided";
            const details = `code=${event.code} reason=${reason}`;
            const authenticationRejected =
              event.code === 1008 && /authentication|credential|api.?key|unauthenticated/i.test(reason);
            console.error("Gemini Live session closed:", details);
            logError(`GEMINI_LIVE_CLOSED ${details}`);
            if (authenticationRejected) {
              // Remove an unusable stored key and suppress an invalid .env fallback.
              // The client reloads so ApiKeyGate can securely request a replacement.
              clearGeminiApiKey();
            }
            try {
              clientWs.send(JSON.stringify(authenticationRejected
                ? {
                    type: "error",
                    code: "INVALID_API_KEY",
                    error: "Google rejected the saved Gemini API key. Enter a new key to continue.",
                  }
                : {
                    type: "error",
                    error: `Gemini Live closed (${details}). Open Settings → Voice to verify or replace the API key.`,
                  }));
            } catch {
              /* client already disconnected */
            }
          }
        }
      });

      // Wire the screen-vision pipeline to this live session. The pipeline
      // uses the same `callAgent` helper as the rest of the server, so the
      // function declarations and registration stay in lockstep.
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
              error: info?.error ?? null,
            }));
          } catch {
            /* client already disconnected */
          }
        },
      });
      rememberScreenVision(screenVision);
      console.log(`[ScreenVision] Pipeline bound to connection ${connectionId}.`);

      const unsubscribeInitiative = cognition.onDecision((outcome) => {
        if (!outcome.decision.shouldGenerateSpeech) return;
        if (clientWs.readyState !== 1) return;
        const isInternal = outcome.event.type.startsWith("internal.");
        // Direct user turns already have a normal Gemini response path. An
        // approved endogenous turn is deliberately allowed even though it was
        // derived from the same conversation session.
        if (outcome.event.correlationId && !isInternal) return;
        if (cognition.config.debug) {
          clientWs.send(JSON.stringify({
            type: "cognitionDecision",
            eventType: outcome.event.type,
            attention: outcome.attention.score,
            decision: outcome.decision.action,
            reason: outcome.decision.reason,
          }));
        }
        const thoughtId = typeof outcome.event.metadata.thoughtId === "string"
          ? outcome.event.metadata.thoughtId
          : undefined;
        const source = outcome.decision.action === "WARN"
          ? "critical_warning"
          : outcome.event.type === "internal.unfinished_topic"
            ? "conversation_continuation"
            : "casual_initiative";
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
                parts: [{ text: buildInitiativePrompt(outcome) }],
              }],
              turnComplete: true,
            });
          },
        });
      });

      cognition.setSpeechAvailable(true);

      const runProactivePresenceCheck = async () => {
        const now = Date.now();
        if (presenceCheckInFlight || now < nextPresenceAt || clientWs.readyState !== 1) return;
        const speechStatus = speechOrchestrator.status();
        const situation = cognition.situation.getSnapshot();
        if (
          speechStatus.active
          || speechStatus.userSpeaking
          || situation.userSpeaking
          || situation.myraaSpeaking
          || situation.autonomyPaused
        ) return;
        if (now - lastUserPresenceActivityAt < 10_000) {
          nextPresenceAt = lastUserPresenceActivityAt + nextPresenceDelayMs(0);
          return;
        }

        presenceCheckInFlight = true;
        try {
          let observation: DesktopSnapshot | null = null;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3_000);
          try {
            observation = await fetchDesktopObservation(controller.signal);
          } catch {
            observation = null;
          } finally {
            clearTimeout(timeout);
          }

          let screenSource = "recent shared screen";
          let screenAvailable = now - lastSharedScreenFrameAt <= 25_000;
          if (!screenAvailable) {
            const screenshot = await callDesktopAgent("takeScreenshot", {
              include_image: true,
              max_dim: 640,
            });
            const payload = screenshot.result as Record<string, unknown> | undefined;
            const image = typeof payload?.image_base64 === "string" ? payload.image_base64 : "";
            if (screenshot.ok && image) {
              session.sendRealtimeInput({
                video: { data: image, mimeType: "image/jpeg" },
              });
              screenSource = "fresh desktop screenshot";
              screenAvailable = true;
            }
          }

          const idleSeconds = observation
            ? Number(observation.userIdleSeconds || 0)
            : (now - lastUserPresenceActivityAt) / 1000;
          const mode = classifyProactivePresence({
            userIdleSeconds: idleSeconds,
            lastMeaningfulScreenChangeAt,
            now,
          });
          const latestSpeechStatus = speechOrchestrator.status();
          const latestSituation = cognition.situation.getSnapshot();
          if (
            latestSpeechStatus.active
            || latestSpeechStatus.userSpeaking
            || latestSituation.userSpeaking
            || latestSituation.myraaSpeaking
            || Date.now() - lastUserPresenceActivityAt < 10_000
          ) {
            nextPresenceAt = Date.now() + nextPresenceDelayMs(0);
            return;
          }
          if (mode === "idle_away" && !shouldRepeatIdlePresence(lastIdlePresenceAt, now)) {
            nextPresenceAt = Math.max(lastIdlePresenceAt + 120_000, now + 20_000);
            return;
          }

          const thoughtId = randomUUID();
          presenceTurnsWithoutUser += 1;
          if (mode === "idle_away") lastIdlePresenceAt = now;
          nextPresenceAt = now + nextPresenceDelayMs(presenceTurnsWithoutUser);
          await processCognitiveEvent({
            type: "internal.proactive_presence",
            source: "internal",
            importance: mode === "idle_away" ? 0.8 : 0.78,
            confidence: screenAvailable ? 0.9 : 0.68,
            metadata: {
              connectionId,
              thoughtId,
              thought: mode === "idle_away"
                ? "The user has been quiet and may have stepped away. Check the latest screen before making one playful, non-repetitive presence remark."
                : "The user is silently working. Inspect the latest screen and contribute one concrete observation, suggestion, pointed question, or light joke about the visible task.",
              topic: observation?.activeWindow.title || situation.activeWindow || "current desktop activity",
              application: observation?.activeWindow.application || situation.activeApp,
              activeWindow: observation?.activeWindow.title || situation.activeWindow,
              idleSeconds,
              presenceMode: mode,
              screenSource,
              screenAvailable,
              suggestedAction: "SPEAK",
              relevance: 0.9,
              novelty: 0.82,
              urgency: 0.16,
              userImpact: 0.7,
              taskRelevance: mode === "active_task" ? 0.9 : 0.62,
              interruptionCost: mode === "active_task" ? 0.16 : 0.08,
              socialOpportunityScore: 0.9,
            },
          });
        } finally {
          presenceCheckInFlight = false;
        }
      };
      presenceTimer = setInterval(() => void runProactivePresenceCheck(), 1_000);
      presenceTimer.unref?.();
      
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));
      
      clientWs.on("message", async (rawMsg) => {
        try {
          const msg = JSON.parse(rawMsg.toString());
          if (msg.type === "conversationEvent" && typeof msg.event === "string") {
            const allowed = new Set([
              "user_started_speaking",
              "user_stopped_speaking",
              "user_interrupted_myraa",
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
                metadata: { connectionId, rms: msg.rms },
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
            const now = Date.now();
            const changeScore = Number(msg.changeScore);
            const heartbeat = msg.heartbeat === true;
            lastSharedScreenFrameAt = now;
            if (!heartbeat && Number.isFinite(changeScore) && changeScore >= 7) {
              lastMeaningfulScreenChangeAt = now;
            }
            if (now - lastScreenObservationAt >= 10_000) {
              lastScreenObservationAt = now;
              void processCognitiveEvent({
                type: "screen.frame_received",
                source: "screen",
                importance: 0.08,
                correlationId: connectionId,
                metadata: { connectionId, changeScore, heartbeat },
              });
            }
            if (
              !heartbeat
              && Number.isFinite(changeScore)
              && changeScore >= 16
              && now - lastVisualInitiativeAt >= 30_000
            ) {
              lastVisualInitiativeAt = now;
              void processCognitiveEvent({
                type: "internal.visual_context_changed",
                source: "internal",
                importance: 0.74,
                confidence: 0.76,
                metadata: {
                  connectionId,
                  thoughtId: randomUUID(),
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
                  changeScore,
                },
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
              queueCognitiveUserText(trimmed, "typed");
              // Keep screenshot and question in the same client-content turn.
              // The Gemini Live SDK explicitly gives no ordering guarantee
              // when realtime video and client text are sent separately.
              const isScreenRequest = detectScreenVisionIntent(trimmed);
              const screenFrame = screenVision && isScreenRequest
                ? await screenVision.capture("intent")
                : null;
              const recalled = await cognition.memories.retrieve({
                text: trimmed,
                projectId: cognition.situation.getSnapshot().currentProject,
                limit: 6,
                minConfidence: 0.35,
              });
              const promptText = isScreenRequest && !screenFrame
                ? `${trimmed}\n\nThe one-shot screen capture was unavailable. Say clearly that you could not access the screen, then ask the user to try again.`
                : trimmed;
              const parts: Array<Record<string, unknown>> = [
                { text: withRetrievedMemory(promptText, recalled) },
              ];
              if (screenFrame) {
                parts.push({
                  inlineData: {
                    data: screenFrame.imageBase64,
                    mimeType: screenFrame.mimeType,
                  },
                });
              }
              try {
                session.sendClientContent({
                  turns: [{ role: "user", parts }],
                  turnComplete: true,
                });
                if (screenFrame && screenVision) {
                  lastSharedScreenFrameAt = Date.now();
                  screenVision.markFrameDelivered(screenFrame);
                  console.log(`[ScreenVision] Ordered multimodal turn sent for typed input (${screenFrame.width}x${screenFrame.height}).`);
                }
              } catch (error) {
                if (screenVision && isScreenRequest) {
                  screenVision.reportError(
                    `Vision model delivery failed: ${error instanceof Error ? error.message : String(error)}`,
                  );
                }
                throw error;
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
          metadata: { connectionId },
        });
        try {
          session.close();
        } catch (e) {}
      });
      
    } catch (err: any) {
      console.error("Error connecting to Gemini Live API:", err);
      clientWs.send(JSON.stringify({ 
        type: "error", 
        error: `Could not connect to Gemini: ${err.message || err}` 
      }));
      clientWs.close();
    }
  });

  // Serve custom static assets folder
  app.use("/assets", express.static(path.join(process.cwd(), "assets")));

  // Express Static assets / Vite Dev Middleware configuration
  if (process.env.NODE_ENV !== "production") {
    // Loaded lazily so the production bundle never requires vite (a dev-only
    // dependency that is not shipped with the packaged app).
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "127.0.0.1", () => {
    logStartup(`MYRAA V2 server started on http://localhost:${PORT}`);
    console.log(`[Server] Running on http://localhost:${PORT}`);
    // Kick off the desktop agent (probe + auto-spawn) immediately on boot.
    ensureDesktopAgent()
      .then(async () => {
        await ensureDesktopObserver();
        if (cognition.config.desktopAwarenessEnabled && desktopObserverUrl) desktopPerception.start();
      })
      .catch((e) => console.warn(`[Desktop Agent] Boot probe failed: ${e?.message || e}`));
  });

  const shutdownCognition = () => {
    desktopPerception.stop();
    void cognition.shutdown().catch((error) =>
      logError(`COGNITION_SHUTDOWN_FAILED: ${error instanceof Error ? error.message : String(error)}`),
    );
  };
  process.once("SIGTERM", shutdownCognition);
  process.once("SIGINT", shutdownCognition);
}

function legacyCategoryForKind(kind: MemoryKind): Memory["category"] {
  switch (kind) {
    case "preference": return "preference";
    case "project": return "project";
    case "episodic": return "emotional";
    case "correction": return "behavior";
    case "skill": return "behavior";
    case "working": return "goal";
    case "semantic":
    default:
      return "identity";
  }
}

async function assertSafeExternalUrl(value: string): Promise<void> {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not allowed.");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network addresses are not allowed through the web proxy.");
  }
  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Private, loopback, or link-local destinations are not allowed through the web proxy.");
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped || (net.isIP(normalized) === 4 ? normalized : null);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

function classifyUserEventType(text: string): string {
  const normalized = text.trim().toLowerCase();
  if (/^(no[, ]|actually\b|correction\b)|\b(that'?s|that is) (wrong|not right)\b|\bi told you\b/.test(normalized)) {
    return "conversation.user_correction";
  }
  if (/\?$|^(what|why|when|where|who|how|can|could|should|is|are|do|does|did|will|would)\b/.test(normalized)) {
    return "conversation.user_question";
  }
  return "conversation.user_input";
}

function isStopIntent(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (/\b(don'?t|do not) stop\b/.test(normalized)) return false;
  return /^(myraa[,. ]+)?(stop|cancel|abort|don'?t do that|do not do that)(\b|[.!])/.test(normalized);
}

function isPauseAutonomyIntent(text: string): boolean {
  return /\b(pause|disable|turn off) (myraa'?s? )?(autonomy|autonomous mode)\b/i.test(text);
}

function isResumeAutonomyIntent(text: string): boolean {
  return /\b(resume|enable|turn on) (myraa'?s? )?(autonomy|autonomous mode)\b/i.test(text);
}

function parseQuietIntent(text: string): { durationMs?: number } | null {
  const normalized = text.trim().toLowerCase();
  if (/\b(talk normally|normal baat|speak normally|resume talking)\b/.test(normalized)) return null;
  if (!/\b(myraa[,. ]+quiet|be quiet|stay quiet|don'?t disturb me|do not disturb me|chup raho)\b/.test(normalized)) {
    return null;
  }
  const match = normalized.match(/(?:for\s+)?(\d+(?:\.\d+)?)\s*(minute|min|hour|hr)s?/);
  if (!match) return {};
  const amount = Number(match[1]);
  const unitMs = /hour|hr/.test(match[2]) ? 3_600_000 : 60_000;
  return { durationMs: Math.min(24 * 3_600_000, Math.max(0, amount * unitMs)) };
}

function isTalkNormallyIntent(text: string): boolean {
  return /\b(myraa[,. ]+)?(talk normally|speak normally|normal baat karo|don'?t be quiet|stop being quiet)\b/i.test(text);
}

function createContextualThoughtCandidate(context: InternalThoughtContext): ThoughtCandidate | null {
  const { thread } = context;
  const lastUser = (thread.lastUserStatement || "").trim();
  const lastMyraa = (thread.lastMyraaStatement || "").trim();
  const timestamp = Date.now();
  const make = (
    origin: ThoughtCandidate["origin"],
    content: string,
    suggestedAction: ThoughtCandidate["suggestedAction"] = "SPEAK",
    scores: Partial<Pick<ThoughtCandidate, "relevance" | "novelty" | "urgency" | "socialValue" | "confidence">> = {},
  ): ThoughtCandidate => ({
    id: randomUUID(),
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
    expiresAt: timestamp + 120_000,
  });

  const interrupted = thread.interruptedThoughts.at(-1)?.trim();
  if (context.reason === "interrupted_thought" && interrupted) {
    return make(
      "unfinished_thread",
      `A thought was cut off: "${interrupted}". Reconsider it against the latest exchange; resume only the still-relevant part, naturally and briefly.`,
      "SPEAK",
      { relevance: 0.94, novelty: 0.72, socialValue: 0.9 },
    );
  }

  if (context.reason === "goal_review") {
    return make(
      "goal",
      `The active goal "${thread.topic}" may deserve one concrete progress observation, blocker, or next step. Mention it only if it is useful right now.`,
      "SUGGEST",
      { relevance: thread.importance, novelty: 0.72, urgency: 0.35, socialValue: 0.76 },
    );
  }

  if (context.reason === "memory_resurfaced") {
    const memory = context.relevantMemories[0];
    if (!memory) return null;
    return make(
      "memory",
      `A relevant memory resurfaced: "${memory.content}". Connect it to the present situation only if the connection is concrete and not repetitive.`,
      "SPEAK",
      { relevance: memory.importance, novelty: 0.7, socialValue: 0.75, confidence: memory.confidence },
    );
  }

  if (!lastUser || !lastMyraa) return null;
  if (isFeedbackAboutMyraa(lastUser)) {
    return make(
      "reflection",
      `The user criticized MYRAA's conversational presence in "${lastUser}". Inspect MYRAA's last response for one concrete bot-like pattern and state the better behavior naturally. Use zero questions. Do not claim emotional connection and do not suggest collecting more preferences, routines, memories, or personal data.`,
      "SPEAK",
      { relevance: 0.97, novelty: 0.86, socialValue: 0.95, confidence: 0.92 },
    );
  }
  if (isFeelingOrFeedback(lastUser)) {
    return make(
      "reflection",
      `The user expressed a feeling or judgment in "${lastUser}". Do not interview them or ask for more feedback. Add one specific interpretation or grounded reaction as a natural statement, without claiming human emotions.`,
      "SPEAK",
      { relevance: 0.94, novelty: 0.82, socialValue: 0.92, confidence: 0.88 },
    );
  }
  const meaningfulMemory = context.relevantMemories.find((memory) =>
    memory.importance >= 0.62
    && hasDistinctiveTopicOverlap(`${lastUser} ${lastMyraa}`, memory.content)
    && !roughlyContained(lastMyraa, memory.content),
  );
  if (meaningfulMemory) {
    return make(
      "memory",
      `The latest exchange was about "${lastUser}". This relevant memory was not used yet: "${meaningfulMemory.content}". Add only the concrete connection as a statement. Do not ask what else to remember and do not make a generic offer to help.`,
      "SPEAK",
      { relevance: 0.9, novelty: 0.84, socialValue: 0.86, confidence: meaningfulMemory.confidence },
    );
  }

  if (context.curiosity && !isSimpleResolvedCommand(lastUser)) {
    return make(
      "curiosity",
      `From "${lastUser}", identify the one specific missing preference or assumption that genuinely changes what happens next. Ask that exact question without saying it is random or offering a menu.`,
      "ASK",
      { relevance: 0.9, novelty: 0.82, socialValue: 0.88 },
    );
  }

  if (isSimpleResolvedCommand(lastUser) || isClosedAnswer(lastUser, lastMyraa)) return null;
  const topicSeed = thread.unresolvedPoints.at(-1) || lastUser;
  return make(
    "unfinished_thread",
    `The conversation is still socially active around "${topicSeed}". Add one short, concrete implication, opinion, or useful disagreement that was not already in MYRAA's last line. If there is genuinely nothing new, complete silently.`,
    "SPEAK",
    { relevance: 0.86, novelty: 0.76, socialValue: 0.84 },
  );
}

function roughlyContained(haystack: string, needle: string): boolean {
  const words = (value: string) => new Set(
    value.toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, " ").split(/\s+/).filter((word) => word.length >= 4),
  );
  const left = words(haystack);
  const right = words(needle);
  if (right.size === 0) return false;
  let overlap = 0;
  for (const word of right) if (left.has(word)) overlap += 1;
  return overlap / right.size >= 0.55;
}

function isFeelingOrFeedback(text: string): boolean {
  return /\b(feel|feels|feeling|lagta|lagti|missing|annoy|irritat|boring|robot|chatbot|human|natural|real|problem|issue|pasand|weird|awkward)\b/i.test(text);
}

function isFeedbackAboutMyraa(text: string): boolean {
  const namesMyraa = /\b(myraa|you|your|tum|tumhe|tumko|aap|aapko|she|her)\b/i.test(text);
  const critiquesPresence = /\b(bot|robot|chatbot|human|natural|real|alive|missing|scripted|artificial|reply|respond|react|talk|speak|feel)\b/i.test(text);
  return namesMyraa && critiquesPresence;
}

function hasDistinctiveTopicOverlap(exchange: string, memory: string): boolean {
  const ignored = new Set([
    "about", "after", "again", "assistant", "because", "could", "have", "just", "myraa",
    "should", "something", "that", "their", "there", "these", "they", "this", "user", "want",
    "what", "when", "where", "which", "with", "would", "your", "aapko", "kuch", "mujhe",
  ]);
  const tokens = (value: string) => new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097f ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !ignored.has(word)),
  );
  const exchangeWords = tokens(exchange);
  const memoryWords = tokens(memory);
  for (const word of memoryWords) if (exchangeWords.has(word)) return true;
  return false;
}

function isSimpleResolvedCommand(text: string): boolean {
  return /\b(open|close|minimi[sz]e|maximi[sz]e|delete|rename|move|play|pause|band kar|khol|kar do|set volume)\b/i.test(text);
}

function isClosedAnswer(user: string, myraa: string): boolean {
  const userWasQuestion = /\?|^(what|who|when|where|how|why|kya|kaun|kab|क्य|आज)/i.test(user);
  return userWasQuestion && !/\b(maybe|later|not sure|confused|decide|soch|pata nahi)\b/i.test(user) && myraa.length > 30;
}

function buildInternalThoughtPrompt(context: InternalThoughtContext): string {
  const memoryLines = context.relevantMemories
    .slice(0, 6)
    .map((memory) => `- ${memory.content.slice(0, 320)}`)
    .join("\n");
  return [
    "You are MYRAA's private internal thought-candidate generator.",
    "This is an endogenous cognitive cycle. TECH did not send a new message.",
    "Return NO_COGNITION if there is no genuinely useful, novel, contextually relevant continuation or question.",
    "Do not produce hidden chain-of-thought. Return only a compact candidate conclusion as JSON.",
    `Opportunity reason: ${context.reason}`,
    `Conversation topic: ${context.thread.topic}`,
    `Last TECH statement: ${context.thread.lastUserStatement || "none"}`,
    `Last MYRAA statement: ${context.thread.lastMyraaStatement || "none"}`,
    `Unresolved points: ${context.thread.unresolvedPoints.join(" | ") || "none"}`,
    `Open questions: ${context.thread.openQuestions.join(" | ") || "none"}`,
    context.curiosity
      ? `Relevant unknown: ${context.curiosity.unknown} Known context: ${context.curiosity.known}`
      : "Relevant unknown: none detected",
    `Current app/activity: ${context.situation.activeApp || "unknown"} / ${context.situation.currentActivity || "unknown"}`,
    `Relevant memories:\n${memoryLines || "- none"}`,
    "Required JSON schema:",
    '{"origin":"curiosity|unfinished_thread|memory|goal|reflection|social","content":"one concise private idea worth expressing","relevance":0.0,"novelty":0.0,"urgency":0.0,"socialValue":0.0,"confidence":0.0,"suggestedAction":"SPEAK|ASK|SUGGEST|WAIT","relatedTopic":"topic","relatedMemoryIds":[]}',
    "Use high scores only when the thought would genuinely improve the ongoing conversation. Never create small talk merely because time passed.",
  ].join("\n");
}

function parseThoughtCandidate(text: string, context: InternalThoughtContext): ThoughtCandidate | null {
  const trimmed = text.trim();
  if (!trimmed || /^NO_COGNITION\b/i.test(trimmed) || /^null$/i.test(trimmed)) return null;
  const json = trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const content = typeof value.content === "string" ? value.content.trim() : "";
    if (!content) return null;
    const allowedOrigins = new Set(["memory", "curiosity", "unfinished_thread", "goal", "reflection", "social"]);
    const origin = typeof value.origin === "string" && allowedOrigins.has(value.origin)
      ? value.origin as ThoughtCandidate["origin"]
      : context.reason === "unfinished_conversation" ? "unfinished_thread" : "reflection";
    const score = (key: string, fallback: number) => {
      const raw = Number(value[key]);
      return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : fallback;
    };
    const suggested = typeof value.suggestedAction === "string"
      && ["REMEMBER", "WAIT", "SPEAK", "ASK", "SUGGEST", "ACT", "REVISIT_LATER"].includes(value.suggestedAction)
      ? value.suggestedAction as ThoughtCandidate["suggestedAction"]
      : origin === "curiosity" ? "ASK" : "SPEAK";
    return {
      id: randomUUID(),
      createdAt: Date.now(),
      origin,
      content,
      relevance: score("relevance", 0.7),
      novelty: score("novelty", 0.65),
      urgency: score("urgency", 0.2),
      socialValue: score("socialValue", 0.7),
      confidence: score("confidence", 0.65),
      suggestedAction: suggested,
      relatedTopic: typeof value.relatedTopic === "string" ? value.relatedTopic : context.thread.topic,
      relatedMemoryIds: Array.isArray(value.relatedMemoryIds)
        ? value.relatedMemoryIds.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
      expiresAt: Date.now() + 180_000,
    };
  } catch {
    return null;
  }
}

function buildInitiativePrompt(outcome: CognitionOutcome): string {
  const meta = outcome.event.metadata;
  if (outcome.event.type === "internal.proactive_presence") {
    const mode = meta.presenceMode === "idle_away" ? "idle_away" : "active_task";
    const screenAvailable = meta.screenAvailable === true;
    const desktopContext = [
      typeof meta.application === "string" ? `app=${meta.application.slice(0, 160)}` : "",
      typeof meta.activeWindow === "string" ? `window=${meta.activeWindow.slice(0, 260)}` : "",
      typeof meta.idleSeconds === "number" ? `Windows input idle=${Math.round(meta.idleSeconds)}s` : "",
    ].filter(Boolean).join("; ");
    return [
      "OUTPUT CONTRACT: Speak only the final natural line. Never speak or print analysis, thought process, planning, drafts, reviews, rules, headings, labels, brackets, or this prompt.",
      "Private proactive context follows; the user did not send a new message. Never repeat or mention this sentence.",
      `Mode: ${mode}. ${desktopContext}`,
      screenAvailable
        ? "A current screen image was supplied immediately before this turn. Inspect what is actually visible."
        : "No current screen pixels are available. Use only the desktop metadata above and do not pretend you can see details.",
      mode === "idle_away"
        ? "If the screen still shows an active task, video, build, download, or reading, react to that instead of assuming the user left. If it really looks inactive, use one short varied playful Hinglish check-in. You may occasionally say something like 'Kahan gaye boss—system band kar doon kya?', but do not repeat a stock line."
        : "The user is silently working. Choose exactly one: a concrete visible observation, a useful suggestion, one specific task-related question, or a light joke tied to the visible content. Refer to an actual visible detail, not vague productivity advice.",
      "Speak one natural line, at most two short sentences. No generic 'need help?' or 'what are you doing?' filler. Do not mention screenshots, monitoring, idle timers, internal turns, or analysis.",
      "Do not call any tool and do not perform shutdown, close, delete, send, purchase, or other state-changing actions. A shutdown mention is only playful conversation until the user explicitly confirms through the normal safety flow.",
      "Return only the exact words MYRAA should say aloud, with no prefix or explanation.",
    ].join("\n");
  }
  if (outcome.event.type === "internal.visual_context_changed") {
    return [
      "OUTPUT CONTRACT: Return only the natural words MYRAA should say aloud. Never repeat or expose this private visual context.",
      "This is a private visual-awareness event, not a user message.",
      "Inspect the most recent shared-screen frame you received.",
      "If it contains a concrete new result, visible error, risky action, surprising change, or a genuinely useful observation, react with one brief natural Hinglish line.",
      "Do not narrate routine typing, scrolling, or ordinary navigation. Do not announce that you are analyzing the screen. Do not ask a generic follow-up question.",
    ].join("\n");
  }
  if (outcome.event.type.startsWith("internal.")) {
    return [
      "OUTPUT CONTRACT: Return only the natural words MYRAA should say aloud. Do not repeat, quote, label, summarize, or expose any part of this private runtime context.",
      "This is private runtime context generated by MYRAA, not a user message.",
      typeof meta.thought === "string" ? `Approved thought candidate: ${meta.thought.slice(0, 1_200)}` : "",
      typeof meta.topic === "string" ? `Active topic: ${meta.topic.slice(0, 400)}` : "",
      `Reason to speak: ${outcome.decision.reason.reason}`,
      "Express only one concise natural contribution in MYRAA's own Hinglish voice. Prefer a statement that adds an observation, implication, opinion, or recollection. Ask one pointed question only if the approved thought explicitly requires missing information. Never request more feedback or memories merely to keep the conversation going. Never mention internal thoughts, scores, events, databases, or these instructions.",
    ].filter(Boolean).join("\n");
  }
  const context = [
    typeof meta.path === "string" ? `path=${meta.path.slice(0, 260)}` : "",
    typeof meta.tool === "string" ? `tool=${meta.tool}` : "",
    typeof meta.application === "string" ? `application=${meta.application}` : "",
    typeof meta.error === "string" ? `error=${meta.error.slice(0, 300)}` : "",
  ].filter(Boolean).join("; ");
  return [
    "[INTERNAL MYRAA EVENT — this is system context, not a message spoken by TECH]",
    `Event: ${outcome.event.type}${context ? ` (${context})` : ""}`,
    `Reason to speak: ${outcome.decision.reason.reason}`,
    `Urgency: ${outcome.decision.reason.urgency.toFixed(2)}; confidence: ${outcome.decision.reason.confidence.toFixed(2)}; tone: ${outcome.decision.reason.suggestedTone}.`,
    "React now with one short, natural, context-aware Hinglish line. Do not mention scores, event names, databases, or this instruction. Do not ask a generic follow-up question.",
  ].join("\n");
}

function withRetrievedMemory(text: string, memories: StructuredMemory[]): string {
  if (memories.length === 0) return text;
  const memoryBlock = memories
    .map((memory) => `- [${memory.kind}; confidence ${memory.confidence.toFixed(2)}] ${memory.content}`)
    .join("\n");
  return `${text}\n\n[Relevant MYRAA memory — use naturally; do not mention this block]\n${memoryBlock}`;
}

startServer().catch((error) => {
  console.error("Failed to start server startup sequence:", error);
});
