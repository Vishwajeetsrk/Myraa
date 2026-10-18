'use strict';
/**
 * MYRAA Compute executors — tests (Phase 7c).
 * Run: node tests/test_compute_executors.cjs (from repo root).
 * Real HTTP against an in-process stub Ollama; stub gateway object.
 */

const path = require('path');
const http = require('http');
const exec = require('../resources/app/dist/compute_executors.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

function startStubOllama() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'stub-llm' }, { name: 'stub-embed-text' }] }));
        if (req.url === '/api/generate') {
          const b = JSON.parse(body || '{}');
          return res.end(JSON.stringify({ model: b.model, response: 'stub-reply:' + String(b.prompt || '').slice(0, 20), done: true }));
        }
        if (req.url === '/api/embeddings') {
          return res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3, 0.4] }));
        }
        res.statusCode = 404;
        res.end('{}');
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function main() {
  console.log('== executors vs stub ollama ==');
  const { srv, port } = await startStubOllama();
  const realFetch = global.fetch;
  // Point the module at the stub by shadowing global fetch with a port rewrite.
  global.fetch = (url, opts) => realFetch(String(url).replace('http://127.0.0.1:11434', 'http://127.0.0.1:' + port), opts);

  const st = await exec.ollamaStatus();
  ok('ollama status lists stub models', st.ok === true && st.models.length === 2, JSON.stringify(st.models));

  const llm = await exec.execute({ route: 'LOCAL', jobType: 'LLM_INFERENCE', spec: { input: { prompt: 'hello world' } } }, {});
  ok('local LLM returns text', typeof llm.text === 'string' && llm.text.indexOf('stub-reply:') === 0, llm.text);

  const emb = await exec.execute({ route: 'LOCAL', jobType: 'EMBEDDING', spec: { input: { texts: ['a', 'b'] } } }, {});
  ok('local embeddings dims', emb.metrics && emb.metrics.dims === 4 && emb.embeddings.length === 2, JSON.stringify(emb.metrics));

  try {
    await exec.execute({ route: 'LOCAL', jobType: 'TRAINING', spec: { input: {} } }, {});
    ok('local training refused', false);
  } catch (e) {
    ok('local training refused EXECUTOR_PENDING', e.code === 'EXECUTOR_PENDING');
  }

  try {
    await exec.execute({ route: 'LOCAL', jobType: 'LLM_INFERENCE', spec: { input: {} } }, {});
    ok('missing prompt refused', false);
  } catch (e) {
    ok('missing prompt INVALID_JOB', e.code === 'INVALID_JOB');
  }

  const down = await exec.ollamaStatus(async () => { throw new Error('conn refused'); });
  ok('ollama down is NOT_CONFIGURED', down.ok === false && /NOT_CONFIGURED/.test(down.error));

  global.fetch = realFetch;

  console.log('== cloud gateway (stubbed module) ==');
  const stubGw = { call: async (o) => ({ text: 'gw-reply', provider: 'stub', model: 'stub-m', usage: { t: 1 } }) };
  const saved = {};
  for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) {
    saved[k] = process.env[k]; delete process.env[k];
  }
  try {
    await exec.execute({ route: 'CLOUD', jobType: 'LLM_INFERENCE', spec: { input: { prompt: 'hi' } } }, { gateway: stubGw });
    ok('cloud without keys refused', false);
  } catch (e) {
    ok('cloud without keys NOT_CONFIGURED', e.code === 'NOT_CONFIGURED');
  }
  process.env.GROQ_API_KEY = 'test-key-12345678';
  const gw = await exec.execute({ route: 'CLOUD', jobType: 'LLM_INFERENCE', spec: { input: { prompt: 'hi' } } }, { gateway: stubGw });
  ok('cloud stub gateway returns text', gw.text === 'gw-reply' && gw.metrics.provider === 'stub');
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }

  console.log('== manager dispatch end-to-end (stub fetch) ==');
  process.env.MYRAA_DATA_DIR = require('os').tmpdir() + '/myraa-exec-test';
  global.fetch = (url, opts) => realFetch(String(url).replace('http://127.0.0.1:11434', 'http://127.0.0.1:' + port), opts);
  const { createComputeManager } = require('../resources/app/dist/compute_manager.cjs');
  const mem = () => {
    const jobs = new Map(), workers = new Map(), events = [];
    return {
      saveJob: async (j) => { jobs.set(j.id, JSON.parse(JSON.stringify(j))); },
      loadJob: async (id) => { const j = jobs.get(String(id)); return j ? JSON.parse(JSON.stringify(j)) : null; },
      listJobs: async () => [...jobs.values()],
      saveWorker: async (w) => { workers.set(w.id, JSON.parse(JSON.stringify(w))); },
      loadWorker: async (id) => { const w = workers.get(String(id)); return w ? JSON.parse(JSON.stringify(w)) : null; },
      listWorkers: async () => [...workers.values()],
      addEvent: async (e) => { events.push(e); },
      listEvents: async (jid) => events.filter((e) => !jid || e.job_id === jid),
    };
  };
  const store = mem();
  const mgr = createComputeManager(store);
  const sub = await mgr.submitJob({ jobType: 'EMBEDDING', route: 'LOCAL', input: { texts: ['hello'] } });
  ok('local embedding accepted', sub.ok === true, JSON.stringify(sub).slice(0, 120));
  // wait for fire-and-forget executor
  let final = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100));
    final = await store.loadJob(sub.jobId);
    if (final && (final.status === 'COMPLETED' || final.status === 'FAILED')) break;
  }
  ok('executor drove job to COMPLETED', final && final.status === 'COMPLETED', final && final.status);
  ok('embeddings artifact recorded', final && final.artifacts.length === 1 && final.artifacts[0].name === 'embeddings.json');
  const evs = await store.listEvents(sub.jobId);
  ok('running+completed events logged', evs.some((e) => e.type === 'compute.job.running') && evs.some((e) => e.type === 'compute.job.completed'));
  global.fetch = realFetch;
  srv.close();

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR: ' + ((e && e.message) || e)); process.exit(1); });
