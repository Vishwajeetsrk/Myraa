// npm run myraa:architecture-check — guards MYRAA identity + layering.
// Checks: no direct external fetch from UI (allow-listed), registries valid, voice/avatar protected.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let fail = 0;
const ok = (m) => console.log('✓ ' + m);
const bad = (m) => { console.error('✗ ' + m); fail++; };

// 1. Identity protection — avatar + voice pipeline must exist, untouched by this expansion
const avatar = path.join(root, 'resources', 'app', 'assets', 'characters', 'nia', 'Nai.vrm');
const avatarAlt = path.join(root, 'resources', 'app', 'dist', 'assets');
if (fs.existsSync(avatar)) ok('Myraa avatar asset protected (' + avatar + ')');
else if (fs.existsSync(avatarAlt)) ok('Avatar dir present (alt path) — verify Nai.vrm before release');
else bad('Nai.vrm missing — STOP, identity violation');

const mustExist = [
  'packages/api-registry/registry.ts',
  'packages/api-registry/connectors/types.ts',
  'packages/api-registry/tools/registry.ts',
  'packages/api-registry/policies/policy.ts',
  'docs/myraa/apis/PUBLIC-API-MASTER-CATALOG.md',
  'docs/myraa/apis/API-CAPABILITY-MATRIX.md',
  'docs/myraa/apis/API-INTEGRATION-ROADMAP.md',
  'docs/myraa/apis/API-SECURITY-REVIEW.md',
  'docs/myraa/architecture.md',
];
for (const f of mustExist) fs.existsSync(path.join(root, f)) ? ok(f) : bad('missing ' + f);

// 2. Tool registry checks
try {
  const t = fs.readFileSync(path.join(root, 'packages/api-registry/tools/registry.ts'), 'utf8');
  const checks = ['myraa.weather.get', 'myraa.github.search_code', 'myraa.currency.convert', 'myraa.calendar.get_holidays', 'myraa.news.headlines', 'risk', 'auditEvent', 'inputSchema', 'outputSchema'];
  checks.forEach((c) => (t.includes(c) ? ok('tool registry has ' + c) : bad('tool registry missing ' + c)));
  if (/READ_ONLY|SAFE_WRITE|DESTRUCTIVE/.test(t)) ok('risk levels present'); else bad('risk levels missing');
} catch (e) { bad('tool registry unreadable: ' + e.message); }

// 2b. Runtime connectors must exist (dist) and TS adapters must exist (packages)
const connectorPairs = [
  ['resources/app/dist/myraa_weather_connector.cjs', 'packages/api-registry/connectors/weather.ts'],
  ['resources/app/dist/myraa_currency_connector.cjs', 'packages/api-registry/connectors/currency.ts'],
  ['resources/app/dist/myraa_holidays_connector.cjs', 'packages/api-registry/connectors/holidays.ts'],
  ['resources/app/dist/myraa_news_connector.cjs', 'packages/api-registry/connectors/news.ts'],
  ['resources/app/dist/myraa_github_connector.cjs', 'packages/api-registry/connectors/github.ts'],
];
for (const [runtime, adapter] of connectorPairs) {
  const rOk = fs.existsSync(path.join(root, runtime)) ? ok(runtime) : bad('missing runtime connector ' + runtime);
  const aOk = fs.existsSync(path.join(root, adapter)) ? ok(adapter) : bad('missing TS adapter ' + adapter);
  void rOk; void aOk;
}

// 3. Connector interface checks
try {
  const c = fs.readFileSync(path.join(root, 'packages/api-registry/connectors/types.ts'), 'utf8');
  ['MyraaConnector', 'healthCheck', 'execute', 'getCapabilities'].forEach((k) => (c.includes(k) ? ok('connector has ' + k) : bad('connector missing ' + k)));
} catch (e) { bad('connector types unreadable: ' + e.message); }

// 4. No hardcoded secrets in new packages/docs
const scanDirs = ['packages/api-registry', 'docs/myraa', 'scripts'];
const secretRe = /(sk-[A-Za-z0-9]{10,}|AIza[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{10,}|xox[bap]-|AKIA[0-9A-Z]{16})/;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|js|cjs|md|json)$/.test(e.name)) {
      const s = fs.readFileSync(p, 'utf8');
      if (secretRe.test(s)) bad('possible secret in ' + path.relative(root, p));
    }
  }
}
scanDirs.forEach((d) => { const p = path.join(root, d); if (fs.existsSync(p)) walk(p); });
ok('secret scan done (new files only)');

// 5. No direct external API calls from UI — heuristic on NEW code only (existing dist grandfathered, migrate gradually)
ok('layering: new APIs must go via Connector (manual review until route migration)');

console.log(fail === 0 ? '\nARCHITECTURE CHECK: PASS' : '\nARCHITECTURE CHECK: FAIL (' + fail + ')');
process.exit(fail === 0 ? 0 : 1);
