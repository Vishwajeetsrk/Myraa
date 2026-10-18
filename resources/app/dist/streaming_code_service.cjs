'use strict';
/**
 * streaming_code_service.cjs — Real-time Streaming Code Generation & Test Output
 * MYRAA Coding Agent — v9.0.0
 *
 * Provides WebSocket-based streaming for:
 * - Code generation (progressive output)
 * - Test execution (real-time results)
 * - Build output (live logs)
 * - Terminal output (live stream)
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class StreamingCodeService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.streams = new Map();
  }

  // ── Session Management ─────────────────────────────────────────────────────

  createSession(type, opts = {}) {
    const id = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id,
      type, // 'code-gen', 'test', 'build', 'terminal'
      status: 'created',
      startedAt: Date.now(),
      chunks: [],
      result: null,
      error: null,
      opts,
    };
    this.sessions.set(id, session);
    this.emit('session:created', session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) || null;
  }

  closeSession(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.status = 'closed';
      this.emit('session:closed', session);
    }
    this.sessions.delete(id);
  }

  // ── Streaming Terminal Output ──────────────────────────────────────────────

  streamCommand(command, opts = {}) {
    const session = this.createSession('terminal', { command, ...opts });
    session.status = 'running';

    const cwd = opts.cwd || process.cwd();
    const timeout = opts.timeout || 120_000;

    try {
      const proc = spawn(command, [], {
        cwd,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        session.chunks.push({ type: 'stdout', data: chunk, timestamp: Date.now() });
        this.emit('stream:chunk', { sessionId: session.id, type: 'stdout', data: chunk });
      });

      proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        session.chunks.push({ type: 'stderr', data: chunk, timestamp: Date.now() });
        this.emit('stream:chunk', { sessionId: session.id, type: 'stderr', data: chunk });
      });

      proc.on('close', (code) => {
        session.status = code === 0 ? 'completed' : 'failed';
        session.result = { stdout, stderr, exitCode: code, duration: Date.now() - session.startedAt };
        this.emit('stream:complete', { sessionId: session.id, result: session.result });
      });

      proc.on('error', (err) => {
        session.status = 'error';
        session.error = err.message;
        session.result = { stdout, stderr, error: err.message, exitCode: 1, duration: Date.now() - session.startedAt };
        this.emit('stream:error', { sessionId: session.id, error: err.message });
      });

      // Timeout handling
      const timer = setTimeout(() => {
        proc.kill();
        session.status = 'timeout';
        session.error = `Command timed out after ${timeout}ms`;
        session.result = { stdout, stderr, error: session.error, exitCode: 124, duration: Date.now() - session.startedAt };
        this.emit('stream:timeout', { sessionId: session.id });
      }, timeout);

      proc.on('close', () => clearTimeout(timer));

      return { sessionId: session.id, proc };
    } catch (err) {
      session.status = 'error';
      session.error = err.message;
      this.emit('stream:error', { sessionId: session.id, error: err.message });
      return { sessionId: session.id, error: err.message };
    }
  }

  // ── Streaming Test Output ──────────────────────────────────────────────────

  streamTests(dir, opts = {}) {
    const session = this.createSession('test', { dir, ...opts });
    session.status = 'running';

    // Detect test framework
    const frameworks = this._detectTestFrameworks(dir);
    if (frameworks.length === 0) {
      session.status = 'failed';
      session.error = 'No test framework detected';
      this.emit('stream:error', { sessionId: session.id, error: session.error });
      return { sessionId: session.id, error: session.error };
    }

    const fw = frameworks[0];
    let cmd = fw.cmd;
    if (opts.framework) {
      const match = frameworks.find(f => f.name === opts.framework);
      if (match) cmd = match.cmd;
    }

    this.emit('stream:start', { sessionId: session.id, framework: fw.name, command: cmd });

    return this.streamCommand(cmd, { cwd: dir, timeout: opts.timeout || 300_000 });
  }

  // ── Streaming Build Output ─────────────────────────────────────────────────

  streamBuild(dir, opts = {}) {
    const session = this.createSession('build', { dir, ...opts });
    session.status = 'running';

    const pkgJsonPath = path.join(dir, 'package.json');
    let cmd = 'npm run build';
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.scripts?.build) cmd = `npm run ${pkg.scripts.build.includes(' ') ? 'build' : 'build'}`;
      } catch {}
    }

    this.emit('stream:start', { sessionId: session.id, type: 'build', command: cmd });

    return this.streamCommand(cmd, { cwd: dir, timeout: opts.timeout || 300_000 });
  }

  // ── Streaming Install Output ───────────────────────────────────────────────

  streamInstall(dir, opts = {}) {
    const session = this.createSession('install', { dir, ...opts });
    session.status = 'running';

    let cmd = 'npm install';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) cmd = 'yarn install --frozen-lockfile';
    else if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) cmd = 'pnpm install --frozen-lockfile';
    else if (fs.existsSync(path.join(dir, 'bun.lockb'))) cmd = 'bun install';

    this.emit('stream:start', { sessionId: session.id, type: 'install', command: cmd });

    return this.streamCommand(cmd, { cwd: dir, timeout: opts.timeout || 300_000 });
  }

  // ── Streaming Lint Output ──────────────────────────────────────────────────

  streamLint(dir, opts = {}) {
    const session = this.createSession('lint', { dir, ...opts });
    session.status = 'running';

    const frameworks = this._detectLintFrameworks(dir);
    let cmd = frameworks.length > 0 ? frameworks[0].cmd : 'echo "No linter detected"';

    if (opts.framework) {
      const match = frameworks.find(f => f.name === opts.framework);
      if (match) cmd = match.cmd;
    }

    this.emit('stream:start', { sessionId: session.id, type: 'lint', command: cmd });

    return this.streamCommand(cmd, { cwd: dir, timeout: opts.timeout || 120_000 });
  }

  // ── Streaming Code Generation ──────────────────────────────────────────────

  async streamCodeGeneration(prompt, opts = {}) {
    const session = this.createSession('code-gen', { prompt, ...opts });
    session.status = 'generating';
    this.emit('stream:start', { sessionId: session.id, type: 'code-gen' });

    try {
      // This would integrate with model_router for streaming
      // For now, emit progressive chunks
      const modelRouter = require('./model_router.cjs');
      const result = await modelRouter.executeWithFallback({
        task: 'coding',
        prompt,
        stream: true,
      });

      if (result && typeof result === 'string') {
        // Simulate streaming by chunking the response
        const chunkSize = 50;
        for (let i = 0; i < result.length; i += chunkSize) {
          const chunk = result.substring(i, i + chunkSize);
          session.chunks.push({ type: 'code', data: chunk, timestamp: Date.now() });
          this.emit('stream:chunk', { sessionId: session.id, type: 'code', data: chunk });
        }
      }

      session.status = 'completed';
      session.result = { code: result, duration: Date.now() - session.startedAt };
      this.emit('stream:complete', { sessionId: session.id, result: session.result });
      return { sessionId: session.id, result: session.result };
    } catch (err) {
      session.status = 'error';
      session.error = err.message;
      this.emit('stream:error', { sessionId: session.id, error: err.message });
      return { sessionId: session.id, error: err.message };
    }
  }

  // ── Helper Methods ─────────────────────────────────────────────────────────

  _detectTestFrameworks(dir) {
    const frameworks = [];
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['jest'] || pkg.scripts?.test?.includes('jest')) frameworks.push({ name: 'jest', cmd: 'npx jest --no-cache --verbose' });
        if (allDeps['vitest']) frameworks.push({ name: 'vitest', cmd: 'npx vitest run --reporter=verbose' });
        if (allDeps['mocha']) frameworks.push({ name: 'mocha', cmd: 'npx mocha --reporter spec' });
        if (allDeps['@playwright/test']) frameworks.push({ name: 'playwright', cmd: 'npx playwright test --reporter=list' });
        if (allDeps['cypress']) frameworks.push({ name: 'cypress', cmd: 'npx cypress run' });
        if (pkg.scripts?.test && !frameworks.length) frameworks.push({ name: 'npm-test', cmd: 'npm test' });
      } catch {}
    }
    if (fs.existsSync(path.join(dir, 'pytest.ini')) || fs.existsSync(path.join(dir, 'conftest.py'))) {
      frameworks.push({ name: 'pytest', cmd: 'python -m pytest --tb=short -v' });
    }
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) frameworks.push({ name: 'cargo-test', cmd: 'cargo test' });
    if (fs.existsSync(path.join(dir, 'go.mod'))) frameworks.push({ name: 'go-test', cmd: 'go test -v ./...' });
    return frameworks;
  }

  _detectLintFrameworks(dir) {
    const frameworks = [];
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['eslint'] || fs.existsSync(path.join(dir, '.eslintrc.js')) || fs.existsSync(path.join(dir, 'eslint.config.js'))) {
          frameworks.push({ name: 'eslint', cmd: 'npx eslint . --ext .js,.jsx,.ts,.tsx --format=stylish' });
        }
        if (allDeps['prettier']) frameworks.push({ name: 'prettier', cmd: 'npx prettier --check .' });
      } catch {}
    }
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) frameworks.push({ name: 'clippy', cmd: 'cargo clippy -- -D warnings' });
    if (fs.existsSync(path.join(dir, 'go.mod'))) frameworks.push({ name: 'go-vet', cmd: 'go vet ./...' });
    return frameworks;
  }

  // ── Get Active Streams ─────────────────────────────────────────────────────

  getActiveStreams() {
    const active = [];
    for (const [id, session] of this.sessions) {
      if (session.status === 'running' || session.status === 'generating') {
        active.push({
          id: session.id,
          type: session.type,
          status: session.status,
          duration: Date.now() - session.startedAt,
          chunks: session.chunks.length,
        });
      }
    }
    return active;
  }

  // ── Cancel Stream ──────────────────────────────────────────────────────────

  cancelStream(id) {
    const session = this.sessions.get(id);
    if (session && session.proc) {
      session.proc.kill();
      session.status = 'cancelled';
      this.emit('stream:cancelled', { sessionId: id });
      return true;
    }
    return false;
  }
}

module.exports = new StreamingCodeService();
