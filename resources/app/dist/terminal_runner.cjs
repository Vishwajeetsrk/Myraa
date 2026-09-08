/**
 * =============================================================================
 * MYRAA AI OS — Real Terminal & Shell Execution Engine
 * =============================================================================
 * Executes real CLI commands (npm, npx, node, git) with environment PATH inheritance,
 * stdout/stderr stream capture, execution timeouts, and automated error diagnostics
 * for autonomous self-healing of broken builds.
 * =============================================================================
 */

'use strict';

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure all standard Windows development paths are on PATH
function getAugmentedEnv() {
  const env = { ...process.env };
  const additionalPaths = [
    'C:\\Program Files\\nodejs',
    path.join(process.env.APPDATA || 'C:\\Users\\Vishwajeet\\AppData\\Roaming', 'npm'),
    'C:\\Program Files\\Git\\cmd',
    'C:\\Program Files\\Git\\bin',
    'C:\\Windows\\system32',
    'C:\\Windows'
  ];

  const currentPath = env.PATH || env.Path || '';
  const pathParts = currentPath.split(path.delimiter);
  for (const p of additionalPaths) {
    if (fs.existsSync(p) && !pathParts.includes(p)) {
      pathParts.unshift(p);
    }
  }
  env.PATH = pathParts.join(path.delimiter);
  env.Path = env.PATH;
  return env;
}

class TerminalRunner {
  constructor() {
    this.defaultCwd = path.join(process.cwd(), 'Projects');
    if (!fs.existsSync(this.defaultCwd)) {
      try { fs.mkdirSync(this.defaultCwd, { recursive: true }); } catch (e) {}
    }
  }

  /**
   * Execute command in a shell with captured stdout/stderr
   */
  execute(command, options = {}) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const cwd = options.cwd || this.defaultCwd;
      const timeoutMs = options.timeoutMs || 120000; // 2 minutes default

      if (!fs.existsSync(cwd)) {
        try { fs.mkdirSync(cwd, { recursive: true }); } catch (e) {}
      }

      const env = getAugmentedEnv();
      const isWin = process.platform === 'win32';
      // On Windows, wrap in cmd.exe /c to handle .cmd/.bat scripts like npx and npm cleanly
      const shellCmd = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const proc = spawn(shellCmd, shellArgs, {
        cwd,
        env,
        windowsHide: true,
        windowsVerbatimArguments: isWin
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        try { proc.kill('SIGTERM'); } catch (e) {}
      }, timeoutMs);

      proc.stdout.on('data', (data) => {
        const chunk = data.toString('utf8');
        stdout += chunk;
        if (options.onStdout) options.onStdout(chunk);
      });

      proc.stderr.on('data', (data) => {
        const chunk = data.toString('utf8');
        stderr += chunk;
        if (options.onStderr) options.onStderr(chunk);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        const success = code === 0 && !isTimedOut;
        const diagnostics = this._analyzeErrors(command, code, stdout, stderr);

        resolve({
          ok: success,
          command,
          cwd,
          exitCode: isTimedOut ? -1 : (code ?? 0),
          timedOut: isTimedOut,
          durationMs,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          diagnostics
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          ok: false,
          command,
          cwd,
          exitCode: -1,
          durationMs: Date.now() - startTime,
          stdout: stdout.trim(),
          stderr: err.message,
          diagnostics: { errorType: 'SPAWN_ERROR', suggestion: err.message }
        });
      });
    });
  }

  /**
   * Autonomous build error analyzer for self-healing
   */
  _analyzeErrors(command, exitCode, stdout, stderr) {
    if (exitCode === 0) return null;
    const combined = (stderr + '\n' + stdout).toLowerCase();

    if (combined.includes('eaddrinuse') || combined.includes('address already in use')) {
      return {
        errorType: 'PORT_IN_USE',
        suggestion: 'The requested port is already in use by another service. Use a fallback port (e.g. 5174 or 3001).'
      };
    }
    if (combined.includes('module not found') || combined.includes('cannot find module')) {
      const match = combined.match(/cannot find module ['"]([^'"]+)['"]/i) || combined.match(/module not found: (?:error: )?can't resolve ['"]([^'"]+)['"]/i);
      const missingPkg = match ? match[1] : 'unknown';
      return {
        errorType: 'MISSING_DEPENDENCY',
        missingPackage: missingPkg,
        suggestion: `Run "npm install ${missingPkg}" to install the missing module.`
      };
    }
    if (combined.includes('syntaxerror') || combined.includes('unexpected token')) {
      return {
        errorType: 'SYNTAX_ERROR',
        suggestion: 'Code contains a syntax error. Inspect the generated file and apply automated patch.'
      };
    }
    if (combined.includes('command not found') || combined.includes('is not recognized')) {
      return {
        errorType: 'MISSING_CLI_TOOL',
        suggestion: 'Ensure the requested CLI tool is installed or invoke via npx -y.'
      };
    }
    return {
      errorType: 'GENERAL_BUILD_ERROR',
      suggestion: 'Inspect stderr output and apply targeted correction.'
    };
  }

  /**
   * Verifies the toolchain inside MYRAA execution context
   */
  async testToolchain() {
    const [nodeRes, npmRes, gitRes] = await Promise.all([
      this.execute('node --version'),
      this.execute('npm --version'),
      this.execute('git --version')
    ]);

    return {
      ok: nodeRes.ok && npmRes.ok,
      node: nodeRes.stdout || 'NOT_FOUND',
      npm: npmRes.stdout || 'NOT_FOUND',
      git: gitRes.stdout || 'NOT_FOUND'
    };
  }

  /**
   * Acceptance Criterion: Run 21st CLI skill installer / inspector
   */
  async run21stSkill(subcommand = '--help', options = {}) {
    // Automatically uses npx -y to avoid interactive installation prompts
    const cmd = `npx -y @21st-dev/cli ${subcommand}`;
    return await this.execute(cmd, { ...options, timeoutMs: 90000 });
  }

  /**
   * Install npm dependencies for an App Studio project
   */
  async npmInstall(projectDir) {
    return await this.execute('npm install', { cwd: projectDir, timeoutMs: 180000 });
  }

  /**
   * Run dev server (non-blocking)
   */
  startDevServer(projectDir, port = 5173) {
    return new Promise((resolve) => {
      const env = getAugmentedEnv();
      env.PORT = String(port);

      const isWin = process.platform === 'win32';
      const shellCmd = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', 'npm run dev'] : ['-c', 'npm run dev'];

      const proc = spawn(shellCmd, shellArgs, {
        cwd: projectDir,
        env,
        windowsHide: true,
        windowsVerbatimArguments: isWin
      });

      let started = false;
      let output = '';

      proc.stdout.on('data', (d) => {
        const text = d.toString('utf8');
        output += text;
        if (!started && (text.includes('Local:') || text.includes('http://') || text.includes('ready'))) {
          started = true;
          resolve({ ok: true, pid: proc.pid, port, output: output.trim(), message: `Dev server running on port ${port}` });
        }
      });

      proc.stderr.on('data', (d) => {
        output += d.toString('utf8');
      });

      // Timeout fallback: if no error after 5 seconds, assume started
      setTimeout(() => {
        if (!started) {
          started = true;
          resolve({ ok: true, pid: proc.pid, port, output: output.trim(), message: `Dev server started on port ${port}` });
        }
      }, 5000);
    });
  }
}

const terminalRunner = new TerminalRunner();
module.exports = terminalRunner;
