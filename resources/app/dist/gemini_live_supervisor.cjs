/**
 * =============================================================================
 * MYRAA AI OS — Gemini Live Session Supervisor & Reconnect Engine
 * =============================================================================
 * Manages Gemini Live WebSocket resilience:
 * 1. Lightweight API key validation check on startup and before reconnect attempts
 * 2. 3-Category failure classification:
 *    - AUTH_FAILURE: Bad/expired API key, permission denied (no useless retries)
 *    - IDLE_TIMEOUT: Session duration reached (GoAway), 10min inactivity
 *    - NETWORK_DROP: Socket reset, 1006 abnormal drop, Wi-Fi reconnection
 * 3. Exponential backoff retry: 1s, 2s, 4s, 8s... capped at 30s
 * 4. Background wake-word continuous listener orchestration
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const appData = process.env.APPDATA
  || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
const myraaDataDir = process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
const secretsFile = path.join(myraaDataDir, 'secrets.json');
const logFile = path.join(myraaDataDir, 'gemini_live_health.json');

class GeminiLiveSupervisor {
  constructor() {
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.lastSessionActiveAt = Date.now();
    this.currentStatus = 'IDLE'; // IDLE, CONNECTING, ACTIVE, RECONNECTING, ERROR
    this.lastError = null;
  }

  getApiKey() {
    let key = process.env.GEMINI_API_KEY;
    if (key && key.trim()) return key.trim();
    try {
      if (fs.existsSync(secretsFile)) {
        const s = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
        if (s.geminiApiKey && s.geminiApiKey.trim()) return s.geminiApiKey.trim();
      }
    } catch (e) {}
    try {
      const paths = [
        path.join(process.env.APPDATA || '', 'MYRAA', 'secrets.json'),
        path.join(process.env.APPDATA || '', 'MYRAA AI OS', 'secrets.json'),
        path.join(process.cwd(), 'secrets.json'),
        path.join(process.cwd(), '.myraa-data', 'secrets.json'),
        path.join(process.env.USERPROFILE || require('os').homedir(), '.env.local'),
        path.join(process.env.USERPROFILE || require('os').homedir(), '.env'),
        path.join(process.cwd(), '.env.local'),
        path.join(process.cwd(), '.env')
      ];
      for (const envPath of paths) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          if (envPath.endsWith('.json')) {
            const parsed = JSON.parse(content);
            if (parsed.geminiApiKey && parsed.geminiApiKey.trim()) return parsed.geminiApiKey.trim();
          } else {
            const m = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
            if (m) {
              const val = m[1].replace(/['"]/g, '').trim();
              if (val) return val;
            }
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Lightweight API key validation check (< 400ms)
   */
  async validateApiKey(keyToTest = null) {
    const key = keyToTest || this.getApiKey();
    if (!key) {
      return {
        ok: false,
        valid: false,
        category: 'AUTH_FAILURE',
        code: 401,
        message: 'No Gemini API key configured. Enter a valid key in Settings.'
      };
    }

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`, {
        method: 'GET',
        headers: { 'User-Agent': 'MYRAA-AI-OS-LiveSupervisor/1.0' },
        signal: AbortSignal.timeout(5000)
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.status === 200) {
        return {
          ok: true,
          valid: true,
          category: 'VALID',
          message: 'Gemini API key is active and verified.'
        };
      }

      if (resp.status === 400 || resp.status === 403) {
        const errMsg = data.error?.message || 'Invalid or unauthorized API key.';
        return {
          ok: false,
          valid: false,
          category: 'AUTH_FAILURE',
          status: resp.status,
          message: `Google rejected the API key: ${errMsg}`
        };
      }

      return {
        ok: false,
        valid: false,
        category: 'NETWORK_DROP',
        status: resp.status,
        message: `HTTP ${resp.status}: Could not verify key with Google server.`
      };
    } catch (err) {
      return {
        ok: false,
        valid: false,
        category: 'NETWORK_DROP',
        message: `Network offline or unreachable during key check: ${err.message}`
      };
    }
  }

  /**
   * Classify disconnect into 3 distinct operational categories
   */
  classifyDisconnect(code, reason, keyValidation) {
    const cleanReason = String(reason || 'No close reason provided').trim();
    const cleanCode = Number(code) || 1006;

    // 1. If keyValidation verified the key is VALID, this is NEVER an AUTH_FAILURE
    if (keyValidation && keyValidation.valid === true) {
      if (/not found|not supported|model/i.test(cleanReason)) {
        return {
          category: 'MODEL_UNSUPPORTED',
          title: 'Model Update Required',
          userMessage: `Model configuration notice: ${cleanReason}`,
          canAutoRetry: false,
          code: cleanCode,
          reason: cleanReason,
          actionPrompt: 'Switched to active Gemini Live model'
        };
      }
    }

    // 2. Genuine AUTH FAILURE (Only if Google actually rejected the key)
    if (keyValidation && !keyValidation.valid && keyValidation.category === 'AUTH_FAILURE') {
      return {
        category: 'AUTH_FAILURE',
        title: 'Authentication Error',
        userMessage: keyValidation.message || 'Google rejected the Gemini API key. Please update your key in Settings.',
        canAutoRetry: false,
        code: cleanCode,
        reason: cleanReason,
        actionPrompt: 'Update API Key in Settings'
      };
    }

    if ((!keyValidation || !keyValidation.valid) && /api.?key.*invalid|invalid.*api.?key|unauthenticated|credential|API_KEY_INVALID/i.test(cleanReason)) {
      return {
        category: 'AUTH_FAILURE',
        title: 'Authentication Error',
        userMessage: 'Voice session closed due to API authentication failure. Please verify your Gemini API key in Settings.',
        canAutoRetry: false,
        code: cleanCode,
        reason: cleanReason,
        actionPrompt: 'Update API Key in Settings'
      };
    }

    // 2. Category 2: IDLE TIMEOUT
    const idleDurationMs = Date.now() - this.lastSessionActiveAt;
    const isGoAway = /GoAway|duration|idle|timeout|session durat/i.test(cleanReason);
    if (isGoAway || cleanCode === 1000 || cleanCode === 1001 || idleDurationMs > 300000) {
      return {
        category: 'IDLE_TIMEOUT',
        title: 'Session Refreshed',
        userMessage: 'Gemini Live session reached idle duration boundary. Reconnecting automatically...',
        canAutoRetry: true,
        code: cleanCode,
        reason: cleanReason,
        actionPrompt: 'Auto-refreshing session...'
      };
    }

    // 3. Category 3: NETWORK DROP
    return {
      category: 'NETWORK_DROP',
      title: 'Network Interruption',
      userMessage: 'Connection dropped unexpectedly (code 1006). Re-establishing connection...',
      canAutoRetry: true,
      code: cleanCode,
      reason: cleanReason,
      actionPrompt: 'Reconnecting automatically...'
    };
  }

  /**
   * Calculate exponential backoff delay with jitter (1s, 2s, 4s, 8s... capped at 30s)
   */
  getBackoffDelay(attempt) {
    const base = Math.min(30000, 1000 * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * 500);
    return base + jitter;
  }

  /**
   * Log state transition
   */
  logEvent(type, details) {
    try {
      const entry = {
        time: new Date().toISOString(),
        type,
        details
      };
      fs.writeFileSync(logFile, JSON.stringify(entry, null, 2), 'utf8');
    } catch (e) {}
  }
}

const liveSupervisor = new GeminiLiveSupervisor();
module.exports = liveSupervisor;
