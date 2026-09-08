/**
 * =============================================================================
 * MYRAA AI OS — Visual Computer Control & Advanced OS Engine
 * =============================================================================
 * Inspired by Brahma-AI:
 *   - Natural Language Screen Element Finder via Gemini Vision (screen_find)
 *   - Vision-driven Screen Clicking without hardcoded coordinates (screen_click)
 *   - On-screen Compiler & Terminal Error Debugger (screen_debug)
 *   - Smart Form Typing with field auto-clearing & clipboard acceleration (smart_type)
 *   - Form Mock Profile & Random Data Generator (generate_random_data)
 *   - Windows Hardware & Window Controls (snap left/right, F11, Task View)
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const desktop = require('./desktopAutomation.cjs');

// Path candidates for secrets & environment
const appData = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library/Application Support')
  : path.join(process.env.HOME || '', '.config'));
const secretsPath = path.join(appData, 'MYRAA', 'secrets.json');

function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (fs.existsSync(secretsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      if (data.geminiApiKey && data.geminiApiKey.trim()) return data.geminiApiKey.trim();
    } catch (e) {}
  }
  return '';
}

function runPowerShell(script, timeoutMs = 6000) {
  try {
    const fullScript = `$ProgressPreference = 'SilentlyContinue';\n` + script;
    const b64 = Buffer.from(fullScript, 'utf16le').toString('base64');
    return execSync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${b64}`, {
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true
    }).trim();
  } catch (err) {
    return `ERROR: ${err.message || err}`;
  }
}

// Random Realistic Data Generator Dictionary
const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Drew", "Quinn", "Avery", "Blake", "Cameron", "Dakota", "Vishwajeet", "Ethan", "Lucas"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor", "Kumar", "Sharma", "Anderson"];
const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "proton.me", "myraa.ai"];

class VisualComputerControl {
  constructor() {}

  /**
   * Generates realistic mock data for automated form filling
   */
  generateRandomData(type = 'name') {
    const dt = String(type || 'name').toLowerCase().trim();
    const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    switch (dt) {
      case 'first_name':
        return randItem(FIRST_NAMES);
      case 'last_name':
        return randItem(LAST_NAMES);
      case 'name':
      case 'full_name':
        return `${randItem(FIRST_NAMES)} ${randItem(LAST_NAMES)}`;
      case 'email': {
        const fn = randItem(FIRST_NAMES).toLowerCase();
        const ln = randItem(LAST_NAMES).toLowerCase();
        const num = randInt(10, 999);
        return `${fn}.${ln}${num}@${randItem(DOMAINS)}`;
      }
      case 'username': {
        const fn = randItem(FIRST_NAMES).toLowerCase();
        return `${fn}_${randInt(100, 9999)}`;
      }
      case 'password': {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const syms = '!@#$%^&*';
        let pwd = randItem(letters.toUpperCase()) + randItem(nums) + randItem(syms);
        for (let i = 0; i < 9; i++) pwd += randItem(letters + nums + syms);
        return pwd;
      }
      case 'phone':
        return `+1${randInt(200, 999)}${randInt(1000000, 9999999)}`;
      case 'address': {
        const street = randItem(["Main St", "Grand Ave", "Parkway Blvd", "Oak Lane", "Innovation Way"]);
        return `${randInt(100, 9999)} ${street}`;
      }
      case 'city':
        return randItem(["San Francisco", "New York", "Austin", "Seattle", "Chicago", "Boston"]);
      case 'zip_code':
        return String(randInt(10001, 99950));
      default:
        return `mock_${dt}_${randInt(1000, 9999)}`;
    }
  }

  /**
   * Clears field and smart types text using clipboard for long strings
   */
  smartType(text, options = {}) {
    const toType = String(text || '');
    const clearFirst = options.clearFirst !== false;

    if (clearFirst) {
      // Select All + Delete
      desktop.hotkey('ctrl+a');
      const sleepScript = 'Start-Sleep -Milliseconds 120; [System.Windows.Forms.SendKeys]::SendWait("{DELETE}")';
      runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; ${sleepScript}`);
    }

    // If text is long (>25 chars) or multi-line, use clipboard injection
    if (toType.length > 25 || toType.includes('\n')) {
      desktop.setClipboard(toType);
      desktop.hotkey('ctrl+v');
      return { ok: true, method: 'clipboard_paste', textLength: toType.length, preview: toType.slice(0, 60) };
    } else {
      desktop.typeText(toType);
      return { ok: true, method: 'keyboard_type', textLength: toType.length, preview: toType };
    }
  }

  /**
   * Locates any described UI element on the desktop screen using Gemini Vision
   * Returns exact (x, y) center pixel coordinates.
   */
  async screenFind(description) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return { ok: false, error: 'GEMINI_API_KEY is not configured in secrets.json or environment' };
    }

    const snap = desktop.takeScreenshot();
    if (!snap.ok || !snap.image) {
      return { ok: false, error: 'Failed to capture desktop screenshot' };
    }

    const base64Data = snap.image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `This is a screenshot of the user's primary computer screen.
Locate the element described as: "${description}".
Return ONLY the approximate center pixel coordinates of this element in the EXACT format:
x,y
Example:
450,210
If the element is not visible or cannot be found, reply ONLY:
NOT_FOUND`;

    try {
      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Gemini Vision HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (!rawText || rawText.includes('NOT_FOUND')) {
        return { ok: false, description, notFound: true, message: `Element "${description}" was not found on screen.` };
      }

      const match = rawText.match(/(\d+)\s*,\s*(\d+)/);
      if (match) {
        const x = parseInt(match[1], 10);
        const y = parseInt(match[2], 10);
        return {
          ok: true,
          description,
          x,
          y,
          confidence: 'high',
          message: `Located "${description}" at (${x}, ${y})`
        };
      }

      return { ok: false, error: `Could not parse coordinates from model response: "${rawText}"` };
    } catch (err) {
      return { ok: false, error: `Screen visual analysis failed: ${err.message}` };
    }
  }

  /**
   * Finds described element via screenFind and immediately executes a mouse click
   */
  async screenClick(description, options = {}) {
    const loc = await this.screenFind(description);
    if (!loc.ok) return loc;

    const button = options.button || 'left';
    const clicks = options.clicks || 1;

    if (clicks === 2) {
      desktop.doubleClick(loc.x, loc.y);
    } else {
      desktop.click(loc.x, loc.y, button);
    }

    return {
      ok: true,
      description,
      x: loc.x,
      y: loc.y,
      button,
      clicks,
      message: `Successfully clicked "${description}" at coordinates (${loc.x}, ${loc.y})`
    };
  }

  /**
   * Takes a screenshot of on-screen code / compiler terminal and diagnoses error with Gemini Vision
   */
  async screenDebug() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY is not configured' };

    const snap = desktop.takeScreenshot();
    if (!snap.ok || !snap.image) return { ok: false, error: 'Failed to capture screenshot' };

    const base64Data = snap.image.replace(/^data:image\/\w+;base64,/, '');
    const prompt = `Analyze this screen for active compiler errors, terminal exceptions, stack traces, or broken code.
Provide a clear analysis formatted as:
1. Error Detected: (Summary of the error)
2. Culprit File & Line: (if visible)
3. Root Cause: (Why it broke)
4. Proposed Drop-in Fix: (Exact corrected code snippet)`;

    try {
      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Data } },
              { text: prompt }
            ]
          }
        ],
        generationConfig: { temperature: 0.2 }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Gemini Vision HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No errors detected on screen.';

      return {
        ok: true,
        analysis,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return { ok: false, error: `Screen debug failed: ${err.message}` };
    }
  }

  // ── ADVANCED WINDOWS OS CONTROLS ──────────────────────────────────────────
  snapLeft() {
    desktop.hotkey('win+left');
    return { ok: true, message: 'Window snapped to left half' };
  }

  snapRight() {
    desktop.hotkey('win+right');
    return { ok: true, message: 'Window snapped to right half' };
  }

  fullScreen() {
    desktop.pressKey('f11');
    return { ok: true, message: 'Toggled fullscreen mode (F11)' };
  }

  taskView() {
    desktop.hotkey('win+tab');
    return { ok: true, message: 'Opened Windows Task View' };
  }

  taskManager() {
    desktop.hotkey('ctrl+shift+esc');
    return { ok: true, message: 'Opened Windows Task Manager' };
  }

  zoomIn() {
    desktop.hotkey('ctrl+=');
    return { ok: true, message: 'Zoomed in' };
  }

  zoomOut() {
    desktop.hotkey('ctrl+-');
    return { ok: true, message: 'Zoomed out' };
  }

  zoomReset() {
    desktop.hotkey('ctrl+0');
    return { ok: true, message: 'Reset zoom level' };
  }

  refreshPage() {
    desktop.pressKey('f5');
    return { ok: true, message: 'Refreshed current page' };
  }
}

module.exports = new VisualComputerControl();
