'use strict';
/**
 * MYRAA Connections Manager
 * =============================================================================
 * A first-class MYRAA option for entering credentials in the UI, storing them
 * locally with Windows DPAPI, and testing the real API.
 *
 * Rules:
 *  - values never enter chat, logs, event bus, git, or URLs
 *  - stored encrypted per Windows user in %APPDATA%\MYRAA\settings\connections.json
 *  - status is based on a REAL request; no "connected" without a successful test
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const STORE = process.env.MYRAA_CONNECTIONS_STORE || path.join(appData, 'MYRAA', 'settings', 'connections.json');

const DEFINITIONS = [
  {
    id: 'microsoftGraph', label: 'Microsoft Graph (Outlook drafts)',
    where: 'Azure Portal > App registrations > New registration. Copy Tenant ID and Application (client) ID, create a client secret, grant Microsoft Graph Mail.ReadWrite.',
    fields: [
      { key: 'tenantId', label: 'Tenant ID', type: 'text' },
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client secret', type: 'password' },
    ],
    env: ['MSGRAPH_TENANT_ID', 'MSGRAPH_CLIENT_ID', 'MSGRAPH_CLIENT_SECRET'],
  },
  {
    id: 'figma', label: 'Figma',
    where: 'Figma > Settings > Security > Personal access tokens. Scopes file:read and projects:read.',
    fields: [{ key: 'token', label: 'Personal access token', type: 'password' }],
    env: ['FIGMA_TOKEN'],
  },
  {
    id: 'vercel', label: 'Vercel',
    where: 'Vercel > Settings > Tokens > Create Token.',
    fields: [{ key: 'token', label: 'API token', type: 'password' }],
    env: ['VERCEL_TOKEN'],
  },
  {
    id: 'stripe', label: 'Stripe',
    where: 'Stripe Dashboard > Developers > API keys > Secret key.',
    fields: [{ key: 'secretKey', label: 'Secret key', type: 'password' }],
    env: ['STRIPE_SECRET_KEY'],
  },
  {
    id: 'razorpay', label: 'Razorpay',
    where: 'Razorpay Dashboard > Settings > API Keys > Generate Key.',
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text' },
      { key: 'keySecret', label: 'Key secret', type: 'password' },
    ],
    env: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  },
  {
    id: 'gmail', label: 'Gmail OAuth',
    where: 'Google Cloud Console > Gmail API > OAuth client ID; generate a refresh token with Google OAuth Playground (scope gmail.compose).',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client secret', type: 'password' },
      { key: 'refreshToken', label: 'Refresh token', type: 'password' },
    ],
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
  },
  {
    id: 'github', label: 'GitHub',
    where: 'github.com/settings/tokens > fine-grained personal access token with repo, workflow and read:org.',
    fields: [{ key: 'token', label: 'Personal access token', type: 'password' }],
    env: ['GITHUB_TOKEN'],
  },
  {
    id: 'evSigning', label: 'EV code signing',
    where: 'Install the EV certificate token in this Windows user certificate store, then enter its SHA-1 thumbprint (certutil -store My).',
    fields: [{ key: 'thumbprint', label: 'Certificate SHA-1 thumbprint', type: 'text' }],
    env: ['CSC_SHA1'],
  },
];

function definition(id) { return DEFINITIONS.find((d) => d.id === String(id || '')); }

function encrypt(plain) {
  const script = "$s=[Console]::In.ReadToEnd(); $sec=ConvertTo-SecureString -String $s -AsPlainText -Force; ConvertFrom-SecureString -SecureString $sec";
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: String(plain), encoding: 'utf8', timeout: 15000, windowsHide: true }).trim();
}
function decrypt(cipher) {
  const script = "$c=[Console]::In.ReadToEnd(); $sec=ConvertTo-SecureString -String $c; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))";
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: String(cipher), encoding: 'utf8', timeout: 15000, windowsHide: true }).trim();
}
function readStore() {
  try {
    if (fs.existsSync(STORE)) return JSON.parse(fs.readFileSync(STORE, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) { /* corrupt store preserved, treated as empty */ }
  return {};
}
function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(data, null, 2), 'utf8');
}
function secretsFor(id) {
  const rec = readStore()[String(id)];
  if (!rec || !rec.encrypted) return null;
  const out = {};
  for (const [k, v] of Object.entries(rec.encrypted)) {
    try { out[k] = decrypt(v); } catch (e) { return null; }
  }
  return out;
}

function request(options, body) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let text = '';
      res.on('data', (c) => { if (text.length < 8000) text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: text.slice(0, 8000) }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'TIMEOUT' }); });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    if (body) req.write(body);
    req.end();
  });
}
function host(url, headers, method = 'GET') {
  const u = new URL(url);
  return { hostname: u.hostname, port: 443, path: u.pathname + u.search, method, headers, timeout: 12000 };
}

async function test(id) {
  const def = definition(id);
  if (!def) return { ok: false, code: 'UNKNOWN_CONNECTION' };
  const vals = secretsFor(id);
  if (!vals) return { ok: false, code: 'NOT_CONFIGURED', message: 'No stored credentials for ' + def.label + '.' };

  let r;
  try {
    if (id === 'microsoftGraph') {
      const form = new URLSearchParams({
        client_id: vals.clientId, client_secret: vals.clientSecret,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }).toString();
      const token = await request(host(`https://login.microsoftonline.com/${encodeURIComponent(vals.tenantId)}/oauth2/v2.0/token`, {
        'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form),
      }, 'POST'), form);
      if (token.status !== 200) return { ok: false, code: 'AUTH_FAILED', http: token.status, message: 'Token request failed.' };
      const access = JSON.parse(token.body).access_token;
      r = await request(host('https://graph.microsoft.com/v1.0/me', { Authorization: 'Bearer ' + access }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Graph token accepted.' : 'Graph request rejected.');
    }
    if (id === 'figma') {
      r = await request(host('https://api.figma.com/v1/me', { 'X-Figma-Token': vals.token }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Figma account verified.' : 'Figma rejected the token.');
    }
    if (id === 'vercel') {
      r = await request(host('https://api.vercel.com/v2/user', { Authorization: 'Bearer ' + vals.token }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Vercel account verified.' : 'Vercel rejected the token.');
    }
    if (id === 'stripe') {
      r = await request(host('https://api.stripe.com/v1/account', { Authorization: 'Bearer ' + vals.secretKey }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Stripe account verified.' : 'Stripe rejected the key.');
    }
    if (id === 'razorpay') {
      const cred = Buffer.from(vals.keyId + ':' + vals.keySecret).toString('base64');
      r = await request(host('https://api.razorpay.com/v1/orders?count=1', { Authorization: 'Basic ' + cred }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Razorpay credentials accepted.' : 'Razorpay rejected the credentials.');
    }
    if (id === 'gmail') {
      const form = new URLSearchParams({
        client_id: vals.clientId, client_secret: vals.clientSecret,
        refresh_token: vals.refreshToken, grant_type: 'refresh_token',
      }).toString();
      const tok = await request(host('https://oauth2.googleapis.com/token', {
        'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form),
      }, 'POST'), form);
      if (tok.status !== 200) return finish(id, false, tok.status, 'Gmail token refresh failed.');
      const access = JSON.parse(tok.body).access_token;
      r = await request(host('https://gmail.googleapis.com/gmail/v1/users/me/profile', { Authorization: 'Bearer ' + access }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'Gmail account verified.' : 'Gmail rejected the token.');
    }
    if (id === 'github') {
      r = await request(host('https://api.github.com/user', { Authorization: 'Bearer ' + vals.token, 'User-Agent': 'MYRAA-Connections' }));
      return finish(id, r.status === 200, r.status, r.status === 200 ? 'GitHub account verified.' : 'GitHub rejected the token.');
    }
    if (id === 'evSigning') {
      const out = execFileSync('certutil.exe', ['-store', 'My'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
      const okCert = String(out).toLowerCase().includes(vals.thumbprint.toLowerCase().replace(/\s/g, ''));
      return finish(id, okCert, okCert ? 200 : 404, okCert ? 'Certificate found in local store.' : 'Thumbprint not found in local certificate store.');
    }
    return { ok: false, code: 'TEST_NOT_IMPLEMENTED' };
  } catch (e) {
    return finish(id, false, 0, e.message);
  }
}

function finish(id, ok, http, message) {
  const store = readStore();
  const rec = store[id] || {};
  rec.status = ok ? 'CONNECTED' : 'FAILED';
  rec.lastTest = new Date().toISOString();
  rec.lastHttpStatus = http;
  rec.lastMessage = String(message || '').slice(0, 300);
  store[id] = rec;
  writeStore(store);
  return { ok: !!ok, code: ok ? 'CONNECTED' : 'TEST_FAILED', http, message: rec.lastMessage };
}

function save(id, values) {
  const def = definition(id);
  if (!def) return { ok: false, code: 'UNKNOWN_CONNECTION' };
  const encrypted = {};
  for (const f of def.fields) {
    const v = values && values[f.key];
    if (typeof v !== 'string' || !v.trim()) return { ok: false, code: 'VALIDATION', error: f.label + ' is required.' };
    try { encrypted[f.key] = encrypt(v); }
    catch (e) { return { ok: false, code: 'ENCRYPTION_FAILED', error: e.message }; }
  }
  const store = readStore();
  store[id] = { encrypted, status: 'SAVED_NOT_TESTED', savedAt: new Date().toISOString(), lastTest: null, lastMessage: null };
  writeStore(store);
  return { ok: true, saved: true, id, status: 'SAVED_NOT_TESTED', note: 'Stored encrypted for this Windows user. Run Test to verify.' };
}

function remove(id) {
  const store = readStore();
  if (!store[id]) return { ok: false, code: 'NOT_FOUND' };
  delete store[id];
  writeStore(store);
  return { ok: true, removed: id };
}

function status() {
  const store = readStore();
  return {
    ok: true,
    service: 'connections-manager',
    storage: STORE,
    encryption: 'Windows DPAPI per user',
    policy: 'Secrets are never logged, returned by the API, committed or sent to chat.',
    connections: DEFINITIONS.map((d) => {
      const rec = store[d.id] || {};
      return {
        id: d.id, label: d.label, where: d.where,
        fields: d.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
        env: d.env,
        status: rec.status || 'NOT_CONFIGURED',
        savedAt: rec.savedAt || null,
        lastTest: rec.lastTest || null,
        lastMessage: rec.lastMessage || null,
        lastHttpStatus: rec.lastHttpStatus || null,
      };
    }),
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(status()));
  router.post('/save', (req, res) => {
    const b = req.body || {};
    const r = save(b.id, b.values || {});
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post('/test', async (req, res) => {
    const r = await test((req.body || {}).id);
    res.status(r.ok ? 200 : (r.code === 'NOT_CONFIGURED' ? 409 : 400)).json(r);
  });
  router.post('/remove', (req, res) => res.json(remove((req.body || {}).id)));
  return router;
}

module.exports = { STATUS: { ok: true, service: 'connections-manager' }, DEFINITIONS, STORE, status, save, test, remove, createRouter };
