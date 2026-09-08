'use strict';
/* End-to-end UI test: drives the real MYRAA renderer over CDP.
 * Each step performs real DOM clicks / input into the running app and captures
 * the renderer screenshot, so handlers, fetches and rendering are exercised
 * exactly as a user's actions would be. */
const http = require('http');
const fs = require('fs');
const path = require('path');

function getJson() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 9333, path: '/json' }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

const OUT = process.env.TEMP + '\\myraa_ui_tests';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const targets = await getJson();
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:3000'));
  if (!page) { console.log('NO PAGE TARGET'); process.exit(1); }
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
  });
  await new Promise((r) => ws.on('open', r));

  const evalJs = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) return { __error: res.result.exceptionDetails.exception?.description || 'exception' };
    return res.result?.result?.value;
  };
  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    if (res.result?.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(res.result.data, 'base64'));
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const steps = JSON.parse(process.argv[2] || '[]');
  for (const step of steps) {
    if (step.type === 'eval') {
      const out = await evalJs(step.code);
      console.log(`[${step.name}]`, typeof out === 'object' ? JSON.stringify(out).slice(0, 300) : String(out).slice(0, 300));
    } else if (step.type === 'shot') {
      await shot(step.name);
      console.log(`[shot] ${step.name}.png`);
    } else if (step.type === 'wait') {
      await sleep(step.ms);
    }
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('TEST ERROR', e.message); process.exit(1); });
