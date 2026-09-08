Add-Type @"
  using System;
  using System.Text;
  using System.Runtime.InteropServices;

  public class WinFinder2 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
  }
"@

[WinFinder2]::EnumWindows({
  param($hwnd, $lparam)
  [uint32]$pId = 0
  $null = [WinFinder2]::GetWindowThreadProcessId($hwnd, [ref]$pId)
  $sb = New-Object System.Text.StringBuilder 256
  $null = [WinFinder2]::GetWindowText($hwnd, $sb, 256)
  $title = $sb.ToString()
  $vis = [WinFinder2]::IsWindowVisible($hwnd)

  $proc = Get-Process -Id $pId -ErrorAction SilentlyContinue
  if ($proc -and ($proc.ProcessName -like '*MYRAA*' -or $proc.ProcessName -like '*electron*')) {
    [Console]::WriteLine("HWND: {0} | PID: {1} ({2}) | Visible: {3} | Title: '{4}'", $hwnd, $pId, $proc.ProcessName, $vis, $title)
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
