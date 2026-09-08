process.env.MYRAA_DATA_DIR = process.env.MYRAA_V6_TEST_DIR || (require('path').join(require('os').tmpdir(), 'myraa_pair_test'));
const fs = require('fs'); const path = require('path');
if (!fs.existsSync(process.env.MYRAA_DATA_DIR)) fs.mkdirSync(process.env.MYRAA_DATA_DIR, { recursive: true });

const express = require('express');
const app = express();
app.use(express.json());

// IP override middleware to simulate LAN / loopback deterministically
app.use((req, res, next) => {
  try {
    Object.defineProperty(req.socket, 'remoteAddress', {
      value: req.headers['x-test-ip'] || req.socket.remoteAddress, configurable: true
    });
  } catch (e) {}
  next();
});

const security = require('../server_security.cjs');
app.use(security.createSecurityMiddleware({ onBlock: () => {} }));

// Stubs for the phone surface (we are testing the GUARD, not the handlers)
app.post('/api/mobile/command', (req, res) => res.json({ ok: true, message: 'command reached', hasHeader: !!req.headers['x-myraa-token'] }));
app.post('/api/mcp/v1/tools/call', (req, res) => res.json({ ok: true }));
app.get('/api/remote/echo', (req, res) => res.json({ ok: true }));

// Real pairing handlers
const cap = require('../myraa_capabilities_upgrade.cjs');
app.use(cap);

const LAN = { 'x-test-ip': '192.168.1.50' };
const LOCAL = { 'x-test-ip': '127.0.0.1' };
const post = (body, ip) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...ip }, body: JSON.stringify(body) });

(async () => {
  const server = app.listen(0, async () => {
    const base = 'http://127.0.0.1:' + server.address().port;
    let pass = true;
    const ok = (cond, msg) => { if (!cond) pass = false; console.log((cond ? 'PASS' : 'FAIL'), msg); };

    // 1. LAN pairing-info: code yes, masterSecret HIDDEN
    const infoLAN = await (await fetch(base + '/api/remote/pairing-info', { headers: LAN })).json();
    ok(infoLAN.ok && infoLAN.pairingPayload.pairingCode && !infoLAN.pairingPayload.masterSecret && infoLAN.secretEnvironment === 'hidden', '1 LAN pairing-info hides secret');

    // 2. wrong secret -> 403
    let r = await fetch(base + '/api/remote/pair', post({ secret: 'nope', pairingCode: infoLAN.pairingPayload.pairingCode }, LAN));
    ok(r.status === 403, '2 wrong secret -> 403');

    // 3. loopback pairing-info: has masterSecret + fresh code
    const infoLocal = await (await fetch(base + '/api/remote/pairing-info', { headers: LOCAL })).json();
    ok(infoLocal.ok && infoLocal.pairingPayload.masterSecret && infoLocal.pairingPayload.pairingCode, '3 loopback pairing-info exposes secret');

    // 4. pair with fresh code + secret (loopback) -> token
    r = await fetch(base + '/api/remote/pair', post({ deviceName: 'TestPhone', secret: infoLocal.pairingPayload.masterSecret, pairingCode: infoLocal.pairingPayload.pairingCode }, LOCAL));
    const pair0 = await r.json();
    ok(r.status === 200 && pair0.deviceToken && pair0.deviceToken.startsWith('myraa_mobile_'), '4 pair with fresh code -> token');

    // 5. replay same code -> rejected (one-time)
    r = await fetch(base + '/api/remote/pair', post({ secret: infoLocal.pairingPayload.masterSecret, pairingCode: infoLocal.pairingPayload.pairingCode }, LOCAL));
    ok(r.status === 403, '5 code replay rejected');

    // 6. LAN guard: mobile command w/o token -> 401
    r = await fetch(base + '/api/mobile/command', post({ command: 'x' }, LAN));
    ok(r.status === 401, '6 LAN mobile/command w/o token -> 401');

    // 7. token-bearing mobile/command passes guard
    r = await fetch(base + '/api/mobile/command', post({ command: 'ok' }, { 'x-test-ip': '192.168.1.50', 'X-Myraa-Token': pair0.deviceToken }));
    const m = await r.json();
    ok(r.status === 200 && m.ok && m.hasHeader, '7 token-bearing mobile/command passes');

    // 8. mcp tools call LAN w/o token -> 401
    r = await fetch(base + '/api/mcp/v1/tools/call', post({ name: 'mouse_control' }, LAN));
    ok(r.status === 401, '8 mcp tool LAN w/o token -> 401');

    // 9. /api/remote/echo LAN w/o token -> 401
    r = await fetch(base + '/api/remote/echo', post({}, LAN));
    ok(r.status === 401, '9 remote non-bootstrap LAN w/o token -> 401');

    // 10. loopback mobile/command stays open
    r = await fetch(base + '/api/mobile/command', post({ command: 'x' }, LOCAL));
    ok(r.status === 200, '10 loopback mobile/command stays open');

    // 11. /api/remote/devices LAN w/o token -> 401 (protected controller read)
    r = await fetch(base + '/api/remote/devices', { headers: LAN });
    ok(r.status === 401, '11 /api/remote/devices LAN w/o token -> 401');

    console.log(pass ? 'PAIRING + LAN GUARD TESTS PASS' : 'PAIRING + LAN GUARD TESTS FAIL');
    server.close();
    process.exit(pass ? 0 : 1);
  });
})().catch((e) => { console.error('TEST ERROR', e); process.exit(2); });