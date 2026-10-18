'use strict';
/**
 * MYRAA Pointer — phone companion pairing (Phase 4).
 * Mirrors the reference protocol's security properties:
 * - LAN discovery of the MYRAA host (mDNS-style; implemented via the existing
 *   server's /api/pairing/discover endpoint, no new discovery stack).
 * - 10-minute client secrets, single-use, minted server-side.
 * - Secrets never logged, never returned after first use, never sent to the
 *   phone in response to anything except the pairing handshake.
 *
 * The phone (mobile_companion.html extension) discovers the host, requests a
 * secret, presents it to MYRAA, and then holds the mic for press-and-hold.
 */

const CRYPTO = require('crypto');

const SECRET_TTL_MS = 10 * 60 * 1000;
const SECRET_BYTES = 16;

function generateSecret() {
  return CRYPTO.randomBytes(SECRET_BYTES).toString('base64url');
}

function mintSecret(deviceId, store) {
  const secret = generateSecret();
  const rec = {
    id: 'pair_' + CRYPTO.randomBytes(6).toString('hex'),
    deviceId: String(deviceId || 'unknown'),
    secretHash: CRYPTO.createHash('sha256').update(secret).digest('hex'),
    expiresAt: new Date(Date.now() + SECRET_TTL_MS).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  };
  // Persist via injected store (production: SQLite bridge). Return the
  // PLAINTEXT secret exactly once — it is never stored in plain text.
  if (store && typeof store.save === 'function') store.save(rec);
  return { ok: true, pairingId: rec.id, secret, expiresAt: rec.expiresAt, ttlSeconds: SECRET_TTL_MS / 1000 };
}

// Verify a presented secret: exists, unexpired, unused -> mark used (single-use).
function consumeSecret(pairingId, presentedSecret, store) {
  if (!store || typeof store.get !== 'function') {
    return { ok: false, code: 'NOT_CONFIGURED', error: 'pairing store not configured' };
  }
  const rec = store.get(pairingId);
  if (!rec) return { ok: false, code: 'NOT_FOUND', error: 'pairing not found' };
  if (rec.used) return { ok: false, code: 'ALREADY_USED', error: 'this pairing code was already used' };
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    return { ok: false, code: 'EXPIRED', error: 'pairing code expired — mint a new one' };
  }
  const presentedHash = CRYPTO.createHash('sha256').update(String(presentedSecret || '')).digest('hex');
  if (presentedHash !== rec.secretHash) {
    return { ok: false, code: 'INVALID', error: 'pairing code does not match' };
  }
  rec.used = true;
  rec.usedAt = new Date().toISOString();
  if (store.save) store.save(rec);
  return { ok: true, deviceId: rec.deviceId, pairingId: rec.id };
}

// In-memory store for tests; production injects the bridge-backed store.
function memoryStore() {
  const map = new Map();
  return {
    save: (rec) => { map.set(rec.id, Object.assign({}, rec)); },
    get: (id) => (map.has(id) ? JSON.parse(JSON.stringify(map.get(id))) : null),
    _map: map,
  };
}

function discoveryInfo(host) {
  return {
    service: 'myraa-pointer',
    host: host || 'myraa.local',
    port: 3000,
    endpoints: {
      mint: '/api/pairing/secret',
      verify: '/api/pairing/verify',
      notes: '/api/notes/:id',
      pointer: '/api/pointer/session/:id',
    },
    protocol: 'newline-json',
  };
}

module.exports = {
  SECRET_TTL_MS, SECRET_BYTES,
  generateSecret, mintSecret, consumeSecret,
  memoryStore, discoveryInfo,
};
