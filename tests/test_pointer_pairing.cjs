'use strict';
/**
 * MYRAA Pointer pairing — tests (Phase 11 / Pointer Phase 4).
 * Run: node tests/test_pointer_pairing.cjs (from repo root).
 */
const pairing = require('../resources/app/dist/pointer_pairing.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  console.log('== mint / verify ==');
  const store = pairing.memoryStore();
  const mint = pairing.mintSecret('phone-abc', store);
  ok('mint returns plaintext secret once', typeof mint.secret === 'string' && mint.secret.length >= 16);
  ok('ttl is 10 minutes', mint.ttlSeconds === 600);
  ok('secret hashed at rest (no plaintext in store)', !JSON.stringify(store._map).includes(mint.secret));
  ok('discovery info lists endpoints', pairing.discoveryInfo().endpoints.mint === '/api/pairing/secret');

  const v1 = pairing.consumeSecret(mint.pairingId, mint.secret, store);
  ok('verify correct secret works', v1.ok === true && v1.deviceId === 'phone-abc');

  const v2 = pairing.consumeSecret(mint.pairingId, mint.secret, store);
  ok('secret is single-use', v2.ok === false && v2.code === 'ALREADY_USED');

  console.log('== failure modes ==');
  const mint2 = pairing.mintSecret('phone-xyz', store);
  const wrong = pairing.consumeSecret(mint2.pairingId, 'not-the-secret', store);
  ok('wrong secret rejected INVALID', wrong.ok === false && wrong.code === 'INVALID');

  const missing = pairing.consumeSecret('pair_nope', 'whatever', store);
  ok('unknown pairing rejected NOT_FOUND', missing.ok === false && missing.code === 'NOT_FOUND');

  // Expiry: craft an expired record directly
  const expired = {
    id: 'pair_old', deviceId: 'old-phone',
    secretHash: require('crypto').createHash('sha256').update('expired-secret').digest('hex'),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    used: false,
  };
  store.save(expired);
  const exp = pairing.consumeSecret('pair_old', 'expired-secret', store);
  ok('expired secret rejected EXPIRED', exp.ok === false && exp.code === 'EXPIRED');

  const noStore = pairing.consumeSecret('pair_x', 'y', null);
  ok('missing store reported NOT_CONFIGURED', noStore.ok === false && noStore.code === 'NOT_CONFIGURED');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
