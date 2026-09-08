'use strict';
/* Quick CDP diagnostic for the MYRAA Electron renderer. */
const http = require('http');

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9333, path }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  const targets = await getJson('/json');
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:3000'));
  if (!page) { console.log('NO PAGE TARGET'); return; }
  const ws = new (require('ws'))(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
      console.log('[console.' + msg.params.type + ']', String(text).slice(0, 300));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[exception]', String(JSON.stringify(msg.params.exceptionDetails)).slice(0, 500));
    }
  });
  await new Promise((r) => ws.on('open', r));

  const evalJs = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.result?.value !== undefined ? res.result.result.value : JSON.stringify(res.result).slice(0, 400);
  };

  console.log('title:', await evalJs('document.title'));
  console.log('shell exists:', await evalJs('!!document.getElementById("myraa-app-root")'));
  console.log('shell children:', await evalJs('document.getElementById("myraa-app-root")?.children.length'));
  console.log('shell bg:', await evalJs('getComputedStyle(document.getElementById("myraa-app-root")).background.slice(0,120)'));
  console.log('root display:', await evalJs('getComputedStyle(document.getElementById("root")).display'));
  console.log('body overflow:', await evalJs('getComputedStyle(document.body).overflow'));
  console.log('topbar display:', await evalJs('getComputedStyle(document.querySelector(".top-command-bar")).display'));
  console.log('topbar height:', await evalJs('getComputedStyle(document.querySelector(".top-command-bar")).height'));
  console.log('greeting text:', await evalJs('document.getElementById("greeting-title")?.textContent'));
  console.log('inline style html:', await evalJs('document.documentElement.getAttribute("style")'));
  console.log('body child count:', await evalJs('document.body.children.length'));
  console.log('body children:', await evalJs('[...document.body.children].map(c=>c.id||c.className||c.tagName).join(",")'));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    require('fs').writeFileSync(process.env.TEMP + '\\cdp_shot.png', Buffer.from(shot.result.data, 'base64'));
    console.log('CDP screenshot saved:', process.env.TEMP + '\\cdp_shot.png');
  } else {
    console.log('screenshot failed:', JSON.stringify(shot).slice(0, 200));
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERROR', e.message); process.exit(1); });
