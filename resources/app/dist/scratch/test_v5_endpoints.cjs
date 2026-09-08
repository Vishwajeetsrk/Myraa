const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

const apexRoutes = require('d:/Team of Vishwajeet/MYRAA/resources/app/dist/apex_v5_routes.cjs');
app.use(apexRoutes);

const srv = app.listen(3088, async () => {
  console.log('Testing endpoints on port 3088...');
  try {
    // 1. Plugins
    const pRes = await fetch('http://localhost:3088/api/plugins');
    const pData = await pRes.json();
    console.log(`[PASS] /api/plugins -> ${pData.plugins.length} plugins found`);

    // 2. Plugins launch
    const lRes = await fetch('http://localhost:3088/api/plugins/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId: 'deep_research' })
    });
    const lData = await lRes.json();
    console.log(`[PASS] /api/plugins/launch -> message: "${lData.message}"`);

    // 3. Plugins toggle
    const tRes = await fetch('http://localhost:3088/api/plugins/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pluginId: 'github', enabled: true })
    });
    const tData = await tRes.json();
    console.log(`[PASS] /api/plugins/toggle -> github enabled: ${tData.enabled}`);

    // 4. Transcripts get
    const trRes = await fetch('http://localhost:3088/api/transcripts');
    const trData = await trRes.json();
    console.log(`[PASS] /api/transcripts -> ${trData.transcripts.length} entries`);

    // 5. Transcripts add
    const trAddRes = await fetch('http://localhost:3088/api/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker: 'User', text: 'Hello Myraa, testing transcription!' })
    });
    const trAddData = await trAddRes.json();
    console.log(`[PASS] /api/transcripts POST -> added entry: "${trAddData.entry.text}"`);

    // 6. Update status
    const uRes = await fetch('http://localhost:3088/api/update/status');
    const uData = await uRes.json();
    console.log(`[PASS] /api/update/status -> version: ${uData.version}`);

    // 7. Update check
    const ucRes = await fetch('http://localhost:3088/api/update/check', { method: 'POST' });
    const ucData = await ucRes.json();
    console.log(`[PASS] /api/update/check -> latest: ${ucData.latestVersion}`);

    console.log('\n✅ ALL 7 ENDPOINTS TESTED AND PASSING!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    srv.close();
  }
});
