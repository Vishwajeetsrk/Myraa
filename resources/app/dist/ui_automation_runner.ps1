# =============================================================================
# MYRAA AI OS — Native Windows UI Automation Runner (v1.0 APEX)
# =============================================================================
param(
    [string]$Command = "list_windows",
    [string]$Param1 = "",
    [string]$Param2 = "",
    [string]$Param3 = "",
    [string]$Param4 = "",
    [string]$Param5 = "",
    [string]$Param6 = ""
)

$ProgressPreference = 'SilentlyContinue'

# The PowerShell host is DPI-unaware by default, which virtualizes screen bounds
# (e.g. 1280x720 on a 1920x1080 display at 150% scaling) while UI Automation
# returns physical pixels. Declare awareness before any UI call so monitors,
# window bounds, element rects and mouse coordinates all share one coordinate
# space. Falls back to system-DPI awareness on older Windows builds.
try {
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MyraaDpi { [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value); [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
    $perMonitor = $false
    try { $perMonitor = [MyraaDpi]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch { }
    if (-not $perMonitor) { [MyraaDpi]::SetProcessDPIAware() | Out-Null }
} catch { }

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms

$csharp = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

public class UiaNativeRunner {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    const uint DESKTOP_ALL = 0x01FF;

    public static string ListWindows() {
        var sb = new StringBuilder();
        sb.Append("[");
        bool first = true;
        IntPtr fg = GetForegroundWindow();

        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }

            try {
                EnumWindows((hWnd, lParam) => {
                    if (IsWindowVisible(hWnd)) {
                        StringBuilder textSb = new StringBuilder(512);
                        GetWindowText(hWnd, textSb, 512);
                        string title = textSb.ToString().Trim();
                        if (title.Length > 0) {
                            if (!first) sb.Append(",");
                            first = false;
                            sb.Append(DescribeWindow(hWnd, fg));
                        }
                    }
                    return true;
                }, IntPtr.Zero);
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        sb.Append("]");
        return sb.ToString();
    }

    private static string DescribeWindow(IntPtr hWnd, IntPtr fg) {
        StringBuilder textSb = new StringBuilder(512);
        GetWindowText(hWnd, textSb, 512);
        string title = textSb.ToString().Trim();

        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        StringBuilder classSb = new StringBuilder(256);
        GetClassName(hWnd, classSb, 256);

        string procName = "";
        try { procName = Process.GetProcessById((int)pid).ProcessName; } catch { }

        RECT r;
        GetWindowRect(hWnd, out r);
        int width = Math.Max(0, r.Right - r.Left);
        int height = Math.Max(0, r.Bottom - r.Top);

        string state = IsIconic(hWnd) ? "minimized" : (IsZoomed(hWnd) ? "maximized" : "normal");
        string monitor = "";
        try { monitor = System.Windows.Forms.Screen.FromHandle(hWnd).DeviceName; } catch { }

        return string.Format(
            "{{\"id\":{0},\"title\":{1},\"className\":{2},\"handle\":{3},\"processName\":{4},\"state\":{5},\"isForeground\":{6},\"monitor\":{7},\"bounds\":{{\"x\":{8},\"y\":{9},\"width\":{10},\"height\":{11}}}}}",
            pid,
            EscapeJson(title),
            EscapeJson(classSb.ToString()),
            (long)hWnd,
            EscapeJson(procName),
            EscapeJson(state),
            (hWnd == fg) ? "true" : "false",
            EscapeJson(monitor),
            r.Left, r.Top, width, height
        );
    }

    public static string GetForeground() {
        IntPtr hWnd = GetForegroundWindow();
        if (hWnd == IntPtr.Zero) return "{\"ok\":true,\"window\":null}";
        return "{\"ok\":true,\"window\":" + DescribeWindow(hWnd, hWnd) + "}";
    }

    public static string GetMonitors() {
        var sb = new StringBuilder();
        sb.Append("{\"ok\":true,\"monitors\":[");
        bool first = true;
        int idx = 0;
        foreach (var s in System.Windows.Forms.Screen.AllScreens) {
            if (!first) sb.Append(",");
            first = false;
            sb.Append(string.Format(
                "{{\"index\":{0},\"device\":{1},\"primary\":{2},\"bounds\":{{\"x\":{3},\"y\":{4},\"width\":{5},\"height\":{6}}},\"workingArea\":{{\"x\":{7},\"y\":{8},\"width\":{9},\"height\":{10}}}}}",
                idx++,
                EscapeJson(s.DeviceName),
                s.Primary ? "true" : "false",
                s.Bounds.X, s.Bounds.Y, s.Bounds.Width, s.Bounds.Height,
                s.WorkingArea.X, s.WorkingArea.Y, s.WorkingArea.Width, s.WorkingArea.Height
            ));
        }
        sb.Append("]}");
        return sb.ToString();
    }

    public static string WindowAction(long handle, string action, int x, int y, int width, int height) {
        IntPtr h = new IntPtr(handle);
        if (h == IntPtr.Zero) return "{\"ok\":false,\"error\":\"Invalid window handle\"}";

        try {
            switch (action) {
                case "activate":
                    if (IsIconic(h)) ShowWindowAsync(h, 9);
                    SetForegroundWindow(h);
                    Thread.Sleep(150);
                    break;
                case "minimize":
                    ShowWindowAsync(h, 6);
                    Thread.Sleep(120);
                    break;
                case "maximize":
                    ShowWindowAsync(h, 3);
                    Thread.Sleep(120);
                    break;
                case "restore":
                    ShowWindowAsync(h, 9);
                    Thread.Sleep(120);
                    break;
                case "close":
                    PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero);
                    Thread.Sleep(120);
                    break;
                case "move":
                case "move-resize":
                    MoveWindow(h, x, y, Math.Max(1, width), Math.Max(1, height), true);
                    Thread.Sleep(120);
                    break;
                default:
                    return "{\"ok\":false,\"error\":\"Unknown window action: " + EscapeJsonRaw(action) + "\"}";
            }

            return "{\"ok\":true,\"action\":" + EscapeJson(action) + ",\"foreground\":" +
                ((GetForegroundWindow() == h) ? "true" : "false") +
                ",\"window\":" + DescribeWindow(h, GetForegroundWindow()) + "}";
        } catch (Exception ex) {
            return "{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}";
        }
    }

    public static string GetFocusedElement() {
        string result = "{\"ok\":false,\"error\":\"No focused element\"}";

        Thread t = new Thread(() => {
            try {
                AutomationElement el = AutomationElement.FocusedElement;
                if (el == null) { result = "{\"ok\":true,\"element\":null}"; return; }

                string name = el.Current.Name ?? "";
                string controlType = el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
                string autoId = el.Current.AutomationId ?? "";
                string className = el.Current.ClassName ?? "";
                bool isPassword = el.Current.IsPassword;
                var rect = el.Current.BoundingRectangle;

                string selectedText = "";
                bool hasSelection = false;
                if (!isPassword) {
                    try {
                        object tp;
                        if (el.TryGetCurrentPattern(TextPattern.Pattern, out tp)) {
                            var ranges = ((TextPattern)tp).GetSelection();
                            if (ranges != null && ranges.Length > 0) {
                                selectedText = ranges[0].GetText(-1) ?? "";
                                hasSelection = selectedText.Length > 0;
                            }
                        }
                    } catch { }
                }

                string windowTitle = "";
                try {
                    AutomationElement cur = el;
                    for (int i = 0; i < 8 && cur != null; i++) {
                        AutomationElement parent = TreeWalker.RawViewWalker.GetParent(cur);
                        if (parent == null || parent == AutomationElement.RootElement) break;
                        cur = parent;
                    }
                    if (cur != null && cur != AutomationElement.RootElement) windowTitle = cur.Current.Name ?? "";
                } catch { }

                if (selectedText.Length > 2000) selectedText = selectedText.Substring(0, 2000);

                result = string.Format(
                    "{{\"ok\":true,\"element\":{{\"name\":{0},\"controlType\":{1},\"automationId\":{2},\"className\":{3},\"isPassword\":{4},\"windowTitle\":{5},\"hasSelection\":{6},\"selectedText\":{7},\"rect\":{{\"x\":{8},\"y\":{9},\"width\":{10},\"height\":{11}}}}}}}",
                    EscapeJson(name),
                    EscapeJson(controlType),
                    EscapeJson(autoId),
                    EscapeJson(className),
                    isPassword ? "true" : "false",
                    EscapeJson(windowTitle),
                    hasSelection ? "true" : "false",
                    isPassword ? "null" : EscapeJson(selectedText),
                    (int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height
                );
            } catch (Exception ex) {
                result = "{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}";
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        return result;
    }

    public static string FindElement(string query, int maxResults) {
        if (string.IsNullOrEmpty(query)) return "{\"ok\":false,\"error\":\"Query is required\"}";
        int cap = Math.Max(1, Math.Min(maxResults, 25));
        var sb = new StringBuilder();
        sb.Append("{\"ok\":true,\"matches\":[");
        bool first = true;
        int found = 0;

        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }

            try {
                AutomationElement root = AutomationElement.RootElement;
                var windows = root.FindAll(TreeScope.Children, Condition.TrueCondition);
                for (int w = 0; w < windows.Count && found < cap; w++) {
                    var win = windows[w];
                    string winTitle = "";
                    try { winTitle = win.Current.Name ?? ""; } catch { continue; }

                    AutomationElementCollection descendants;
                    try { descendants = win.FindAll(TreeScope.Descendants, Condition.TrueCondition); } catch { continue; }

                    for (int i = 0; i < descendants.Count && found < cap; i++) {
                        try {
                            var el = descendants[i];
                            string n = el.Current.Name ?? "";
                            string aid = el.Current.AutomationId ?? "";
                            string cls = el.Current.ClassName ?? "";
                            bool hit = n.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 ||
                                       aid.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 ||
                                       cls.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
                            if (!hit) continue;
                            if (el.Current.IsPassword) continue;

                            string controlType = el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
                            var rect = el.Current.BoundingRectangle;
                            if (rect.Width <= 0 || rect.Height <= 0) continue;

                            if (!first) sb.Append(",");
                            first = false;
                            found++;
                            sb.Append(string.Format(
                                "{{\"windowTitle\":{0},\"name\":{1},\"controlType\":{2},\"automationId\":{3},\"className\":{4},\"isEnabled\":{5},\"rect\":{{\"x\":{6},\"y\":{7},\"width\":{8},\"height\":{9}}}}}",
                                EscapeJson(winTitle),
                                EscapeJson(n),
                                EscapeJson(controlType),
                                EscapeJson(aid),
                                EscapeJson(cls),
                                el.Current.IsEnabled ? "true" : "false",
                                (int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height
                            ));
                        } catch { }
                    }
                }
            } catch (Exception ex) {
                sb.Clear();
                sb.Append("{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}");
                return;
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        if (sb.ToString().StartsWith("{\"ok\":true")) sb.Append("]}");
        return sb.ToString();
    }

    public static string GetControlMap(string titleMatch, int maxElements) {
        var sb = new StringBuilder();
        sb.Append("{\"ok\":true,\"controls\":[");
        bool first = true;

        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) {
                sb.Clear();
                sb.Append("{\"ok\":false,\"error\":\"Cannot open default desktop\"}");
                return;
            }
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                sb.Clear();
                sb.Append("{\"ok\":false,\"error\":\"Cannot set thread desktop\"}");
                return;
            }

            try {
                AutomationElement root = AutomationElement.RootElement;
                AutomationElement targetWin = null;
                var windows = root.FindAll(TreeScope.Children, Condition.TrueCondition);
                for (int i = 0; i < windows.Count; i++) {
                    var w = windows[i];
                    string n = w.Current.Name ?? "";
                    if (n.IndexOf(titleMatch, StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetWin = w;
                        break;
                    }
                }

                if (targetWin == null) {
                    sb.Clear();
                    sb.Append("{\"ok\":false,\"error\":\"Target window not found matching '" + EscapeJsonRaw(titleMatch) + "'\"}");
                    return;
                }

                var descendants = targetWin.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                int limit = Math.Min(maxElements, descendants.Count);
                for (int i = 0; i < limit; i++) {
                    var el = descendants[i];
                    try {
                        string name = el.Current.Name ?? "";
                        string controlType = el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
                        string autoId = el.Current.AutomationId ?? "";
                        string className = el.Current.ClassName ?? "";
                        bool isEnabled = el.Current.IsEnabled;
                        bool isPassword = el.Current.IsPassword;
                        var rect = el.Current.BoundingRectangle;

                        if (!first) sb.Append(",");
                        first = false;
                        sb.Append(string.Format(
                            "{{\"index\":{0},\"name\":{1},\"controlType\":{2},\"automationId\":{3},\"className\":{4},\"isEnabled\":{5},\"isPassword\":{6},\"rect\":{{\"x\":{7},\"y\":{8},\"width\":{9},\"height\":{10}}}}}",
                            i,
                            EscapeJson(name),
                            EscapeJson(controlType),
                            EscapeJson(autoId),
                            EscapeJson(className),
                            isEnabled ? "true" : "false",
                            isPassword ? "true" : "false",
                            (int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height
                        ));
                    } catch {
                        // Skip elements that became invalid during enumeration
                    }
                }
            } catch (Exception ex) {
                sb.Clear();
                sb.Append("{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}");
                return;
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        if (sb.ToString().StartsWith("{\"ok\":true")) {
            sb.Append("]}");
        }
        return sb.ToString();
    }

    public static string InvokeControl(string titleMatch, string targetName, string targetAutoId, string targetType) {
        string result = "{\"ok\":false,\"error\":\"Unknown error\"}";

        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) { result = "{\"ok\":false,\"error\":\"Cannot open default desktop\"}"; return; }
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); result = "{\"ok\":false,\"error\":\"Cannot set thread desktop\"}"; return; }

            try {
                AutomationElement root = AutomationElement.RootElement;
                AutomationElement targetWin = null;
                var windows = root.FindAll(TreeScope.Children, Condition.TrueCondition);
                for (int i = 0; i < windows.Count; i++) {
                    var w = windows[i];
                    string n = w.Current.Name ?? "";
                    if (n.IndexOf(titleMatch, StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetWin = w;
                        break;
                    }
                }

                if (targetWin == null) {
                    result = "{\"ok\":false,\"error\":\"Target window not found\"}";
                    return;
                }

                // Bring to foreground
                IntPtr hWnd = (IntPtr)targetWin.Current.NativeWindowHandle;
                if (hWnd != IntPtr.Zero) {
                    ShowWindowAsync(hWnd, 9); // SW_RESTORE
                    SetForegroundWindow(hWnd);
                    Thread.Sleep(50);
                }

                var descendants = targetWin.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                AutomationElement found = null;
                for (int i = 0; i < descendants.Count; i++) {
                    var el = descendants[i];
                    string n = el.Current.Name ?? "";
                    string aid = el.Current.AutomationId ?? "";
                    string ct = el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");

                    bool matchName = string.IsNullOrEmpty(targetName) || n.IndexOf(targetName, StringComparison.OrdinalIgnoreCase) >= 0;
                    bool matchId = string.IsNullOrEmpty(targetAutoId) || aid.Equals(targetAutoId, StringComparison.OrdinalIgnoreCase);
                    bool matchType = string.IsNullOrEmpty(targetType) || ct.IndexOf(targetType, StringComparison.OrdinalIgnoreCase) >= 0;

                    if (matchName && matchId && matchType) {
                        found = el;
                        break;
                    }
                }

                if (found == null) {
                    result = "{\"ok\":false,\"error\":\"Control not found matching criteria\"}";
                    return;
                }

                // Try semantic pattern activation
                string method = "none";
                object patternObj;
                if (found.TryGetCurrentPattern(InvokePattern.Pattern, out patternObj)) {
                    ((InvokePattern)patternObj).Invoke();
                    method = "InvokePattern";
                } else if (found.TryGetCurrentPattern(TogglePattern.Pattern, out patternObj)) {
                    ((TogglePattern)patternObj).Toggle();
                    method = "TogglePattern";
                } else if (found.TryGetCurrentPattern(SelectionItemPattern.Pattern, out patternObj)) {
                    ((SelectionItemPattern)patternObj).Select();
                    method = "SelectionItemPattern";
                } else {
                    // Fallback to coordinates click
                    var rect = found.Current.BoundingRectangle;
                    if (rect.Width > 0 && rect.Height > 0) {
                        int cx = (int)(rect.X + rect.Width / 2);
                        int cy = (int)(rect.Y + rect.Height / 2);
                        SetCursorPos(cx, cy);
                        Thread.Sleep(30);
                        mouse_event(0x0002, 0, 0, 0, 0); // down
                        Thread.Sleep(30);
                        mouse_event(0x0004, 0, 0, 0, 0); // up
                        method = "CoordinateClickFallback";
                    } else {
                        found.SetFocus();
                        method = "SetFocus";
                    }
                }

                result = string.Format(
                    "{{\"ok\":true,\"method\":{0},\"element\":{{\"name\":{1},\"controlType\":{2},\"automationId\":{3}}}}}",
                    EscapeJson(method),
                    EscapeJson(found.Current.Name ?? ""),
                    EscapeJson(found.Current.ControlType.ProgrammaticName.Replace("ControlType.", "")),
                    EscapeJson(found.Current.AutomationId ?? "")
                );

            } catch (Exception ex) {
                result = "{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}";
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        return result;
    }

    public static string SetControlValue(string titleMatch, string targetName, string targetAutoId, string valueText) {
        string result = "{\"ok\":false,\"error\":\"Unknown error\"}";

        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) { result = "{\"ok\":false,\"error\":\"Cannot open default desktop\"}"; return; }
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); result = "{\"ok\":false,\"error\":\"Cannot set thread desktop\"}"; return; }

            try {
                AutomationElement root = AutomationElement.RootElement;
                AutomationElement targetWin = null;
                var windows = root.FindAll(TreeScope.Children, Condition.TrueCondition);
                for (int i = 0; i < windows.Count; i++) {
                    var w = windows[i];
                    string n = w.Current.Name ?? "";
                    if (n.IndexOf(titleMatch, StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetWin = w;
                        break;
                    }
                }

                if (targetWin == null) {
                    result = "{\"ok\":false,\"error\":\"Target window not found\"}";
                    return;
                }

                var descendants = targetWin.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                AutomationElement found = null;
                for (int i = 0; i < descendants.Count; i++) {
                    var el = descendants[i];
                    string n = el.Current.Name ?? "";
                    string aid = el.Current.AutomationId ?? "";

                    bool matchName = string.IsNullOrEmpty(targetName) || n.IndexOf(targetName, StringComparison.OrdinalIgnoreCase) >= 0;
                    bool matchId = string.IsNullOrEmpty(targetAutoId) || aid.Equals(targetAutoId, StringComparison.OrdinalIgnoreCase);

                    if (matchName && matchId) {
                        found = el;
                        break;
                    }
                }

                if (found == null) {
                    result = "{\"ok\":false,\"error\":\"Control not found\"}";
                    return;
                }

                string method = "ValuePattern";
                object valObj;
                if (found.TryGetCurrentPattern(ValuePattern.Pattern, out valObj)) {
                    ((ValuePattern)valObj).SetValue(valueText);
                } else {
                    found.SetFocus();
                    Thread.Sleep(50);
                    System.Windows.Forms.SendKeys.SendWait("^a{BACKSPACE}");
                    System.Windows.Forms.SendKeys.SendWait(valueText.Replace("{", "{{}").Replace("}", "{}}"));
                    method = "SendKeysFallback";
                }

                result = string.Format(
                    "{{\"ok\":true,\"method\":{0},\"element\":{{\"name\":{1},\"isPassword\":{2}}}}}",
                    EscapeJson(method),
                    EscapeJson(found.Current.Name ?? ""),
                    found.Current.IsPassword ? "true" : "false"
                );
            } catch (Exception ex) {
                result = "{\"ok\":false,\"error\":" + EscapeJson(ex.Message) + "}";
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();

        return result;
    }

    private static string EscapeJson(string s) {
        if (s == null) return "\"\"";
        return "\"" + EscapeJsonRaw(s) + "\"";
    }

    private static string EscapeJsonRaw(string s) {
        if (s == null) return "";
        return s.Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n")
                .Replace("\t", "\\t");
    }
}
'@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "WindowsBase", "System.Windows.Forms", "System.Drawing", "UIAutomationClient", "UIAutomationTypes"

switch ($Command) {
    "list_windows" {
        [UiaNativeRunner]::ListWindows()
    }
    "get_controls" {
        $max = 150
        if ($Param2) { [int]::TryParse($Param2, [ref]$max) | Out-Null }
        [UiaNativeRunner]::GetControlMap($Param1, $max)
    }
    "invoke_control" {
        # Param1 = titleMatch, Param2 = targetName, Param3 = targetAutoId, Param4 = targetType
        [UiaNativeRunner]::InvokeControl($Param1, $Param2, $Param3, $Param4)
    }
    "set_value" {
        # Param1 = titleMatch, Param2 = targetName, Param3 = targetAutoId, Param4 = valueText
        [UiaNativeRunner]::SetControlValue($Param1, $Param2, $Param3, $Param4)
    }
    "foreground" {
        [UiaNativeRunner]::GetForeground()
    }
    "monitors" {
        [UiaNativeRunner]::GetMonitors()
    }
    "window_action" {
        # Param1 = handle, Param2 = action, Param3 = x, Param4 = y, Param5 = width, Param6 = height
        $h = [int64]0
        if (-not [int64]::TryParse($Param1, [ref]$h)) { '{"ok":false,"error":"Invalid handle"}'; break }
        $x = 0; $y = 0; $w = 0; $hgt = 0
        [int]::TryParse($Param3, [ref]$x) | Out-Null
        [int]::TryParse($Param4, [ref]$y) | Out-Null
        [int]::TryParse($Param5, [ref]$w) | Out-Null
        [int]::TryParse($Param6, [ref]$hgt) | Out-Null
        [UiaNativeRunner]::WindowAction($h, $Param2, $x, $y, $w, $hgt)
    }
    "focused" {
        [UiaNativeRunner]::GetFocusedElement()
    }
    "find_element" {
        # Param1 = query, Param2 = max results
        $max = 10
        if ($Param2) { [int]::TryParse($Param2, [ref]$max) | Out-Null }
        [UiaNativeRunner]::FindElement($Param1, $max)
    }
    default {
        "{`"ok`":false,`"error`":`"Unknown command $Command`"}"
    }
}
