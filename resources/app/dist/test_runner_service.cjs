'use strict';
/**
 * test_runner_service.cjs — Real Test Runner Integration
 * MYRAA Coding Agent — Phase 4
 *
 * Detects and executes: npm test, pytest, cargo test, go test, jest, vitest, etc.
 * Captures stdout, stderr, exit code, duration.
 * Returns structured test results.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_TIMEOUT = 120_000;
const LONG_TEST_TIMEOUT = 300_000;

function _exists(p) { return fs.existsSync(p); }

function _readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

function _detectTestFramework(dir) {
  const pkgJson = _exists(path.join(dir, 'package.json')) ? _readJSON(path.join(dir, 'package.json')) : null;
  const frameworks = [];

  if (pkgJson) {
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    if (allDeps['jest'] || pkgJson.scripts?.test?.includes('jest')) frameworks.push({ name: 'jest', cmd: 'npx jest --no-cache' });
    if (allDeps['vitest']) frameworks.push({ name: 'vitest', cmd: 'npx vitest run' });
    if (allDeps['mocha']) frameworks.push({ name: 'mocha', cmd: 'npx mocha' });
    if (allDeps['@playwright/test']) frameworks.push({ name: 'playwright', cmd: 'npx playwright test' });
    if (allDeps['cypress']) frameworks.push({ name: 'cypress', cmd: 'npx cypress run' });
    if (allDeps['@testing-library/react'] || allDeps['@testing-library/jest-dom']) {
      if (!frameworks.find(f => f.name === 'jest')) frameworks.push({ name: 'jest', cmd: 'npx jest --no-cache' });
    }
    if (pkgJson.scripts?.test && !frameworks.length) {
      frameworks.push({ name: 'npm-test', cmd: 'npm test' });
    }
  }

  // Python
  if (_exists(path.join(dir, 'pytest.ini')) || _exists(path.join(dir, 'conftest.py')) || _exists(path.join(dir, 'pyproject.toml'))) {
    frameworks.push({ name: 'pytest', cmd: 'python -m pytest --tb=short -q' });
  }

  // Rust
  if (_exists(path.join(dir, 'Cargo.toml'))) {
    frameworks.push({ name: 'cargo-test', cmd: 'cargo test' });
  }

  // Go
  if (_exists(path.join(dir, 'go.mod'))) {
    frameworks.push({ name: 'go-test', cmd: 'go test ./...' });
  }

  return frameworks;
}

function _detectLintFramework(dir) {
  const pkgJson = _exists(path.join(dir, 'package.json')) ? _readJSON(path.join(dir, 'package.json')) : null;
  const linters = [];

  if (pkgJson) {
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    if (allDeps['eslint'] || _exists(path.join(dir, '.eslintrc.js')) || _exists(path.join(dir, '.eslintrc.json')) || _exists(path.join(dir, 'eslint.config.js'))) {
      linters.push({ name: 'eslint', cmd: 'npx eslint . --ext .js,.jsx,.ts,.tsx' });
    }
    if (allDeps['prettier']) {
      linters.push({ name: 'prettier', cmd: 'npx prettier --check .' });
    }
  }

  // Python
  if (_exists(path.join(dir, 'requirements.txt')) || _exists(path.join(dir, 'pyproject.toml'))) {
    linters.push({ name: 'flake8', cmd: 'python -m flake8 . --max-line-length=120' });
  }

  // Rust
  if (_exists(path.join(dir, 'Cargo.toml'))) {
    linters.push({ name: 'clippy', cmd: 'cargo clippy' });
  }

  // Go
  if (_exists(path.join(dir, 'go.mod'))) {
    linters.push({ name: 'go-vet', cmd: 'go vet ./...' });
  }

  return linters;
}

function _parseJestOutput(stdout) {
  const lines = stdout.split('\n');
  let passed = 0, failed = 0, skipped = 0, total = 0;
  const testResults = [];
  for (const line of lines) {
    const passMatch = line.match(/✓|passing/i);
    const failMatch = line.match(/✗|failing|FAIL/i);
    const skipMatch = line.match(/pending|skipped/i);
    if (passMatch && !line.includes('Tests:')) passed++;
    if (failMatch && !line.includes('Tests:')) failed++;
    if (skipMatch && !line.includes('Tests:')) skipped++;

    const testLine = line.match(/^\s*(✓|✗|○|•|PASS|FAIL)\s+(.+)$/);
    if (testLine) {
      testResults.push({
        status: testLine[1].includes('✓') || testLine[1] === 'PASS' ? 'pass' : 'fail',
        name: testLine[2].trim(),
      });
    }
  }
  // Try to parse summary line: Tests: 10 passed, 2 failed
  const summaryLine = lines.find(l => l.includes('Tests:'));
  if (summaryLine) {
    const passedMatch = summaryLine.match(/(\d+)\s+passed/);
    const failedMatch = summaryLine.match(/(\d+)\s+failed/);
    const skippedMatch = summaryLine.match(/(\d+)\s+skipped/);
    if (passedMatch) passed = parseInt(passedMatch[1]);
    if (failedMatch) failed = parseInt(failedMatch[1]);
    if (skippedMatch) skipped = parseInt(skippedMatch[1]);
  }
  total = passed + failed + skipped;
  return { passed, failed, skipped, total, tests: testResults };
}

function _parsePytestOutput(stdout) {
  const lines = stdout.split('\n');
  let passed = 0, failed = 0, skipped = 0, total = 0;
  const testResults = [];
  for (const line of lines) {
    if (line.match(/^\s*PASSED/i)) passed++;
    else if (line.match(/^\s*FAILED/i)) failed++;
    else if (line.match(/^\s*SKIPPED/i)) skipped++;
    const testLine = line.match(/^(PASSED|FAILED|SKIPPED)\s+(.+)$/);
    if (testLine) {
      testResults.push({ status: testLine[1].toLowerCase(), name: testLine[2].trim() });
    }
  }
  // Parse summary: 15 passed, 2 failed, 1 skipped in 0.5s
  const summaryLine = lines.find(l => l.match(/\d+ (passed|failed|error)/));
  if (summaryLine) {
    const p = summaryLine.match(/(\d+)\s+passed/);
    const f = summaryLine.match(/(\d+)\s+failed/);
    const s = summaryLine.match(/(\d+)\s+skipped/);
    if (p) passed = parseInt(p[1]);
    if (f) failed = parseInt(f[1]);
    if (s) skipped = parseInt(s[1]);
  }
  total = passed + failed + skipped;
  return { passed, failed, skipped, total, tests: testResults };
}

function _parseGenericOutput(stdout, stderr) {
  const lines = (stdout + '\n' + stderr).split('\n');
  let passed = 0, failed = 0, skipped = 0;
  for (const line of lines) {
    if (line.match(/\bpass\b|✓|\d+ passing/i)) passed++;
    if (line.match(/\bfail\b|✗|\d+ failing/i)) failed++;
    if (line.match(/\bskip\b|pending/i)) skipped++;
  }
  return { passed, failed, skipped, total: passed + failed + skipped, tests: [] };
}

// ── Main Runner ──────────────────────────────────────────────────────────────

function detectTestSetup(dir) {
  return {
    testFrameworks: _detectTestFramework(dir),
    lintFrameworks: _detectLintFramework(dir),
  };
}

async function runTests(dir, opts = {}) {
  const framework = opts.framework;
  const testFile = opts.file;
  const timeout = opts.timeout || LONG_TEST_TIMEOUT;
  const startTime = Date.now();

  let frameworks = _detectTestFramework(dir);
  if (framework) frameworks = frameworks.filter(f => f.name === framework);
  if (frameworks.length === 0) {
    return { ok: false, error: 'No test framework detected', duration: 0 };
  }

  const fw = frameworks[0];
  let cmd = fw.cmd;
  if (testFile) cmd += ` ${testFile}`;

  try {
    const stdout = execSync(cmd, {
      cwd: dir,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    const duration = Date.now() - startTime;
    let results;
    if (fw.name === 'jest' || fw.name === 'vitest') results = _parseJestOutput(stdout);
    else if (fw.name === 'pytest') results = _parsePytestOutput(stdout);
    else results = _parseGenericOutput(stdout, '');

    return {
      ok: results.failed === 0,
      framework: fw.name,
      command: cmd,
      duration,
      ...results,
      raw: stdout,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const stdout = err.stdout ? String(err.stdout) : '';
    const stderr = err.stderr ? String(err.stderr) : '';
    let results;
    if (fw.name === 'jest' || fw.name === 'vitest') results = _parseJestOutput(stdout + stderr);
    else if (fw.name === 'pytest') results = _parsePytestOutput(stdout + stderr);
    else results = _parseGenericOutput(stdout, stderr);

    return {
      ok: false,
      framework: fw.name,
      command: cmd,
      duration,
      exitCode: err.status || 1,
      ...results,
      error: stderr.trim() || err.message,
      raw: stdout + '\n' + stderr,
    };
  }
}

async function runLint(dir, opts = {}) {
  const framework = opts.framework;
  const timeout = opts.timeout || TEST_TIMEOUT;
  const startTime = Date.now();

  let frameworks = _detectLintFramework(dir);
  if (framework) frameworks = frameworks.filter(f => f.name === framework);
  if (frameworks.length === 0) {
    return { ok: false, error: 'No lint framework detected', duration: 0 };
  }

  const fw = frameworks[0];
  try {
    const stdout = execSync(fw.cmd, {
      cwd: dir,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, framework: fw.name, command: fw.cmd, duration: Date.now() - startTime, output: stdout, warnings: 0, errors: 0 };
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : '';
    const stderr = err.stderr ? String(err.stderr) : '';
    const combined = stdout + stderr;
    const errorCount = (combined.match(/error/gi) || []).length;
    const warningCount = (combined.match(/warning/gi) || []).length;
    return {
      ok: err.status === 0,
      framework: fw.name,
      command: fw.cmd,
      duration: Date.now() - startTime,
      exitCode: err.status || 1,
      errors: errorCount,
      warnings: warningCount,
      output: combined,
    };
  }
}

async function runBuild(dir, opts = {}) {
  const pkgJson = _exists(path.join(dir, 'package.json')) ? _readJSON(path.join(dir, 'package.json')) : null;
  if (!pkgJson?.scripts?.build) {
    return { ok: false, error: 'No build script found' };
  }
  const startTime = Date.now();
  try {
    const stdout = execSync('npm run build', {
      cwd: dir,
      timeout: opts.timeout || LONG_TEST_TIMEOUT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, command: 'npm run build', duration: Date.now() - startTime, output: stdout };
  } catch (err) {
    return {
      ok: false,
      command: 'npm run build',
      duration: Date.now() - startTime,
      exitCode: err.status || 1,
      error: (err.stderr ? String(err.stderr).trim() : '') || err.message,
      output: (err.stdout ? String(err.stdout) : '') + '\n' + (err.stderr ? String(err.stderr) : ''),
    };
  }
}

async function runInstall(dir, opts = {}) {
  const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'];
  const hasLock = lockFiles.some(l => _exists(path.join(dir, l)));
  const pkgJson = _exists(path.join(dir, 'package.json')) ? _readJSON(path.join(dir, 'package.json')) : null;
  if (!pkgJson) return { ok: false, error: 'No package.json found' };

  let cmd = 'npm install';
  if (_exists(path.join(dir, 'yarn.lock'))) cmd = 'yarn install --frozen-lockfile';
  else if (_exists(path.join(dir, 'pnpm-lock.yaml'))) cmd = 'pnpm install --frozen-lockfile';
  else if (_exists(path.join(dir, 'bun.lockb'))) cmd = 'bun install';

  const startTime = Date.now();
  try {
    const stdout = execSync(cmd, {
      cwd: dir,
      timeout: opts.timeout || 300_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, command: cmd, duration: Date.now() - startTime, output: stdout };
  } catch (err) {
    return {
      ok: false,
      command: cmd,
      duration: Date.now() - startTime,
      exitCode: err.status || 1,
      error: (err.stderr ? String(err.stderr).trim() : '') || err.message,
    };
  }
}

module.exports = {
  detectTestSetup,
  runTests,
  runLint,
  runBuild,
  runInstall,
  _detectTestFramework,
  _detectLintFramework,
};
