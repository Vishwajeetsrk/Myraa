const express = require('express');
const app = express();
app.use(express.json());
const routes = require('../myraa_v6_real_routes.cjs');
app.use(routes);

const server = app.listen(9876, async () => {
  try {
    console.log('Testing endpoints...');
    // 1. Check agent health
    const r1 = await (await fetch('http://127.0.0.1:9876/api/agent-health')).json();
    console.log('1. /api/agent-health:', r1);

    // 2. Check plugins health
    const r2 = await (await fetch('http://127.0.0.1:9876/api/plugins/health')).json();
    console.log('2. /api/plugins/health count:', r2.plugins?.length);

    // 3. Check skills catalog
    const r3 = await (await fetch('http://127.0.0.1:9876/api/skills/catalog')).json();
    console.log('3. /api/skills/catalog total:', r3.total);

    // 4. Check transcripts
    const r4 = await (await fetch('http://127.0.0.1:9876/api/transcripts')).json();
    console.log('4. /api/transcripts count:', r4.transcripts?.length);

    // 5. Check chat with word write request
    const r5 = await (await fetch('http://127.0.0.1:9876/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'write in MS Word please' })
    })).json();
    console.log('5. /api/chat (write in word):', r5);

    server.close();
  } catch (e) {
    console.error('Test error:', e);
    server.close();
  }
});
