async function testAll() {
  console.log('====================================================');
  console.log('   MYRAA AI OS — LIVE ENDPOINTS AUDIT (PORT 3000)   ');
  console.log('====================================================\n');

  let passed = 0;

  // 1. Root SPA
  const r1 = await fetch('http://localhost:3000/');
  if (r1.status === 200) { console.log('[PASS] Root SPA (/) -> HTTP 200'); passed++; }
  else { console.error('[FAIL] Root SPA ->', r1.status); }

  // 2. 3D Character VRM
  const r2 = await fetch('http://localhost:3000/assets/characters/nia/Nai.vrm');
  const b2 = await r2.arrayBuffer();
  if (r2.status === 200 && b2.byteLength > 15000000) {
    console.log(`[PASS] 3D VRM Character (Nai.vrm) -> HTTP 200 (${b2.byteLength.toLocaleString()} bytes)`);
    passed++;
  } else { console.error('[FAIL] 3D VRM ->', r2.status, b2.byteLength); }

  // 3. UI Health & Capabilities Patch
  const r3 = await fetch('http://localhost:3000/ui-health-patch.js');
  const t3 = await r3.text();
  if (r3.status === 200 && t3.includes('Transcripts')) {
    console.log('[PASS] UI Health Patch (/ui-health-patch.js) -> HTTP 200');
    passed++;
  } else { console.error('[FAIL] UI Health Patch ->', r3.status); }

  // 4. Plugins Fleet API
  const r4 = await fetch('http://localhost:3000/api/plugins');
  const d4 = await r4.json();
  if (r4.status === 200 && d4.plugins && d4.plugins.length === 10) {
    console.log(`[PASS] Plugins Fleet API (/api/plugins) -> HTTP 200 (All ${d4.plugins.length} plugins active)`);
    passed++;
  } else { console.error('[FAIL] Plugins API ->', r4.status, d4); }

  // 5. Plugin Launch
  const r5 = await fetch('http://localhost:3000/api/plugins/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pluginId: 'deep_research' })
  });
  const d5 = await r5.json();
  if (r5.status === 200 && d5.success) {
    console.log(`[PASS] Plugin Launch (/api/plugins/launch) -> HTTP 200 (${d5.message})`);
    passed++;
  } else { console.error('[FAIL] Plugin Launch ->', r5.status); }

  // 6. Plugin Toggle
  const r6 = await fetch('http://localhost:3000/api/plugins/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pluginId: 'github', enabled: true })
  });
  const d6 = await r6.json();
  if (r6.status === 200 && d6.success) {
    console.log(`[PASS] Plugin Toggle (/api/plugins/toggle) -> HTTP 200 (github: ${d6.enabled})`);
    passed++;
  } else { console.error('[FAIL] Plugin Toggle ->', r6.status); }

  // 7. Transcripts Query
  const r7 = await fetch('http://localhost:3000/api/transcripts');
  const d7 = await r7.json();
  if (r7.status === 200 && Array.isArray(d7.transcripts)) {
    console.log(`[PASS] Transcripts API (/api/transcripts) -> HTTP 200 (${d7.transcripts.length} entries)`);
    passed++;
  } else { console.error('[FAIL] Transcripts API ->', r7.status); }

  // 8. Transcripts Record
  const r8 = await fetch('http://localhost:3000/api/transcripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speaker: 'User', text: 'Myraa, verify all plugins and update status' })
  });
  const d8 = await r8.json();
  if (r8.status === 200 && d8.success) {
    console.log(`[PASS] Transcripts Record (POST /api/transcripts) -> HTTP 200`);
    passed++;
  } else { console.error('[FAIL] Transcripts Record ->', r8.status); }

  // 9. Update Status
  const r9 = await fetch('http://localhost:3000/api/update/status');
  const d9 = await r9.json();
  if (r9.status === 200 && d9.success) {
    console.log(`[PASS] Update Status (/api/update/status) -> HTTP 200 (v${d9.version})`);
    passed++;
  } else { console.error('[FAIL] Update Status ->', r9.status); }

  // 10. Update Check
  const r10 = await fetch('http://localhost:3000/api/update/check', { method: 'POST' });
  const d10 = await r10.json();
  if (r10.status === 200 && d10.success) {
    console.log(`[PASS] Update Check (/api/update/check) -> HTTP 200 (${d10.currentVersion})`);
    passed++;
  } else { console.error('[FAIL] Update Check ->', r10.status); }

  console.log('\n----------------------------------------------------');
  console.log(`RESULT: ${passed}/10 tests passed successfully!`);
  console.log('----------------------------------------------------');
}

testAll();
