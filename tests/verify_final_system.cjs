'use strict';
/**
 * MYRAA end-to-end verifier (modernized, Phase 28).
 * All version/path expectations are read from the repo at runtime -
 * no hardcoded versions, no stale release/ paths, no assumption that
 * port 3000 is free. Starts its own backend on a test port.
 * Run: node tests\verify_final_system.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, message) {
  if (condition) { console.log('[PASS] ' + message); passed++; }
  else { console.error('[FAIL] ' + message); failed++; }
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => h.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(h.digest('hex').toUpperCase()));
  });
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/api/health');
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'resources', 'app', 'dist');
  const versionPath = path.join(root, 'resources', 'app', 'version.json');
  const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  const version = String(versionData.version || '');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'resources', 'app', 'package.json'), 'utf8'));

  console.log('=====================================================================');
  console.log('  MYRAA AI OS - Full System Verification (runtime version ' + version + ')');
  console.log('=====================================================================\n');

  // 1. Rule 1: zero emojis + capability scripts still mounted
  console.log('[*] 1. Checking Rule 1 (Zero Emojis, capabilities preserved)...');
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(indexHtml), 'index.html contains zero emojis');
  for (const script of ['universal-control-addon.js', 'ui-health-patch.js']) {
    assert(indexHtml.includes(script) && fs.existsSync(path.join(dist, script)), script + ' is referenced and present (capability preserved)');
  }

  // 2. Rule 2: user data / secrets preserved (never print values)
  console.log('\n[*] 2. Checking Rule 2 (User Data & Secrets Preservation)...');
  const secretsCandidates = [
    path.join(root, 'secrets.json'),
    path.join(process.env.APPDATA || '', 'MYRAA', 'secrets.json'),
    path.join(process.env.APPDATA || '', 'MYRAA AI OS', 'secrets.json'),
  ];
  const secretsPath = secretsCandidates.find((p) => p && fs.existsSync(p));
  assert(Boolean(secretsPath), 'secrets.json exists in workspace or AppData');
  if (secretsPath) {
    try {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      assert(Boolean(secrets.geminiApiKey), 'Gemini API key is configured and preserved (value not printed)');
    } catch (e) { assert(false, 'secrets.json is readable JSON: ' + e.message); }
  }

  // 3. Rule 3: dynamic version accuracy
  console.log('\n[*] 3. Checking Rule 3 (Dynamic Version Accuracy)...');
  assert(/^\d+\.\d+\.\d+$/.test(version), 'version.json declares a semantic version (' + version + ')');
  assert(pkg.version === version, 'resources/app/package.json matches version.json');
  const versionMd = fs.readFileSync(path.join(root, 'VERSION.md'), 'utf8');
  assert(versionMd.includes(version), 'VERSION.md records the current version (' + version + ')');

  // 4. Protected 3D companion assets
  console.log('\n[*] 4. Checking 3D companion assets...');
  const pmxCandidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist', 'assets', 'characters', 'evelyn', 'model.pmx'),
    path.join(dist, 'assets', 'characters', 'evelyn', 'model.pmx'),
    path.join(root, 'resources', 'app', 'assets', 'characters', 'evelyn', 'model.pmx'),
  ];
  const pmxPath = pmxCandidates.find((p) => p && fs.existsSync(p));
  assert(Boolean(pmxPath), '3D companion model.pmx found at: ' + pmxPath);
  const pmxSize = pmxPath ? fs.statSync(pmxPath).size : 0;
  assert(pmxSize > 2500000, '3D companion model.pmx is full size (' + pmxSize + ' bytes)');

  // 5. Backend on an isolated test port (never touches a running app on 3000)
  console.log('\n[*] 5. Starting backend on isolated test port 3011...');
  const port = 3011;
  const serverPath = path.join(dist, 'server.cjs');
  const child = spawn(process.execPath, [serverPath], {
    cwd: dist,
    env: {
      ...process.env,
      MYRAA_PORT: String(port),
      PORT: String(port),
      NODE_ENV: 'test',
      MYRAA_MCP_DB: path.join(os.tmpdir(), 'myraa_verify_mcp_' + version + '.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderrTail = '';
  child.stderr.on('data', (d) => { stderrTail = (stderrTail + d.toString()).slice(-2000); });

  try {
    const health = await waitForHealth(port, 90000);
    if (!health) {
      assert(false, 'GET /api/health on test port 3011 (server did not boot: ' + stderrTail.slice(-300) + ')');
    } else {
      assert(health.status === 'ok' && health.version === version, 'GET /api/health returned ok with runtime version ' + version);

      const modelRes = await fetch('http://127.0.0.1:' + port + '/assets/characters/evelyn/model.pmx');
      const modelBuffer = await modelRes.arrayBuffer();
      const contentType = String(modelRes.headers.get('content-type') || '');
      assert(modelRes.status === 200 && modelBuffer.byteLength > 2500000 && !contentType.includes('text/html'),
        'GET /assets/.../model.pmx returned binary model (' + modelBuffer.byteLength + ' bytes, ' + contentType + ')');

      try {
        const chatRes = await fetch('http://127.0.0.1:' + port + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hi' }),
          signal: AbortSignal.timeout(60000),
        });
        const chat = await chatRes.json();
        assert(Boolean(chat.ok && typeof chat.reply === 'string' && chat.reply.length > 0), 'POST /api/chat returned a reply');
        if (typeof chat.reply === 'string') assert(!emojiRegex.test(chat.reply), 'POST /api/chat reply complies with zero-emoji rule');
      } catch (e) {
        skipped++;
        console.log('[SKIP] POST /api/chat reply check - external provider slow/unavailable: ' + e.message);
      }

      const skills = await fetch('http://127.0.0.1:' + port + '/api/skills').then((r) => r.json());
      assert(Boolean(skills && (Array.isArray(skills) || Array.isArray(skills.skills))), 'GET /api/skills returned active skills');

      console.log('\n[*] 5.1 Validating Word Engine...');
      const ode = require(path.join(dist, 'office_doc_engine.cjs'));
      const genRes = await ode.generateWord({
        filename: 'e2e_verification_test.docx',
        title: 'MYRAA E2E Verification',
        subtitle: 'Certified Build v' + version,
      });
      assert(Boolean(genRes.ok && genRes.path && fs.existsSync(genRes.path)), 'OfficeDocEngine created a Word document');
      if (genRes.ok && genRes.path && fs.existsSync(genRes.path)) {
        const reviewRes = await ode.reviewWord({ filePath: genRes.path });
        assert(Boolean(reviewRes.ok && reviewRes.scores && reviewRes.scores.readability > 0), 'OfficeDocEngine reviewed the document (readability ' + (reviewRes.scores && reviewRes.scores.readability) + ')');
        const qaRes = await ode.qaPipelineWord({ filePath: genRes.path });
        assert(Boolean(qaRes.ok && qaRes.path && fs.existsSync(qaRes.path)), 'OfficeDocEngine QA pipeline completed');
      }
    }
  } catch (err) {
    assert(false, 'Server endpoint test failed: ' + err.message);
  } finally {
    child.kill();
  }

  // 6. Shortcuts + versioned installer package (current pipeline, not release/)
  console.log('\n[*] 6. Checking shortcuts and installer package v' + version + '...');
  const deskLnk = path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA.lnk');
  const menuRoots = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];
  const menuLnk = menuRoots.map((r) => path.join(r, 'MYRAA', 'MYRAA.lnk')).find((p) => fs.existsSync(p));
  assert(fs.existsSync(deskLnk), 'Desktop shortcut exists');
  assert(Boolean(menuLnk), 'Start Menu shortcut exists (user or All Users)');

  const pack = path.join(root, 'Installers', 'v' + version);
  const setup = path.join(pack, 'MYRAA-Setup-' + version + '.exe');
  const portable = path.join(pack, 'MYRAA-Portable-' + version + '.exe');
  assert(fs.existsSync(setup) && fs.statSync(setup).size > 100 * 1024 * 1024, 'versioned Setup installer exists (v' + version + ')');
  assert(fs.existsSync(portable), 'versioned Portable installer exists (v' + version + ')');
  assert(fs.existsSync(path.join(pack, 'SHA256SUMS.txt')), 'SHA256SUMS.txt exists in versioned pack');
  assert(fs.existsSync(path.join(pack, 'checksums.txt')), 'checksums.txt exists in versioned pack');
  if (fs.existsSync(setup) && fs.existsSync(path.join(pack, 'SHA256SUMS.txt'))) {
    const sums = fs.readFileSync(path.join(pack, 'SHA256SUMS.txt'), 'utf8');
    const expected = (sums.split(/\r?\n/).find((line) => line.includes('MYRAA-Setup-' + version + '.exe')) || '').split(/\s+/)[0].toUpperCase();
    const actual = await sha256File(setup);
    assert(Boolean(expected) && expected === actual, 'Setup SHA256 matches SHA256SUMS.txt');
  }

  console.log('\n=====================================================================');
  console.log('  VERIFICATION SUMMARY: ' + passed + ' PASSED, ' + failed + ' FAILED' + (skipped ? ', ' + skipped + ' SKIPPED' : ''));
  console.log('=====================================================================');
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error('Fatal test error:', e); process.exit(1); });
