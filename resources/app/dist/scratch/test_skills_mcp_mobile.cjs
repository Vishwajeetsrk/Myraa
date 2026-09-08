async function testSkillsAndMobile() {
  console.log('================================================================');
  console.log('   MYRAA AI OS — SKILLS, MCP, MOBILE REMOTE & PC CONTROL AUDIT   ');
  console.log('================================================================\n');

  let passed = 0;

  // 1. Mobile Companion Webpage
  const r1 = await fetch('http://localhost:3000/mobile');
  const t1 = await r1.text();
  if (r1.status === 200 && t1.includes('MYRAA REMOTE')) {
    console.log('[PASS] Mobile Companion HTML (/mobile) -> HTTP 200');
    passed++;
  } else { console.error('[FAIL] Mobile Companion ->', r1.status); }

  // 2. Mobile Telemetry (LAN IP, Memory, Hostname)
  const r2 = await fetch('http://localhost:3000/api/mobile/telemetry');
  const d2 = await r2.json();
  if (r2.status === 200 && d2.success && d2.lanIp) {
    console.log(`[PASS] Mobile Telemetry -> LAN IP: ${d2.lanIp}, Host: ${d2.hostname}, URL: ${d2.mobileUrl}`);
    passed++;
  } else { console.error('[FAIL] Mobile Telemetry ->', r2.status, d2); }

  // 3. MCP Tools List Schema
  const r3 = await fetch('http://localhost:3000/api/mcp/v1/tools');
  const d3 = await r3.json();
  if (r3.status === 200 && d3.tools && d3.tools.length >= 10) {
    console.log(`[PASS] MCP v1 Tools Schema -> ${d3.tools.length} Tools declared with JSONSchema`);
    passed++;
  } else { console.error('[FAIL] MCP Tools ->', r3.status, d3); }

  // 4. MCP Tool Call: Window List
  const r4 = await fetch('http://localhost:3000/api/mcp/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'window_control', arguments: { action: 'list' } })
  });
  const d4 = await r4.json();
  if (r4.status === 200 && d4.content) {
    console.log(`[PASS] MCP Tool Call (window_control list) -> Success`);
    passed++;
  } else { console.error('[FAIL] MCP Window Control ->', r4.status, d4); }

  // 5. MCP Tool Call: Media Volume
  const r5 = await fetch('http://localhost:3000/api/mcp/v1/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'media_control', arguments: { action: 'volume_up', steps: 1 } })
  });
  const d5 = await r5.json();
  if (r5.status === 200 && d5.content) {
    console.log(`[PASS] MCP Tool Call (media_control volume_up) -> Success`);
    passed++;
  } else { console.error('[FAIL] MCP Media Control ->', r5.status); }

  // 6. Skills Registry
  const r6 = await fetch('http://localhost:3000/api/skills');
  const d6 = await r6.json();
  if (r6.status === 200 && d6.skills && d6.skills.length >= 4) {
    console.log(`[PASS] Skills Registry (/api/skills) -> ${d6.skills.length} Composite Skills registered`);
    passed++;
  } else { console.error('[FAIL] Skills Registry ->', r6.status, d6); }

  // 7. Mobile Command: Find file and send by WhatsApp
  const r7 = await fetch('http://localhost:3000/api/mobile/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: "find the file README and send by whatsapp" })
  });
  const d7 = await r7.json();
  if (r7.status === 200 && d7.success) {
    console.log(`[PASS] Mobile Command (Find & WhatsApp) -> "${d7.message}"`);
    passed++;
  } else { console.error('[FAIL] Mobile Command (WhatsApp) ->', r7.status, d7); }

  // 8. Mobile Command: Play movie
  const r8 = await fetch('http://localhost:3000/api/mobile/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: "play movie Interstellar on youtube" })
  });
  const d8 = await r8.json();
  if (r8.status === 200 && d8.success) {
    console.log(`[PASS] Mobile Command (Play Movie) -> "${d8.message}"`);
    passed++;
  } else { console.error('[FAIL] Mobile Command (Movie) ->', r8.status, d8); }

  // 9. Mobile Command: Window minimize
  const r9 = await fetch('http://localhost:3000/api/mobile/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: "minimize all windows" })
  });
  const d9 = await r9.json();
  if (r9.status === 200 && d9.success) {
    console.log(`[PASS] Mobile Command (Minimize) -> "${d9.message}"`);
    passed++;
  } else { console.error('[FAIL] Mobile Command (Minimize) ->', r9.status, d9); }

  // 10. Live Desktop Screenshot Mirror
  const r10 = await fetch('http://localhost:3000/api/mobile/screenshot');
  const d10 = await r10.json();
  if (r10.status === 200 && d10.ok) {
    console.log(`[PASS] Mobile Live Screen Mirror -> HTTP 200 (${d10.image ? 'Image captured' : d10.message})`);
    passed++;
  } else { console.error('[FAIL] Mobile Screenshot ->', r10.status, d10); }

  console.log('\n----------------------------------------------------------------');
  console.log(`AUDIT COMPLETE: ${passed}/10 test suites passed successfully!`);
  console.log('----------------------------------------------------------------');
}

testSkillsAndMobile();
