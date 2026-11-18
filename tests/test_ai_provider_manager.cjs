'use strict';
// Phase 4: provider abstraction truthfulness. No network calls in this suite.

const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const pm = require(path.join(DIST, 'ai_provider_manager.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const saved = process.env.GEMINI_API_KEY;
  const savedOr = process.env.OPENROUTER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = 'SENTINEL_FALLBACK_KEY';

  const adapters = pm.listAdapters();
  check('all six providers are described', ['gemini', 'anthropic', 'openrouter', 'ollama', 'openai', 'groq'].every((id) => adapters.some((a) => a.id === id)));
  check('no key values leak in adapter data', !JSON.stringify(adapters).includes(saved || 'SENTINEL'));
  check('ollama is local (no key required)', adapters.find((a) => a.id === 'ollama').configured === true && adapters.find((a) => a.id === 'ollama').keyRequired === false);
  check('gemini is unconfigured without key', adapters.find((a) => a.id === 'gemini').configured === false);
  check('realtime flag only on realtime-capable adapter', adapters.filter((a) => a.capabilities.realtime).every((a) => a.id === 'gemini'));
  check('unimplemented gemini chat is declared', adapters.find((a) => a.id === 'gemini').implemented.chat === false);

  const local = pm.route({ localOnly: true, task: 'coding' });
  check('localOnly routes to ollama', local.ok === true && local.provider === 'ollama');
  check('route never fabricates cost/latency', local.estimatedCost === null && local.expectedLatency === null);
  check('route exposes fallbacks', Array.isArray(local.fallbacks) && local.fallbacks.length > 0);

  const lm = await pm.listModels('gemini');
  check('model list without key is AUTH_REQUIRED', lm.ok === false && lm.code === 'AUTH_REQUIRED' && lm.models.length === 0);

  process.env.GEMINI_API_KEY = 'SENTINEL_TEST_KEY';
  const voice = pm.route({ modality: 'realtime' });
  check('realtime routes to configured gemini', voice.ok === true && voice.provider === 'gemini');
  const stillNoKeyLeak = JSON.stringify(pm.listAdapters());
  check('configured adapter still hides key value', !stillNoKeyLeak.includes('SENTINEL_TEST_KEY'));

  const chatResult = await pm.chat({ provider: 'gemini', messages: [{ role: 'user', content: 'hi' }] });
  check('unimplemented chat is honest NOT_IMPLEMENTED', chatResult.ok === false && chatResult.code === 'NOT_IMPLEMENTED');
  const bad = await pm.chat({ provider: 'nope', messages: [] });
  check('unknown provider is VALIDATION', bad.ok === false && bad.code === 'VALIDATION');

  if (saved === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = saved;
  if (savedOr === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedOr;

  const router = pm.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes adapters/models/probe/route/chat', ['/adapters', '/models/:id', '/probe', '/route', '/chat'].every((p) => paths.includes(p)));

  console.log('\nprovider manager tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
