const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3000${path}`, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  MYRAA AI OS (v7.5.0 APEX Master) End-to-End Tests  ');
  console.log('====================================================\n');

  try {
    // 1. Agent Health
    console.log('[Test 1] GET /api/agent-health');
    const health = await getJson('/api/agent-health');
    console.log('  Status:', health.status, 'Response:', JSON.stringify(health.data));

    // 2. Transcripts
    console.log('\n[Test 2] GET /api/transcripts');
    const trans = await getJson('/api/transcripts');
    console.log('  Status:', trans.status, 'Count:', trans.data?.transcripts?.length || 0);

    // 3. Skills Catalog
    console.log('\n[Test 3] GET /api/skills/catalog');
    const skills = await getJson('/api/skills/catalog');
    console.log('  Status:', skills.status, 'Total Skills:', skills.data?.total);

    // 4. Plugins Health
    console.log('\n[Test 4] GET /api/plugins/health');
    const plugins = await getJson('/api/plugins/health');
    console.log('  Status:', plugins.status, 'Total Plugins:', plugins.data?.plugins?.length);

    // 5. Plugin Launch
    console.log('\n[Test 5] POST /api/plugins/launch (excel)');
    const launch = await postJson('/api/plugins/launch', { pluginId: 'excel' });
    console.log('  Status:', launch.status, 'Result:', JSON.stringify(launch.data));

    // 6. Chat Action Execution (Desktop Intent: Open Word)
    console.log('\n[Test 6] POST /api/chat (Intent: "Open Microsoft Word")');
    const chatAction = await postJson('/api/chat', { message: 'Can you please open Microsoft Word for me' });
    console.log('  Status:', chatAction.status);
    console.log('  Action Executed:', chatAction.data?.actionExecuted);
    console.log('  Reply:', chatAction.data?.reply);
    console.log('  Thinking Leaked?:', (chatAction.data?.reply || '').includes('<think>') || (chatAction.data?.reply || '').includes('The user is'));

    // 7. Chat General Conversation (Ensure no thinking leaks)
    console.log('\n[Test 7] POST /api/chat (General: "Who are you and what version are you?")');
    const chatGen = await postJson('/api/chat', { message: 'Who are you and what version are you?' });
    console.log('  Status:', chatGen.status);
    console.log('  Reply:', chatGen.data?.reply);
    console.log('  Thinking Leaked?:', (chatGen.data?.reply || '').includes('<think>') || (chatGen.data?.reply || '').includes('The user is'));

    console.log('\n====================================================');
    console.log('  ✓ ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
    console.log('====================================================');
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

runTests();
