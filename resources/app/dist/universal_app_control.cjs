/**
 * MYRAA AI OS — Universal App Control Service
 * Provides semantic UI automation via Windows UI Automation API (PowerShell bridge)
 * with raw SendInput fallback for any window/app.
 *
 * Capabilities:
 *  - type text into any focused / named control
 *  - click by control name, class, or pixel coords
 *  - send keyboard shortcuts (Ctrl+C, Alt+F4, …)
 *  - read active window title + focused element name (for context-awareness)
 *  - take element-level screenshots (bounding-box crop)
 *  - safe zone checks (never touch password fields)
 */

"use strict";

const { exec, execSync } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

// ─── PowerShell runner ────────────────────────────────────────────────────────

async function runPS(script, opts = {}) {
  const escaped = script.replace(/"/g, '\\"');
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escaped}"`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: opts.timeoutMs || 10_000 });
    if (stderr && !opts.suppressStderr) console.warn("[AppControl PS stderr]", stderr.trim().slice(0, 200));
    return stdout.trim();
  } catch (err) {
    if (opts.throwOnError) throw err;
    console.error("[AppControl] PS error:", err.message?.slice(0, 200));
    return "";
  }
}

// ─── Inline PowerShell helpers via UI Automation ─────────────────────────────

const PS_INIT = `
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Windows.Forms
$ae = [System.Windows.Automation.AutomationElement]
$cp = [System.Windows.Automation.ControlType]
`;

// Get active window info
async function getActiveWindow() {
  const raw = await runPS(`
${PS_INIT}
$fg = [System.Windows.Automation.AutomationElement]::FocusedElement
$root = $fg
while ($root.Current.ControlType -ne $cp.Window -and $root.Current.ControlType -ne $cp.Pane -and $root.CachedParent -ne $null) {
  try { $root = $root.Navigate([System.Windows.Automation.TreeScope]::Parent, [System.Windows.Automation.Condition]::TrueCondition) } catch { break }
}
$info = @{
  windowTitle = $root.Current.Name
  focusedName = $fg.Current.Name
  focusedClass = $fg.Current.ClassName
  focusedType = $fg.Current.ControlType.ProgrammaticName
  processId = $root.Current.ProcessId
}
$info | ConvertTo-Json -Compress
`);
  try { return JSON.parse(raw); } catch { return {}; }
}

// Type text (sends to focused element)
async function typeText(text) {
  // Use SendKeys via Windows.Forms for Unicode support
  const escaped = text.replace(/[+^%~(){}\[\]]/g, "{$&}").replace(/\n/g, "{ENTER}");
  await runPS(`
${PS_INIT}
[System.Windows.Forms.SendKeys]::SendWait("${escaped.replace(/"/g, '`"')}")
`);
}

// Click a UI element by name pattern
async function clickElement(namePattern, windowTitle) {
  const winFilter = windowTitle ? `$root = $ae::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, (New-Object System.Windows.Automation.PropertyCondition($ae::NameProperty, "${windowTitle}")))` : `$root = $ae::RootElement`;
  const raw = await runPS(`
${PS_INIT}
${winFilter}
$cond = New-Object System.Windows.Automation.PropertyCondition($ae::NameProperty, "${namePattern}")
$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
if ($el) {
  $invokePattern = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  if ($invokePattern) { $invokePattern.Invoke(); "INVOKED" }
  else {
    $rect = $el.Current.BoundingRectangle
    $cx = [int]($rect.X + $rect.Width / 2)
    $cy = [int]($rect.Y + $rect.Height / 2)
    Add-Type -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
'@ -Name NativeMethods -Namespace Win32
    [Win32.NativeMethods]::SetCursorPos($cx, $cy)
    [Win32.NativeMethods]::mouse_event(0x0002, 0, 0, 0, 0)
    [Win32.NativeMethods]::mouse_event(0x0004, 0, 0, 0, 0)
    "CLICKED_RAW"
  }
} else { "NOT_FOUND" }
`, { throwOnError: false });
  return raw;
}

// Click at raw pixel coordinates
async function clickAt(x, y, button = "left") {
  const flags = button === "right" ? "0x0008,0x0010" : "0x0002,0x0004";
  await runPS(`
Add-Type -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
'@ -Name NativeMethods -Namespace Win32
[Win32.NativeMethods]::SetCursorPos(${x}, ${y})
[Win32.NativeMethods]::mouse_event(${flags}, 0, 0, 0, 0)
`);
}

// Send keyboard shortcut  e.g. "ctrl+c", "alt+F4"
async function sendShortcut(combo) {
  const keyMap = { "ctrl": "^", "alt": "%", "shift": "+", "win": "^{ESC}" };
  const parts = combo.toLowerCase().split("+");
  let sendStr = "";
  for (let i = 0; i < parts.length - 1; i++) sendStr += (keyMap[parts[i]] || parts[i]);
  const last = parts[parts.length - 1];
  const specials = { "enter": "{ENTER}", "esc": "{ESCAPE}", "tab": "{TAB}", "f4": "{F4}", "f5": "{F5}", "delete": "{DELETE}", "backspace": "{BACKSPACE}", "home": "{HOME}", "end": "{END}", "up": "{UP}", "down": "{DOWN}", "left": "{LEFT}", "right": "{RIGHT}" };
  sendStr += specials[last] || last.toUpperCase();
  await runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${sendStr}")
`);
}

// Focus a named window
async function focusWindow(windowTitle) {
  await runPS(`
${PS_INIT}
$cond = New-Object System.Windows.Automation.PropertyCondition($ae::NameProperty, "${windowTitle}", [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)
$win = $ae::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if ($win) {
  $wp = $win.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern)
  if ($wp) { $wp.SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Normal) }
  # Bring to foreground
  Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name Win32 -Namespace Fg
  [Fg.Win32]::SetForegroundWindow([IntPtr]$win.Current.NativeWindowHandle)
}
`);
}

// Read text content of focused element
async function readFocusedText() {
  const raw = await runPS(`
${PS_INIT}
$el = $ae::FocusedElement
try {
  $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  if ($vp) { $vp.Current.Value }
  else {
    $tp = $el.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
    if ($tp) { $tp.DocumentRange.GetText(5000) }
    else { $el.Current.Name }
  }
} catch { "" }
`);
  return raw;
}

// Check if focused element is sensitive (password field)
async function isFocusedSensitive() {
  const raw = await runPS(`
${PS_INIT}
$el = $ae::FocusedElement
$type = $el.Current.ControlType.ProgrammaticName
$name = $el.Current.Name.ToLower()
$class = $el.Current.ClassName.ToLower()
if ($type -eq "ControlType.Edit" -and ($name -match "password|secret|pin|pwd|passcode" -or $class -match "password")) {
  "SENSITIVE"
} else { "OK" }
`);
  return raw.includes("SENSITIVE");
}

// List all open windows
async function listWindows() {
  const raw = await runPS(`
${PS_INIT}
$cond = New-Object System.Windows.Automation.PropertyCondition($ae::ControlTypeProperty, $cp.Window)
$wins = $ae::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
$wins | ForEach-Object { @{ title = $_.Current.Name; pid = $_.Current.ProcessId; hwnd = $_.Current.NativeWindowHandle } } | ConvertTo-Json -Compress
`);
  try { return JSON.parse(raw); } catch { return []; }
}

// Copy selection to clipboard
async function copySelection() {
  await sendShortcut("ctrl+c");
  await new Promise(r => setTimeout(r, 150));
  const { execSync } = require("child_process");
  try {
    return execSync("powershell -command \"Get-Clipboard\"", { encoding: "utf8" }).trim();
  } catch { return ""; }
}

// Paste from clipboard
async function paste(text) {
  if (text !== undefined) {
    // Set clipboard then paste
    const safe = text.replace(/'/g, "''");
    await runPS(`Set-Clipboard -Value '${safe}'`);
    await new Promise(r => setTimeout(r, 100));
  }
  await sendShortcut("ctrl+v");
}

// ─── Verification helpers ─────────────────────────────────────────────────────

/**
 * Verify an outcome after performing an action.
 * Returns { success: bool, evidence: string }
 */
async function verifyAction(verificationStrategy, opts = {}) {
  switch (verificationStrategy) {
    case "window_exists": {
      const wins = await listWindows();
      const found = wins.some(w => (w.title || "").toLowerCase().includes((opts.title || "").toLowerCase()));
      return { success: found, evidence: found ? `Window "${opts.title}" is open` : `Window "${opts.title}" not found in ${wins.map(w=>w.title).join(", ")}` };
    }
    case "focused_text_contains": {
      const text = await readFocusedText();
      const found = text.toLowerCase().includes((opts.text || "").toLowerCase());
      return { success: found, evidence: found ? "Text confirmed in focused element" : `Expected "${opts.text}" but got: "${text.slice(0, 100)}"` };
    }
    case "clipboard_contains": {
      const cb = await copySelection();
      const found = cb.toLowerCase().includes((opts.text || "").toLowerCase());
      return { success: found, evidence: found ? "Clipboard confirmed" : `Clipboard had: "${cb.slice(0, 100)}"` };
    }
    case "active_window_title": {
      const info = await getActiveWindow();
      const found = (info.windowTitle || "").toLowerCase().includes((opts.title || "").toLowerCase());
      return { success: found, evidence: found ? `Active window is "${info.windowTitle}"` : `Active window is "${info.windowTitle}", expected "${opts.title}"` };
    }
    default:
      return { success: null, evidence: "Unknown verification strategy" };
  }
}

module.exports = {
  getActiveWindow,
  typeText,
  clickElement,
  clickAt,
  sendShortcut,
  focusWindow,
  readFocusedText,
  isFocusedSensitive,
  listWindows,
  copySelection,
  paste,
  verifyAction,
};
