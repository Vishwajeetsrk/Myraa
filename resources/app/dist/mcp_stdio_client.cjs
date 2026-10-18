'use strict';
/**
 * MYRAA MCP stdio client (Phase 25).
 * Minimal, honest JSON-RPC 2.0 client over a child process stdio pipe using
 * the MCP stdio framing (one JSON message per line).
 * - spawn uses shell:true so Windows resolves npx.cmd and friends
 * - never throws: every failure is returned/rejected with a plain error code
 * - process tree is killed via taskkill /T /F on win32, child.kill otherwise
 */

const { spawn, spawnSync } = require('child_process');

const MAX_LINE_CHARS = 1000000;
const MAX_STDERR_CHARS = 8192;

function mkErr(code, message) {
  const e = new Error(String(message == null ? '' : message));
  e.code = code;
  return e;
}

function createStdioSession(opts) {
  const o = opts || {};
  const command = String(o.command || '').trim();
  const defaultTimeoutMs = Number(o.timeoutMs) > 0 ? Number(o.timeoutMs) : 10000;

  let child = null;
  let buf = '';
  let stderr = '';
  let nextId = 1;
  let closed = false;
  let exitInfo = null;
  let spawnError = null;
  const pending = new Map();

  function killTree() {
    const proc = child;
    if (!proc) return;
    child = null;
    try {
      if (process.platform === 'win32' && proc.pid) {
        spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, timeout: 4000 });
      } else {
        try { proc.kill('SIGTERM'); } catch (e) {}
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 1500);
      }
    } catch (e) {}
  }

  function failAll(err) {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
  }

  function onLine(line) {
    let msg = null;
    try { msg = JSON.parse(line); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.id == null || !pending.has(msg.id)) return;
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) {
      const e = mkErr('RPC_ERROR', (msg.error && msg.error.message) || 'json-rpc error');
      e.rpcCode = msg.error && msg.error.code;
      p.reject(e);
    } else {
      p.resolve(msg.result);
    }
  }

  function start() {
    if (child) return { ok: true, pid: child.pid };
    if (closed) return { ok: false, code: 'SESSION_CLOSED', error: 'session already closed' };
    if (!command) return { ok: false, code: 'VALIDATION', error: 'empty command' };
    try {
      child = spawn(command, [], {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: Object.assign({}, process.env),
      });
    } catch (e) {
      child = null;
      return { ok: false, code: 'SPAWN_ERROR', error: String((e && e.message) || e) };
    }
    try { child.stdin.on('error', () => {}); } catch (e) {}
    child.on('error', (e) => {
      spawnError = e;
      failAll(mkErr('SPAWN_ERROR', (e && e.message) || 'spawn failed'));
    });
    child.on('exit', (code, signal) => {
      exitInfo = { code, signal };
      failAll(mkErr('SERVER_EXITED', 'server exited (code ' + code + ') before responding; stderr: ' + stderr.slice(-300)));
    });
    child.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      if (buf.length > MAX_LINE_CHARS * 4) buf = buf.slice(-MAX_LINE_CHARS);
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) onLine(line);
      }
    });
    child.stderr.on('data', (d) => {
      stderr = (stderr + d.toString('utf8')).slice(-MAX_STDERR_CHARS);
    });
    return { ok: true, pid: child.pid };
  }

  function writeLine(obj) {
    if (!child || !child.stdin || child.stdin.destroyed) return false;
    try {
      child.stdin.write(JSON.stringify(obj) + '\n');
      return true;
    } catch (e) {
      return false;
    }
  }

  function request(method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const tms = Number(timeoutMs) > 0 ? Number(timeoutMs) : defaultTimeoutMs;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(mkErr('TIMEOUT', method + ' timed out after ' + tms + 'ms'));
      }, tms);
      pending.set(id, { resolve, reject, timer });
      const sent = writeLine({ jsonrpc: '2.0', id, method, params: params || {} });
      if (!sent) {
        pending.delete(id);
        clearTimeout(timer);
        reject(mkErr(exitInfo || spawnError ? 'SERVER_EXITED' : 'SESSION_CLOSED', 'could not write to server stdin'));
      }
    });
  }

  function notify(method, params) {
    return writeLine({ jsonrpc: '2.0', method, params: params || {} });
  }

  function close() {
    closed = true;
    failAll(mkErr('SESSION_CLOSED', 'session closed'));
    killTree();
  }

  return {
    start,
    request,
    notify,
    close,
    getStderr: () => stderr,
    getExitInfo: () => exitInfo,
    getSpawnError: () => spawnError,
  };
}

module.exports = { createStdioSession };
