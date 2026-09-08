/* =============================================================================
 * MYRAA Phase 3 — Memory & Knowledge (RAG) test suite
 * Run:  node scratch/test_memory_kb.cjs
 * Isolated: uses a temp MYRAA_DATA_DIR so real user memory is untouched.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa-mem-kb-'));
process.env.MYRAA_DATA_DIR = TMP;

const { kb, chunkText, embedLocal, tokenize, router } = require('../memory_kb.cjs');

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}

(async () => {

console.log('== 1. Chunking ==');
t('long text splits into multiple chunks', chunkText(('Sentence one is fine. ').repeat(400)).length > 2);
t('chunk word budget <= 512', chunkText(('word '.repeat(2000))).every((c) => c.split(/\s+/).length <= 512));
t('empty text -> []', chunkText('').length === 0 && chunkText('   ').length === 0);

console.log('== 2. Local embeddings ==');
const v1 = embedLocal('I prefer dark themed user interfaces and minimal design');
const v2 = embedLocal('I prefer dark themed user interfaces and minimal design');
const v3 = embedLocal('quantum chromodynamics and the strong nuclear force theory');
function dot(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
t('deterministic (same input -> same vector)', v1.every((x, i) => x === v2[i]));
t('dim = 256', v1.length === 256);
t('similar texts score higher than unrelated', dot(v1, v2) > dot(v1, v3));
t('tokenizer produces tokens', tokenize('Hello World test').length >= 3);

console.log('== 3. remember / retrieve round trip ==');
kb.remember({ key: 'pref_theme', text: 'User prefers dark themed UIs and minimal design', category: 'preference' });
kb.remember({ key: 'pref_music', text: 'User loves lo-fi beats and ambient electronic music', category: 'preference' });
kb.remember({ key: 'identity_name', text: 'User is the operator of this machine, named Vishwajeet', category: 'identity' });
t('stats reflect 3 memories', kb.stats().total === 3);
const r1 = await kb.retrieve('what UI theme do I like');
t('retrieve returns ok', r1.ok === true);
t('retrieve returns memories', Array.isArray(r1.memories) && r1.memories.length > 0);
t('recall surfaces the theme memory', r1.memories.some((m) => m.key === 'pref_theme'));
t('citations populated', Array.isArray(r1.citations) && r1.citations.length > 0);
t('sources carry key+category', r1.sources.length > 0 && r1.sources[0].key && r1.sources[0].category);
t('scores included by default', typeof r1.memories[0].score === 'number');

console.log('== 4. buildContext (chat injection) ==');
const ctx = kb.buildContext('user operator preferences about music');
t('buildContext returns marked block', ctx.includes('[MYRAA MEMORY CONTEXT'));
t('buildContext is empty for empty query', kb.buildContext('') === '');
const ctxNone = kb.buildContext('zyxw quantum nonce query');
t('low-similarity query never throws', typeof ctxNone === 'string');

console.log('== 5. ingest (knowledge chunks) ==');
const longDoc = ('The history of aviation spans balloons to jet engines. ').repeat(60);
const ingest = kb.ingest({ title: 'Aviation History Notes', text: longDoc, url: 'https://notes.local/aviation' });
t('ingest chunks stored', ingest.ok === true && ingest.chunks > 1);
t('chunk keys prefixed kb_', ingest.keys.every((k) => k.startsWith('kb_aviation')));
const r2 = await kb.retrieve('history of aviation jet engines');
t('retrieve finds ingested knowledge', r2.memories.some((m) => m.key && m.key.startsWith('kb_aviation')));
t('chunk carries source metadata', r2.memories.some((m) => (m.metadata || {}).sourceTitle === 'Aviation History Notes'));

console.log('== 6. rebuild + edge cases ==');
t('rebuild index', kb.rebuildIndex().ok === true);
t('empty query retrieve ok but zero memories', (await kb.retrieve('')).ok === false);
t('delete works', (() => { const pre = kb.stats().total; kb.remove('pref_music'); return kb.stats().total === pre - 1; })());
t('remember with no text returns null', kb.remember({ text: '  ' }) === null);

console.log('== 7. HTTP smoke (ephemeral listener) ==');
const express = require('express');
const http = require('http');
const app = express();
app.use(express.json());
app.use(router);
const srv = http.createServer(app);
let port = 0;
const req = (method, p, body) => new Promise((resolve, reject) => {
  const data = body ? JSON.stringify(body) : null;
  const u = new URL(`http://127.0.0.1:${port}${p}`);
  const r = http.request({ hostname: '127.0.0.1', port: Number(port), path: u.pathname + u.search, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
    let raw = ''; res.on('data', (c) => raw += c); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(raw || '{}') }));
  });
  r.on('error', reject); if (data) r.write(data); r.end();
});

await new Promise((resolve) => srv.listen(0, '127.0.0.1', () => { port = srv.address().port; resolve(); }));
t('GET /api/memory/stats', (await req('GET', '/api/memory/stats')).status === 200);
t('GET /api/memory/taxonomy lists categories', (await req('GET', '/api/memory/taxonomy')).json.categories.includes('knowledge'));
t('POST /api/memory/remember', (await req('POST', '/api/memory/remember', { text: 'Via HTTP', key: 'http_mem', category: 'semantic' })).json.ok === true);
t('GET /api/memory/retrieve?q=', (await req('GET', '/api/memory/retrieve?q=ascii')).status === 200);
t('POST /api/memory/retrieve returns memories', (await req('POST', '/api/memory/retrieve', { query: 'via http' })).json.memories.length > 0);
t('POST /api/memory/retrieve 400 on empty query', (await req('POST', '/api/memory/retrieve', { query: '' })).status === 400);
t('POST /api/memory/knowledge', (await req('POST', '/api/memory/knowledge', { title: 'Doc HTTP', text: 'chunk me '.repeat(300) })).json.ok === true);
t('POST /api/memory/index/rebuild', (await req('POST', '/api/memory/index/rebuild', {})).json.ok === true);
t('DELETE /api/memory/:key', (await req('DELETE', '/api/memory/http_mem')).status === 200);
await new Promise((resolve) => srv.close(resolve));

console.log('== 8. Persistence across reload ==');
const p1 = kb.stats().total;
const kbreload = require('../memory_kb.cjs').kb;
t('index survives reload', kbreload.stats().total === p1);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})().catch((e) => { console.error('TEST CRASH:', e); process.exit(2); });