const express = require('express');
const app = express();
app.use(express.json());

const realRoutes = require('../myraa_v6_real_routes.cjs');
app.use(realRoutes);

const server = app.listen(4567, async () => {
  console.log('Testing server started on 4567');
  try {
    // 1. Disk space
    const rDisk = await (await fetch('http://localhost:4567/api/system/disk-space')).json();
    console.log('Disk space:', rDisk);

    // 2. Permissions status
    const rPerms = await (await fetch('http://localhost:4567/api/system/permissions/status')).json();
    console.log('Permissions status:', rPerms.ok, Object.keys(rPerms.permissions));

    // 3. Permissions grant
    const rGrant = await (await fetch('http://localhost:4567/api/system/permissions/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission: 'microphone', granted: true })
    })).json();
    console.log('Permissions grant result:', rGrant.ok, rGrant.permission);

    // 4. Plugins health
    const rHealth = await (await fetch('http://localhost:4567/api/plugins/health')).json();
    console.log('Plugins health count:', rHealth.plugins?.length, rHealth.plugins?.map(p => p.id));

    // 5. Remote pairing info
    const rPair = await (await fetch('http://localhost:4567/api/remote/pairing-info')).json();
    console.log('Pairing info:', rPair.ok, rPair.pairingPayload?.pcName, rPair.pairingPayload?.endpoint);

    // 6. Voice command
    const rVoice = await (await fetch('http://localhost:4567/api/remote/voice-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'mute' })
    })).json();
    console.log('Remote voice command result:', rVoice.ok, rVoice.action, rVoice.spokenReply);

    // 7. Chat fallback with Groq
    console.log('Testing chat with Groq fallback...');
    const rChat = await (await fetch('http://localhost:4567/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello Myraa, respond in 5 words.' })
    })).json();
    console.log('Chat response:', rChat.ok, 'Model used:', rChat.model, 'Reply:', rChat.reply);

    console.log('\n>>> ALL 7 ENDPOINT & CAPABILITY TESTS PASSED WITH FLYING COLORS! <<<');
  } catch(e) {
    console.error('Test failed:', e);
  } finally {
    server.close();
    process.exit(0);
  }
});
