const { execSync } = require('child_process');

function runPS(script) {
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${b64}`, { encoding: 'utf8' }).trim();
}

console.log('Testing Windows native automation via PowerShell EncodedCommand...');

// Test 1: Get cursor position
const script1 = `
Add-Type -AssemblyName System.Windows.Forms
$p = [System.Windows.Forms.Cursor]::Position
Write-Output "$($p.X),$($p.Y)"
`;
const pos = runPS(script1);
console.log('[PASS] Cursor position:', pos);

// Test 2: Screen resolution
const script2 = `
Add-Type -AssemblyName System.Windows.Forms
$s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "$($s.Width)x$($s.Height)"
`;
const res = runPS(script2);
console.log('[PASS] Screen resolution:', res);

// Test 3: List open windows
const script3 = `
Get-Process | Where-Object { $_.MainWindowTitle.Length -gt 0 } | Select-Object -First 5 -Property ProcessName, MainWindowTitle | ConvertTo-Json
`;
const wins = runPS(script3);
console.log('[PASS] Visible windows sample:\n', wins);
