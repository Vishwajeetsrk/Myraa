#!/usr/bin/env node
'use strict';

/* A release is only published after this script has inspected the generated
 * files. It deliberately builds a folder-based portable ZIP: Electron's
 * single-file portable target extracts to a temporary directory and cannot be
 * moved or inspected like a normal portable application. */
const { execFileSync, spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const app = path.join(root, 'resources', 'app');
const release = path.join(app, 'release');
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const version = pkg.version;
const exeName = 'MYRAA AI.exe';
const installerName = `MYRAA-Setup-${version}.exe`;
const portableName = `MYRAA-Portable-${version}.zip`;
const publishDir = path.join(root, 'Installers', `v${version}`);
const minimumExeBytes = 1024 * 1024;
const results = [];

function record(status, name, detail = '') {
  results.push({ status, name, detail });
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) { record('FAIL', name, detail); throw new Error(`${name}: ${detail}`); }
function existsFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(label, `missing: ${file}`);
  record('PASS', label, file);
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function quotePowerShell(value) { return "'" + value.replace(/'/g, "''") + "'"; }
function ps(script) {
  // PowerShell 7 is used where available because it can load the Security
  // module reliably in a non-interactive build worker.
  return execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
}
function copyDir(source, destination) { fs.cpSync(source, destination, { recursive: true, dereference: false }); }
function findExe(dir) {
  const matches = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) matches.push(...findExe(full));
    else if (item.name.toLowerCase() === exeName.toLowerCase() && fs.statSync(full).size >= minimumExeBytes) matches.push(full);
  }
  return matches;
}
function signature(file) {
  const text = ps(`$s = Get-AuthenticodeSignature -LiteralPath ${quotePowerShell(file)}; [pscustomobject]@{Status=$s.Status.ToString(); Subject=if($s.SignerCertificate){$s.SignerCertificate.Subject}else{''}; Timestamp=if($s.TimeStamperCertificate){$s.TimeStamperCertificate.Subject}else{''}} | ConvertTo-Json -Compress`);
  return JSON.parse(text);
}
function runSmoke(exe) {
  return new Promise((resolve, reject) => {
    const process = spawn(exe, ['--disable-gpu'], { cwd: path.dirname(exe), detached: false, windowsHide: true, stdio: 'ignore' });
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { process.kill(); } catch {}
      resolve();
    }, 8000);
    process.once('error', error => { if (!finished) { finished = true; clearTimeout(timer); reject(error); } });
    process.once('exit', (code, signal) => {
      if (!finished) { finished = true; clearTimeout(timer); reject(new Error(`exited early (code=${code}, signal=${signal})`)); }
    });
  });
}

async function main() {
  const validateExisting = process.argv.includes('--validate-existing');
  if (!validateExisting) {
    fs.rmSync(release, { recursive: true, force: true });
    // The build command validates MYRAA's curated desktop bundle. It must not
    // invoke a default Vite build, which would empty dist/ and remove server.cjs.
    // .cmd files require cmd.exe when launched from Node without a shell.
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], { cwd: app, stdio: 'inherit' });
    execFileSync('node.exe', ['node_modules/electron-builder/cli.js', '--config', 'electron-builder.v2.yml', '--publish', 'never', '--win', 'nsis', '--x64'], { cwd: app, stdio: 'inherit' });
  } else {
    record('PASS', 'Reusing existing build outputs for post-build validation');
  }

  const unpacked = path.join(release, 'win-unpacked');
  const appExe = path.join(unpacked, exeName);
  const asar = path.join(unpacked, 'resources', 'app.asar');
  const setup = path.join(release, installerName);
  existsFile(appExe, 'Main executable exists');
  if (fs.statSync(appExe).size < minimumExeBytes) fail('Main executable size', `${fs.statSync(appExe).size} bytes is below threshold`);
  record('PASS', 'Main executable size', `${fs.statSync(appExe).size} bytes`);
  existsFile(asar, 'app.asar exists');
  existsFile(setup, 'Installer exists');

  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa-portable-'));
  const portableFolder = path.join(stageRoot, `MYRAA-Portable-${version}`);
  copyDir(unpacked, portableFolder);
  fs.writeFileSync(path.join(portableFolder, 'README.txt'), `MYRAA AI OS ${version}\r\n\r\nRun ${exeName} from this folder. The folder may be moved anywhere.\r\n`);
  const portableZip = path.join(release, portableName);
  if (!validateExisting) ps(`Compress-Archive -LiteralPath ${quotePowerShell(portableFolder)} -DestinationPath ${quotePowerShell(portableZip)} -CompressionLevel Optimal -Force`);
  existsFile(portableZip, 'Portable ZIP exists');

  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa-validate-'));
  ps(`Expand-Archive -LiteralPath ${quotePowerShell(portableZip)} -DestinationPath ${quotePowerShell(extractRoot)} -Force`);
  const extractedFolder = path.join(extractRoot, `MYRAA-Portable-${version}`);
  if (!fs.existsSync(extractedFolder)) fail('Portable ZIP layout', 'top-level portable folder is missing (or nested incorrectly)');
  const discovered = findExe(extractedFolder);
  if (discovered.length !== 1) fail('Portable executable discovery', `expected one valid ${exeName}; found ${discovered.length}`);
  const portableExe = discovered[0];
  record('PASS', 'Portable executable discovered', `${portableExe} (${fs.statSync(portableExe).size} bytes)`);
  existsFile(path.join(extractedFolder, 'resources', 'app.asar'), 'Portable app.asar exists');
  try { await runSmoke(portableExe); record('PASS', 'Portable executable remained active for 8 seconds'); }
  catch (error) { fail('Portable executable smoke test', error.message); }

  fs.mkdirSync(publishDir, { recursive: true });
  const publishedSetup = path.join(publishDir, installerName);
  const publishedPortable = path.join(publishDir, portableName);
  fs.copyFileSync(setup, publishedSetup);
  fs.copyFileSync(portableZip, publishedPortable);
  const artifacts = [publishedSetup, publishedPortable].map(file => ({ file: path.basename(file), exists: fs.existsSync(file), size: fs.statSync(file).size, sha256: hash(file), signature: signature(file) }));
  const appSignature = signature(appExe);
  record(appSignature.Status === 'Valid' ? 'PASS' : 'WARNING', 'Main executable signature', `${appSignature.Status}${appSignature.Subject ? `; ${appSignature.Subject}` : ''}`);
  for (const item of artifacts) record(item.signature.Status === 'Valid' ? 'PASS' : 'WARNING', `${item.file} signature`, item.signature.Status);
  fs.writeFileSync(path.join(publishDir, 'SHA256SUMS.txt'), artifacts.map(x => `${x.sha256}  ${x.file}`).join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(publishDir, 'BUILD-MANIFEST.json'), JSON.stringify({ productName: pkg.productName, version, buildDate: new Date().toISOString(), executable: { file: exeName, path: appExe, size: fs.statSync(appExe).size, sha256: hash(appExe), signature: appSignature }, artifacts }, null, 2) + '\n');
  fs.writeFileSync(path.join(publishDir, 'README.txt'), `MYRAA AI OS ${version}\r\n\r\nInstaller: ${installerName}\r\nPortable: ${portableName}\r\n\r\nUnsigned builds can be blocked by Windows SmartScreen or Smart App Control. Use a release signed with a trusted Authenticode certificate.\r\n`);
  console.log(`\nRelease directory: ${publishDir}`);
  console.log(`Executable validated: ${appExe}`);
  console.log(`Installer: ${publishedSetup}`);
  console.log(`Portable ZIP: ${publishedPortable}`);
}

main().catch(error => { console.error(`\n[FAIL] Release validation stopped: ${error.message}`); process.exitCode = 1; });
