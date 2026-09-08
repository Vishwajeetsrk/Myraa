'use strict';

const { exec, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');

function checkHttpPort(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

const DiagnosticsEngine = {
  async runFullDiagnostics() {
    const report = {
      timestamp: new Date().toISOString(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(os.uptime()),
      systemMemory: {
        totalGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
        freeGB: (os.freemem() / (1024 ** 3)).toFixed(1),
        processRssMB: (process.memoryUsage().rss / (1024 ** 2)).toFixed(1)
      },
      checks: {},
      autoFixSuggestions: []
    };

    // 1. Port Checks
    report.checks.port3000_core = await checkHttpPort(3000);
    report.checks.port8765_desktop_agent = await checkHttpPort(8765);
    report.checks.port8766_observer = await checkHttpPort(8766);

    // 2. Real ADB Probe
    try {
      const adbOutput = execSync('adb devices', { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const lines = adbOutput.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('List of devices'));
      report.checks.adbInstalled = true;
      report.checks.connectedAdbDevices = lines.length;
      report.checks.adbDevicesList = lines;
    } catch (e) {
      report.checks.adbInstalled = false;
      report.checks.connectedAdbDevices = 0;
      report.checks.adbDevicesList = [];
    }

    // 3. Wi-Fi & Network Probe
    try {
      const netOutput = execSync('netsh wlan show interfaces', { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const ssidMatch = netOutput.match(/SSID\s*:\s*(.+)/);
      const stateMatch = netOutput.match(/State\s*:\s*(.+)/);
      report.checks.wifiConnected = stateMatch ? stateMatch[1].trim().toLowerCase() === 'connected' : false;
      report.checks.wifiSSID = ssidMatch ? ssidMatch[1].trim() : 'N/A';
    } catch {
      report.checks.wifiConnected = false;
      report.checks.wifiSSID = 'N/A';
    }

    // 4. API Key Check
    let hasKey = Boolean(process.env.GEMINI_API_KEY);
    const settingsPath = path.join(__dirname, '..', '.myraa-data', 'settings.json');
    if (!hasKey && fs.existsSync(settingsPath)) {
      try {
        const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (s.geminiApiKey || s.apiKey) hasKey = true;
      } catch {}
    }
    report.checks.geminiApiKeyConfigured = hasKey;

    // 5. Synthesize Health Status & Auto-Fix Suggestions
    if (!report.checks.port8765_desktop_agent) {
      report.autoFixSuggestions.push({
        issue: 'Desktop control agent offline on port 8765',
        action: 'Native Win32 PowerShell automation is active as automatic local fallback.'
      });
    }
    if (!report.checks.geminiApiKeyConfigured) {
      report.autoFixSuggestions.push({
        issue: 'Gemini API Key missing',
        action: 'Configure in Settings > Voice or General to enable Gemini Live multimodal voice.'
      });
    }
    if (report.checks.connectedAdbDevices === 0) {
      report.autoFixSuggestions.push({
        issue: 'No Mobile ADB Device connected',
        action: 'Connect phone via USB with USB Debugging enabled, or pair via Wi-Fi Companion.'
      });
    }

    report.overallHealth = report.checks.geminiApiKeyConfigured && report.checks.wifiConnected ? 'HEALTHY' : 'NEEDS_ATTENTION';

    return report;
  }
};

module.exports = DiagnosticsEngine;
