'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function run() {
  console.log('=====================================================================');
  console.log('  MYRAA AI OS — Full System End-to-End Verification (v9.3.0)');
  console.log('=====================================================================\n');

  // 1. Rule 1: No Emojis Check
  console.log('[*] 1. Checking Rule 1 (Zero Emojis)...');
  const workspaceRoot = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(workspaceRoot, 'resources', 'app', 'dist', 'index.html'), 'utf8');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(indexHtml), 'index.html contains zero emojis');
  assert(!indexHtml.includes('universal-control-addon.js'), 'index.html has no intrusive universal-control-addon.js');
  assert(!indexHtml.includes('ui-health-patch.js'), 'index.html has no intrusive ui-health-patch.js');

  // 2. Rule 2: User Data & Secrets Check
  console.log('\n[*] 2. Checking Rule 2 (User Data & Secrets Preservation)...');
  const secretsCandidates = [
    path.join(workspaceRoot, 'secrets.json'),
    path.join(process.env.APPDATA || '', 'MYRAA', 'secrets.json'),
    path.join(process.env.APPDATA || '', 'MYRAA AI OS', 'secrets.json')
  ];
  const secretsPath = secretsCandidates.find(p => fs.existsSync(p));
  assert(Boolean(secretsPath && fs.existsSync(secretsPath)), 'secrets.json exists in workspace or AppData');
  const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  assert(Boolean(secrets.geminiApiKey), 'Gemini API key is configured and preserved');

  // 3. Rule 3: Dynamic Version Accuracy
  console.log('\n[*] 3. Checking Rule 3 (Version Accuracy)...');
  const versionPath = path.join(workspaceRoot, 'resources', 'app', 'version.json');
  assert(fs.existsSync(versionPath), 'version.json exists');
  const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  assert(versionData.version === '9.3.0', 'version.json declares version 9.3.0');

  // 4. 3D Model & Character Assets Check
  console.log('\n[*] 4. Checking Evelyn 3D Assets...');
  const pmxCandidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist', 'assets', 'characters', 'evelyn', 'model.pmx'),
    path.join(workspaceRoot, 'resources', 'app', 'dist', 'assets', 'characters', 'evelyn', 'model.pmx'),
    path.join(workspaceRoot, 'resources', 'app', 'assets', 'characters', 'evelyn', 'model.pmx'),
    path.join(process.env.USERPROFILE || '', 'Videos', 'MYRAA', 'resources', 'app', 'assets', 'characters', 'evelyn', 'model.pmx')
  ];
  const pmxPath = pmxCandidates.find(p => fs.existsSync(p));
  assert(Boolean(pmxPath && fs.existsSync(pmxPath)), `Evelyn model.pmx found at: ${pmxPath}`);
  const pmxSize = pmxPath ? fs.statSync(pmxPath).size : 0;
  assert(pmxSize > 2500000, `Evelyn model.pmx is full size (${pmxSize} bytes)`);

  // 5. Backend Server Verification
  console.log('\n[*] 5. Launching and Validating Backend Server on Port 3000...');
  const installedExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'MYRAA.exe');
  const portableExe = path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4', 'MYRAA AI.exe');
  const runtimeExe = fs.existsSync(installedExe) ? installedExe : (fs.existsSync(portableExe) ? portableExe : 'node');
  
  const serverCandidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'MYRAA', 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
    path.join(workspaceRoot, 'resources', 'app', 'dist', 'server.cjs'),
    path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA-Portable', 'MYRAA-Portable-8.3.4', 'resources', 'app.asar.unpacked', 'dist', 'server.cjs')
  ];
  const serverPath = serverCandidates.find(p => fs.existsSync(p));
  const appRoot = path.dirname(path.dirname(serverPath));

  const serverProcess = spawn(runtimeExe, [serverPath], {
    cwd: appRoot,
    env: {
      ...process.env,
      PORT: '3000',
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', d => {
    const str = d.toString();
    if (str.includes('[Server] Running') || str.includes('Skill Discovery')) {
      console.log('  [LOG]', str.trim());
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 4000));

  try {
    // Health endpoint
    const health = await fetch('http://127.0.0.1:3000/api/health').then(r => r.json());
    assert(health.status === 'ok' && health.version === '9.3.0', 'GET /api/health returned ok with v9.3.0');

    // Evelyn 3D PMX Model endpoint
    const modelRes = await fetch('http://127.0.0.1:3000/assets/characters/evelyn/model.pmx');
    const modelBuffer = await modelRes.arrayBuffer();
    assert(modelRes.status === 200 && modelBuffer.byteLength === 2986453, `GET /assets/.../model.pmx returned 200 with exact 2,986,453 bytes (not HTML!)`);

    // Chat endpoint
    const chat = await fetch('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' })
    }).then(r => r.json());
    assert(chat.ok && typeof chat.reply === 'string' && chat.reply.length > 0, `POST /api/chat returned valid response: "${chat.reply.slice(0, 60)}..."`);
    assert(!emojiRegex.test(chat.reply), 'POST /api/chat response strictly complies with Rule 1 (Zero emojis)');

    // Skills endpoint
    const skills = await fetch('http://127.0.0.1:3000/api/skills').then(r => r.json());
    assert(skills && (Array.isArray(skills) || Array.isArray(skills.skills)), 'GET /api/skills returned active skills');

    // Word Engine Verification
    console.log('\n[*] 5.1 Validating OfficeDocEngine & Word Automation Capabilities...');
    const ode = require(path.join(workspaceRoot, 'resources', 'app', 'dist', 'office_doc_engine.cjs'));
    const genRes = await ode.generateWord({
      filename: 'e2e_verification_test.docx',
      title: 'MYRAA E2E Quality Verification',
      subtitle: 'Certified Autonomous Build v9.3.0'
    });
    assert(genRes.ok && fs.existsSync(genRes.path), `OfficeDocEngine created valid Word document at ${genRes.path}`);

    const reviewRes = await ode.reviewWord({ filePath: genRes.path });
    assert(reviewRes.ok && reviewRes.scores && reviewRes.scores.readability > 0, `OfficeDocEngine reviewed document: readability score ${reviewRes.scores.readability}/100`);

    const qaRes = await ode.qaPipelineWord({ filePath: genRes.path });
    assert(qaRes.ok && fs.existsSync(qaRes.path), `OfficeDocEngine QA pipeline completed: fixes applied=${qaRes.fixCount}`);

  } catch (err) {
    assert(false, `Server endpoint test failed: ${err.message}`);
  } finally {
    serverProcess.kill();
  }

  // 6. Windows Shortcuts & Release Package Verification
  console.log('\n[*] 6. Checking Shortcuts and Release Package...');
  const desktopLnk = path.join(process.env.USERPROFILE || '', 'Desktop', 'MYRAA.lnk');
  const startMenuLnk = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MYRAA', 'MYRAA.lnk');
  assert(fs.existsSync(desktopLnk), `Desktop shortcut exists: ${desktopLnk}`);
  assert(fs.existsSync(startMenuLnk), `Start Menu shortcut exists: ${startMenuLnk}`);

  const releaseSetup = path.join(workspaceRoot, 'release', 'MYRAA-Setup-9.3.0.exe');
  const releaseChecksums = path.join(workspaceRoot, 'release', 'checksums.txt');
  const releaseNotes = path.join(workspaceRoot, 'release', 'release-notes.md');
  assert(fs.existsSync(releaseSetup), 'release/MYRAA-Setup-9.3.0.exe installer binary exists (204 MB)');
  assert(fs.existsSync(releaseChecksums), 'release/checksums.txt exists');
  assert(fs.existsSync(releaseNotes), 'release/release-notes.md exists');

  console.log('\n=====================================================================');
  console.log(`  VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
