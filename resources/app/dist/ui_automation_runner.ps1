# =============================================================================
# MYRAA AI OS — Native Windows UI Automation Runner (v1.0 APEX)
# =============================================================================
param(
    [string]$Command = "list_windows",
    [string]$Param1 = "",
    [string]$Param2 = "",
    [string]$Param3 = "",
    [string]$Param4 = ""
)

$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms

$csharp = @'
using System;
using System.Collections.Generic;
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

    const uint DESKTOP_ALL = 0x01FF;

    public static string ListWindows() {
        var sb = new StringBuilder();
        sb.Append("[");
        bool first = true;

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
                            uint pid;
                            GetWindowThreadProcessId(hWnd, out pid);
                            StringBuilder classSb = new StringBuilder(256);
                            GetClassName(hWnd, classSb, 256);

                            if (!first) sb.Append(",");
                            first = false;
                            sb.Append(string.Format("{{\"id\":{0},\"title\":{1},\"className\":{2},\"handle\":{3}}}",
                                pid,
                                EscapeJson(title),
                                EscapeJson(classSb.ToString()),
                                (long)hWnd));
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

Add-Type -TypeDefinition $csharp -ReferencedAssemblies "WindowsBase", "System.Windows.Forms", "UIAutomationClient", "UIAutomationTypes"

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
    default {
        "{`"ok`":false,`"error`":`"Unknown command $Command`"}"
    }
}
