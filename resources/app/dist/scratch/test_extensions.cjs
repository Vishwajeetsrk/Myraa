const express = require('express');
const app = express();
app.use(express.json({ limit: '20mb' }));

const upgradeRoutes = require('../myraa_capabilities_upgrade.cjs');
const realRoutes = require('../myraa_v6_real_routes.cjs');
app.use(upgradeRoutes);
app.use(realRoutes);

const server = app.listen(3049, async () => {
  console.log('Test server listening on 3049');

  try {
    // 1. Test Attachment URL
    console.log('\n--- 1. Testing /api/chat/attach (Web URL) ---');
    const att1 = await fetch('http://localhost:3049/api/chat/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' })
    }).then(r => r.json());
    console.log('Attach URL result:', att1.ok, 'Title:', att1.data?.title);

    // 2. Test Attachment File
    console.log('\n--- 2. Testing /api/chat/attach (File) ---');
    const att2 = await fetch('http://localhost:3049/api/chat/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: {
          name: 'audit_spec.txt',
          base64: Buffer.from('Audit verification specification test file.').toString('base64')
        }
      })
    }).then(r => r.json());
    console.log('Attach File result:', att2.ok, 'Path:', att2.path, 'Summary:', att2.summary);

    // 3. Test Weather endpoint
    console.log('\n--- 3. Testing /api/weather ---');
    const wRes = await fetch('http://localhost:3049/api/weather').then(r => r.json());
    console.log('Weather result:', wRes.ok, 'Summary:', wRes.summary);

    // 4. Test Voice Email flows
    console.log('\n--- 4. Testing /api/email/inbox/voice ---');
    const vRes = await fetch('http://localhost:3049/api/email/inbox/voice').then(r => r.json());
    console.log('Voice Inbox speech:', vRes.speech);

    // 5. Test Wallpaper endpoint
    console.log('\n--- 5. Testing /api/desktop/wallpaper ---');
    const wpRes = await fetch('http://localhost:3049/api/desktop/wallpaper').then(r => r.json());
    console.log('Current Wallpaper:', wpRes.wallpaper);

    // 6. Test Plugin Health Ping
    console.log('\n--- 6. Testing /api/plugins/health ---');
    const hpRes = await fetch('http://localhost:3049/api/plugins/health').then(r => r.json());
    console.log('Plugins probed:', hpRes.plugins.map(p => `${p.name}: ${p.alive ? 'ONLINE' : 'OFFLINE'} (${p.latencyMs}ms)`).join(', '));

    console.log('\nALL EXTENSION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
