const { execSync } = require('child_process');

function runPS(script) {
  const full = `$ProgressPreference = 'SilentlyContinue';\n` + script;
  const b64 = Buffer.from(full, 'utf16le').toString('base64');
  const out = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${b64}`, { encoding: 'utf8' }).trim();
  // Filter out CLIXML if present
  return out.replace(/#<\s*CLIXML[\s\S]*?<\/Objs>/g, '').trim();
}

const testScript = `
$csharp = @'
using System;
using System.Runtime.InteropServices;
public static class WinAPI {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@
Add-Type -TypeDefinition $csharp -ErrorAction SilentlyContinue

[WinAPI]::SetCursorPos(400, 300) | Out-Null
Add-Type -AssemblyName System.Windows.Forms
$p = [System.Windows.Forms.Cursor]::Position
Write-Output "Moved cursor to: $($p.X),$($p.Y)"
`;

const res = runPS(testScript);
console.log('Result:', res);
