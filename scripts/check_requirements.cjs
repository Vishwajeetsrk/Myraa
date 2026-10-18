#!/usr/bin/env node

/**
 * MYRAA AI OS -- Requirements Checker & Auto-Installer
 * 
 * Checks all prerequisites for MYRAA and installs missing ones automatically.
 * Run: node scripts/check_requirements.cjs
 * 
 * Checks:
 *   - Node.js v18+
 *   - npm
 *   - Python 3.10+ (for CAD engine)
 *   - Git (for coding agent)
 *   - Playwright (for browser automation)
 *   - build123d (for CAD)
 *   - OrcaSlicer/PrusaSlicer (for 3D printing)
 *   - VS Code (for coding agent)
 *   - API keys (.env file)
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHECKS = [];
const INSTALL_QUEUE = [];
let passed = 0;
let failed = 0;
let warnings = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(icon, msg) {
  console.log(`  ${icon}  ${msg}`);
}

function check(label, fn) {
  try {
    const result = fn();
    if (result === true) {
      log('[OK]', label);
      passed++;
    } else if (result === 'warn') {
      log('[!]', label + ' (optional, not found)');
      warnings++;
    } else {
      log('[X]', label + (typeof result === 'string' ? ': ' + result : ''));
      failed++;
      INSTALL_QUEUE.push(label);
    }
  } catch (e) {
    log('[X]', label + ': ' + e.message);
    failed++;
    INSTALL_QUEUE.push(label);
  }
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000, ...opts }).trim();
  } catch {
    return null;
  }
}

function versionGte(current, required) {
  const c = current.replace(/[^0-9.]/g, '').split('.').map(Number);
  const r = required.split('.').map(Number);
  for (let i = 0; i < Math.max(c.length, r.length); i++) {
    const a = c[i] || 0;
    const b = r[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

// ─── Node.js ────────────────────────────────────────────────────────────────

function checkNode() {
  const v = run('node --version');
  if (!v) return 'Node.js not found. Install from https://nodejs.org';
  if (!versionGte(v, '18.0.0')) return `Node.js ${v} found, need v18+. Upgrade from https://nodejs.org`;
  return true;
}

// ─── npm ────────────────────────────────────────────────────────────────────

function checkNpm() {
  const v = run('npm --version');
  if (!v) return 'npm not found. Install Node.js from https://nodejs.org';
  return true;
}

// ─── Python ─────────────────────────────────────────────────────────────────

function checkPython() {
  let v = run('python --version');
  if (!v) v = run('python3 --version');
  if (!v) return 'warn'; // optional
  if (!versionGte(v.replace('Python ', ''), '3.10.0'))
    return `Python ${v} found, need 3.10+ for CAD engine`;
  return true;
}

// ─── Git ────────────────────────────────────────────────────────────────────

function checkGit() {
  const v = run('git --version');
  if (!v) return 'warn'; // optional
  return true;
}

// ─── VS Code ────────────────────────────────────────────────────────────────

function checkVSCode() {
  const v = run('code --version');
  if (!v) return 'warn'; // optional
  return true;
}

// ─── Playwright ─────────────────────────────────────────────────────────────

function checkPlaywright() {
  const appDir = path.join(__dirname, '..', 'resources', 'app');
  const result = run('npx playwright --version', { cwd: appDir });
  if (!result) return 'warn'; // optional
  return true;
}

// ─── build123d (Python CAD library) ────────────────────────────────────────

function checkBuild123d() {
  const v = run('pip show build123d 2>nul') || run('pip3 show build123d 2>nul');
  if (!v) return 'warn'; // optional
  return true;
}

// ─── OrcaSlicer / PrusaSlicer ──────────────────────────────────────────────

function checkSlicer() {
  const paths = [
    path.join(process.env.LOCALAPPDATA || '', 'OrcaSlicer', 'orca-slicer.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'PrusaSlicer', 'prusa-slicer.exe'),
    'C:\\Program Files\\OrcaSlicer\\orca-slicer.exe',
    'C:\\Program Files\\PrusaSlicer\\prusa-slicer.exe',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return true;
  }
  return 'warn'; // optional
}

// ─── Electron ───────────────────────────────────────────────────────────────

function checkElectron() {
  const appDir = path.join(__dirname, '..', 'resources', 'app');
  const pkg = path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(pkg)) return true;
  // Check if electron-builder is installed
  const eb = path.join(appDir, 'node_modules', 'electron-builder', 'dist', 'cli.js');
  if (fs.existsSync(eb)) return true;
  return 'warn';
}

// ─── .env file ──────────────────────────────────────────────────────────────

function checkEnvFile() {
  const appDir = path.join(__dirname, '..', 'resources', 'app');
  const envPath = path.join(appDir, '.env');
  if (!fs.existsSync(envPath)) {
    // Create template
    fs.writeFileSync(envPath, [
      '# MYRAA AI OS - Environment Configuration',
      '# Get your Gemini API key from: https://aistudio.google.com/apikey',
      'GEMINI_API_KEY=',
      '',
      '# Optional API keys (enhances features)',
      '# WEATHER_API_KEY=your_openweathermap_key',
      '# NEWS_API_KEY=your_newsapi_key',
    ].join('\n'), 'utf8');
    return 'Created .env template -- add your GEMINI_API_KEY';
  }
  const content = fs.readFileSync(envPath, 'utf8');
  if (content.includes('GEMINI_API_KEY=') && !content.includes('GEMINI_API_KEY=your_') && !content.includes('GEMINI_API_KEY=\n')) {
    return true;
  }
  return '.env exists but GEMINI_API_KEY not set';
}

// ─── Node modules ──────────────────────────────────────────────────────────

function checkNodeModules() {
  const appDir = path.join(__dirname, '..', 'resources', 'app');
  const nmDir = path.join(appDir, 'node_modules');
  if (!fs.existsSync(nmDir)) return 'node_modules not found -- run: cd resources/app && npm install';
  const pkg = path.join(appDir, 'node_modules', '@google', 'genai');
  if (!fs.existsSync(pkg)) return '@google/genai not installed -- run: cd resources/app && npm install';
  return true;
}

// ─── Windows Build Tools (for native modules) ──────────────────────────────

function checkBuildTools() {
  if (os.platform() !== 'win32') return true; // only check on Windows
  const result = run('where cl.exe 2>nul');
  if (result) return true;
  // Check if windows-build-tools or visual studio is installed
  const vsWhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (fs.existsSync(vsWhere)) {
    const vsPath = run(`"${vsWhere}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`);
    if (vsPath) return true;
  }
  return 'warn'; // optional, electron-builder has fallback
}

// ─── Run All Checks ────────────────────────────────────────────────────────

console.log('');
console.log('  MYRAA AI OS -- Requirements Check');
console.log('  =================================');
console.log('');

log('[--]', 'Checking REQUIRED dependencies...');
console.log('');
check('Node.js v18+', checkNode);
check('npm', checkNpm);
check('node_modules (npm install)', checkNodeModules);
check('.env file (GEMINI_API_KEY)', checkEnvFile);

console.log('');
log('[--]', 'Checking OPTIONAL dependencies...');
console.log('');
check('Python 3.10+ (for CAD)', checkPython);
check('Git (for coding agent)', checkGit);
check('VS Code (for coding agent)', checkVSCode);
check('Playwright (for browser)', checkPlaywright);
check('build123d (Python CAD lib)', checkBuild123d);
check('OrcaSlicer/PrusaSlicer (3D printing)', checkSlicer);
check('Windows Build Tools (native modules)', checkBuildTools);

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('');
console.log('  =================================');
console.log(`  Results: ${passed} passed, ${failed} failed, ${warnings} optional`);
console.log('  =================================');

if (failed > 0) {
  console.log('');
  log('[!]', 'Missing required dependencies:');
  INSTALL_QUEUE.forEach(item => log('    ', '- ' + item));
  console.log('');
  log('[>]', 'Auto-installing missing dependencies...');
  console.log('');

  // Auto-install npm packages if node_modules missing
  const appDir = path.join(__dirname, '..', 'resources', 'app');
  const nmDir = path.join(appDir, 'node_modules');
  if (!fs.existsSync(nmDir)) {
    log('[>]', 'Running: npm install (this may take a minute)...');
    try {
      execSync('npm install', { cwd: appDir, stdio: 'inherit', timeout: 300000 });
      log('[OK]', 'npm install completed');
    } catch (e) {
      log('[X]', 'npm install failed: ' + e.message);
    }
  }

  // Auto-install Playwright if missing
  const pwCheck = run('npx playwright --version', { cwd: appDir });
  if (!pwCheck) {
    log('[>]', 'Installing Playwright Chromium...');
    try {
      execSync('npx playwright install chromium', { cwd: appDir, stdio: 'inherit', timeout: 300000 });
      log('[OK]', 'Playwright installed');
    } catch (e) {
      log('[!]', 'Playwright install skipped (optional)');
    }
  }

  // Auto-install build123d if Python available
  const pyCheck = run('python --version') || run('python3 --version');
  if (pyCheck) {
    const b123d = run('pip show build123d 2>nul') || run('pip3 show build123d 2>nul');
    if (!b123d) {
      log('[>]', 'Installing build123d (Python CAD library)...');
      try {
        execSync('pip install build123d', { stdio: 'inherit', timeout: 120000 });
        log('[OK]', 'build123d installed');
      } catch (e) {
        log('[!]', 'build123d install skipped (optional)');
      }
    }
  }

  console.log('');
  log('[OK]', 'Re-run this script to verify: node scripts/check_requirements.cjs');
} else {
  console.log('');
  log('[OK]', 'All required dependencies are installed!');
  if (warnings > 0) {
    log('[!]', `${warnings} optional tools not found -- MYRAA works without them`);
    log('[>]', 'Optional tools enable additional features (CAD, browser automation, etc.)');
  }
}

console.log('');
log('[>]', 'Next steps:');
log('   ', '1. Add your GEMINI_API_KEY to resources/app/.env');
log('   ', '2. Run: cd resources/app && npm run dev');
log('   ', '3. In another terminal: npx electron .');
log('   ', '4. Or build installer: npm run dist:win');
console.log('');
