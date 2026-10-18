/* ===========================================================================
 * MYRAA AI OS — Server Security Layer (P0 hardening, Phase 1 stabilization)
 * ---------------------------------------------------------------------------
 * Adds, without breaking existing flows:
 *   1. Security response headers                 (X-Content-Type-Options, etc.)
 *   2. Per-IP rate limiting for /api             (tighten on sensitive paths)
 *   3. LAN guard for SENSITIVE endpoints         (loopback stays open;
 *                                                 remote needs pair deviceToken)
 *
 * Loopback (127.0.0.1 / ::1) is ALWAYS allowed — the desktop app, React UI,
 * and Tauri bridge all talk to http://127.0.0.1:3000.
 *
 * Opt-out (troubleshooting only, logs a warning):
 *   MYRAA_SECURITY_DISABLED=1  disable headers + rate limit + LAN guard
 *   MYRAA_INSECURE_LAN=1       keep security, but allow LAN w/o token
 * ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const appData = process.env.APPDATA
  || (process.platform === 'darwin'
    ? path.join(process.env.HOME, 'Library/Application Support')
    : path.join(process.env.HOME, '.config'));
const myraaDataDir = process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
const trustedDevicesFile = path.join(myraaDataDir, 'trusted_devices.json');

// Endpoints that can execute/delete/modify/transact. Tight rate limit (60/min)
// applies to these for EVERY client, loopback included.
const SENSITIVE_PREFIXES = [
  '/api/terminal',
  '/api/vault',
  '/api/update',
  '/api/system/control',
  '/api/system/power',
  '/api/fs/edit',
  '/api/fs/manage',
  '/api/fs/write',
  '/api/generate-app',
  '/api/chat',
  '/api/desktop/control',
  '/api/self-improvement',
  '/api/agent-health',
  '/api/office',
  '/api/computer',
  '/api/voice',
  '/api/proxy',
  '/api/web-proxy',
  '/api/skills/execute',
];

// Everything that MUST carry a paired-device token when called from the LAN
// (= the sensitive list PLUS the phone control surface: mobile commands, MCP
// tool calls, and remote pairing-protected endpoints).
const AUTH_REQUIRED_PREFIXES = [
  ...SENSITIVE_PREFIXES,
  '/api/remote/',
  '/api/mobile/',
  '/api/mcp/v1/tools/call',
];

// Bootstrap pairing endpoints — reachable WITHOUT a token (they ARE the way a
// phone becomes trusted). They carry their own one-time-code protection.
const BOOTSTRAP_PREFIXES = ['/api/remote/pairing-info', '/api/remote/pair'];

function needsToken(p) {
  if (!AUTH_REQUIRED_PREFIXES.some((pfx) => p.startsWith(pfx))) return false;
  if (BOOTSTRAP_PREFIXES.some((pfx) => p === pfx || p.startsWith(pfx))) return false;
  return true;
}

function isLoopback(remote) {
  const ip = String(remote || '')
    .replace(/^::ffff:/, '')
    .replace(/\[([^\]]+)\]/, '$1');
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0';
}

function currentOrDefault(ip) { return isLoopback(ip) ? 'loopback' : ip; }

function loadTrustedTokens() {
  try {
    if (!fs.existsSync(trustedDevicesFile)) return new Set();
    const data = JSON.parse(fs.readFileSync(trustedDevicesFile, 'utf8'));
    const tokens = new Set();
    for (const d of (data.devices || [])) if (d && d.token) tokens.add(d.token);
    return tokens;
  } catch (e) { return new Set(); }
}

function extractToken(req) {
  const h = req.headers['x-myraa-token'] || req.headers['x-pair-token'];
  if (h) return String(h).trim();
  const q = req.query && req.query.deviceToken;
  if (q) return String(q).trim();
  // body-based token (JSON bodies) — used by some remote flows
  if (req.body && typeof req.body === 'object' && req.body.deviceToken) return String(req.body.deviceToken).trim();
  return '';
}

function isSensitive(p) { return SENSITIVE_PREFIXES.some((pfx) => p.startsWith(pfx)); }

// --- rate limiter -----------------------------------------------------------
class RateLimiter {
  constructor() { this.buckets = new Map(); }
  hit(ip, limit, windowMs, now) {
    let b = this.buckets.get(ip);
    if (!b || now - b.start >= windowMs) {
      this.buckets.set(ip, { start: now, count: 1 });
      return { allowed: true, remaining: limit - 1 };
    }
    b.count += 1;
    return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count) };
  }
}
const limiter = new RateLimiter();

// --- middleware -------------------------------------------------------------
function createSecurityMiddleware({ onBlock = null } = {}) {
  const logBlock = (msg, info) => {
    const line = `[security] ${msg}`;
    if (typeof onBlock === 'function') { try { onBlock(info || {}); } catch (e) {} }
    console.log(line);
  };

  return function securityLayer(req, res, next) {
    if (process.env.MYRAA_SECURITY_DISABLED === '1') return next();

    const ip = req.socket.remoteAddress || 'unknown';
    const loopback = isLoopback(ip);
    const pathname = req.path || (req.url || '').split('?')[0];
    const now = Date.now();

    // 1. Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (pathname.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    // No Access-Control-Allow-Origin is set deliberately: same-origin (Electron
    // / mobile page served from this server) works; cross-origin browsers are denied.

    // 2. Rate limiting
    const sensitive = isSensitive(pathname);
    const limit = sensitive ? 60 : 600;
    const windowMs = 60000;
    const rl = limiter.hit(ip, limit, windowMs, now);
    if (!rl.allowed) {
      res.setHeader('Retry-After', '60');
      logBlock(`rate-limited 429 ${req.method} ${pathname} (ip=${ip})`);
      return res.status(429).json({ ok: false, error: 'Rate limit exceeded. Slow down your requests.' });
    }

    // 3. LAN guard — endpoint needs a paired device token unless loopback
    if (needsToken(pathname) && !loopback && process.env.MYRAA_INSECURE_LAN !== '1') {
      const token = extractToken(req);
      const trusted = loadTrustedTokens();
      if (!token || !trusted.has(token)) {
        logBlock(`denied non-loopback ${req.method} ${pathname} (ip=${ip}) — missing/invalid pair token`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(401).json({
          ok: false,
          error: 'Not authorized. Pair your device first (Settings → Devices → Pair), then send X-Myraa-Token.',
          code: 'LAN_GUARD'
        });
      }
    }

    next();
  };
}

// --- WebSocket upgrade guard (reused by server.cjs for /live) ---------------
function lanUpgradeAllowed(request) {
  if (process.env.MYRAA_SECURITY_DISABLED === '1' || process.env.MYRAA_INSECURE_LAN === '1') return true;
  const ip = (request.socket && request.socket.remoteAddress) || '';
  if (isLoopback(ip)) return true;
  const token = (request.headers['x-myraa-token'] || '').trim();
  const trusted = loadTrustedTokens();
  return Boolean(token && trusted.has(token));
}

module.exports = { createSecurityMiddleware, lanUpgradeAllowed, isLoopback, isSensitive, needsToken, SENSITIVE_PREFIXES, AUTH_REQUIRED_PREFIXES, BOOTSTRAP_PREFIXES };