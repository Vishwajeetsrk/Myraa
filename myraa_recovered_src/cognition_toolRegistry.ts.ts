import path from "node:path";
import type { PermissionName, RiskLevel, ToolDescriptor } from "./types";

const READ_ONLY = new Set([
  "readFile", "listFiles", "searchFiles", "getClipboard", "takeScreenshot",
  "analyzeScreenshot", "readScreen", "systemInfo", "gpuInfo", "temperatureInfo",
  "getAutoStartStatus", "getCursorPosition", "getActiveWindow", "listVisibleWindows",
  "waitForUi", "observeDesktopState",
]);

const BROWSER = new Set([
  "openWebsite", "searchWeb", "searchYouTube", "searchGoogle", "searchGitHub",
]);

const FILE_WRITE = new Set([
  "createFile", "renameFile", "deleteFile", "moveFile", "createPythonFile",
  "createProjectFolder", "writeCodeFile",
]);

const SYSTEM = new Set([
  "volumeUp", "volumeDown", "muteToggle", "setVolume", "requestPowerAction",
  "executePowerAction", "brightnessUp", "brightnessDown", "setBrightness",
  "enableAutoStart", "disableAutoStart", "getAutoStartStatus",
]);

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();

  register(descriptor: ToolDescriptor): void {
    if (this.tools.has(descriptor.name)) throw new Error(`Tool already registered: ${descriptor.name}`);
    this.tools.set(descriptor.name, Object.freeze({ ...descriptor }));
  }

  registerDesktopTools(names: Iterable<string>): void {
    for (const name of names) {
      if (this.tools.has(name)) continue;
      this.register(descriptorFor(name));
    }
  }

  get(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  assessRisk(name: string, args: Record<string, unknown>, projectRoot?: string): RiskLevel {
    const descriptor = this.get(name);
    let risk = descriptor?.riskLevel ?? 2;

    if (name === "deleteFile") {
      risk = args.permanent === true ? 4 : 2;
      if (isImportantPath(args.path, projectRoot)) risk = Math.max(risk, 3) as RiskLevel;
    }
    if (["createFile", "createPythonFile", "writeCodeFile"].includes(name) && args.overwrite === true) {
      risk = 3;
    }
    if (name === "closeApplication" && args.force === true) risk = 3;
    if (name === "executePowerAction" && typeof args.execute_token === "string") {
      // The Python agent validates a short-lived, single-use confirmation token.
      risk = 2;
    }
    return risk;
  }
}

function descriptorFor(name: string): ToolDescriptor {
  const permission = permissionFor(name);
  const riskLevel = riskFor(name);
  return {
    name,
    purpose: purposeFor(name),
    permission,
    riskLevel,
    timeoutMs: name === "runPythonScript" ? 45_000 : BROWSER.has(name) ? 30_000 : 25_000,
    maxRetries: READ_ONLY.has(name) ? 1 : 0,
  };
}

function permissionFor(name: string): PermissionName {
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

function riskFor(name: string): RiskLevel {
  if (READ_ONLY.has(name)) return 0;
  if (name === "runPythonScript") return 3;
  if (["requestPowerAction", "executePowerAction"].includes(name)) return 4;
  if (["deleteFile", "clearClipboard", "closeWindow", "closeApplication"].includes(name)) return 2;
  if (["enableAutoStart", "disableAutoStart"].includes(name)) return 2;
  if (FILE_WRITE.has(name)) return 1;
  return 1;
}

function purposeFor(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function isImportantPath(value: unknown, projectRoot?: string): boolean {
  if (typeof value !== "string" || !projectRoot) return false;
  try {
    const target = path.resolve(value).toLowerCase();
    const root = path.resolve(projectRoot).toLowerCase();
    return target === root || root.startsWith(target + path.sep) || target.startsWith(root + path.sep);
  } catch {
    return false;
  }
}
