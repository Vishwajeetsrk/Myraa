'use strict';
/**
 * git_service.cjs — Real Local Git CLI Wrapper
 * MYRAA Coding Agent — Phase 2
 *
 * Provides: init, add, commit, push, pull, branch, checkout, status, log, diff,
 *           remote management, stash, merge, clone, and more.
 *
 * All operations use child_process.execSync/spawn on the real `git` CLI.
 * Requires: Git for Windows on PATH (C:\Program Files\Git\cmd).
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const GIT_TIMEOUT = 60_000;
const LONG_GIT_TIMEOUT = 300_000;

function _findGit() {
  const candidates = [
    'git',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
  ];
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { timeout: 5000, stdio: 'pipe' });
      return c;
    } catch { /* skip */ }
  }
  return 'git';
}

const GIT_BIN = _findGit();

function _run(cwd, args, opts = {}) {
  const timeout = opts.timeout || GIT_TIMEOUT;
  const cmd = `"${GIT_BIN}" ${args}`;
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
      ...opts,
    });
    return { ok: true, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : '';
    const stdout = err.stdout ? String(err.stdout).trim() : '';
    return {
      ok: false,
      stdout,
      stderr: stderr || err.message,
      exitCode: err.status || 1,
    };
  }
}

function _runStream(cwd, args, onLine, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(GIT_BIN, args.split(' '), { cwd, shell: true });
    let stdout = '';
    let stderr = '';
    const timeout = opts.timeout || GIT_TIMEOUT;
    const timer = setTimeout(() => { proc.kill(); }, timeout);
    proc.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      s.split('\n').filter(Boolean).forEach(onLine);
    });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: e.message, exitCode: 1 });
    });
  });
}

// ── Repository Detection ─────────────────────────────────────────────────────

function isGitRepo(dir) {
  const r = _run(dir, 'rev-parse --is-inside-work-tree');
  return r.ok && r.stdout === 'true';
}

function getRepoRoot(dir) {
  const r = _run(dir, 'rev-parse --show-toplevel');
  return r.ok ? r.stdout : null;
}

function detectProject(dir) {
  const info = { isRepo: false, root: null, branch: null, remote: null, clean: true, uncommitted: [], untracked: [] };
  info.isRepo = isGitRepo(dir);
  if (!info.isRepo) return info;
  info.root = getRepoRoot(dir);
  const status = _run(dir, 'status --porcelain -b');
  if (status.ok) {
    const lines = status.stdout.split('\n');
    const header = lines[0] || '';
    const branchMatch = header.match(/^## (.+?)(?:\.\.\.(.+))?$/);
    if (branchMatch) {
      info.branch = branchMatch[1];
      info.remote = branchMatch[2] || null;
    }
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 2) continue;
      const x = line[0], y = line[1], file = line.substring(3);
      if (x === '?' && y === '?') {
        info.untracked.push(file);
      } else {
        info.uncommitted.push({ status: `${x}${y}`, file });
      }
    }
    info.clean = info.uncommitted.length === 0 && info.untracked.length === 0;
  }
  return info;
}

// ── Core Git Operations ──────────────────────────────────────────────────────

function init(dir) {
  return _run(dir, 'init');
}

function clone(url, targetDir) {
  return _run(path.dirname(targetDir), `clone "${url}" "${path.basename(targetDir)}"`, { timeout: LONG_GIT_TIMEOUT });
}

function add(dir, files = '.') {
  const fileArgs = Array.isArray(files) ? files.map(f => `"${f}"`).join(' ') : `"${files}"`;
  return _run(dir, `add ${fileArgs}`);
}

function commit(dir, message) {
  return _run(dir, `commit -m "${message.replace(/"/g, '\\"')}"`, { timeout: LONG_GIT_TIMEOUT });
}

function push(dir, remote = 'origin', branch = null, setUpstream = false) {
  const b = branch || _getCurrentBranch(dir);
  const flags = setUpstream ? ' -u' : '';
  return _run(dir, `push${flags} "${remote}" "${b}"`, { timeout: LONG_GIT_TIMEOUT });
}

function pull(dir, remote = 'origin', branch = null) {
  const b = branch || _getCurrentBranch(dir);
  return _run(dir, `pull "${remote}" "${b}"`, { timeout: LONG_GIT_TIMEOUT });
}

function fetch(dir, remote = 'origin') {
  return _run(dir, `fetch "${remote}"`, { timeout: LONG_GIT_TIMEOUT });
}

function status(dir) {
  return _run(dir, 'status --porcelain -b');
}

function log(dir, opts = {}) {
  const count = opts.count || 20;
  const format = opts.format || 'pretty=format:%h|%an|%ai|%s';
  return _run(dir, `log -${count} ${format}`);
}

function logDetailed(dir, count = 5) {
  const r = _run(dir, `log -${count} --stat --pretty=format:"COMMIT_START%n%h%n%an%n%ai%n%s%n%b"`);
  if (!r.ok) return r;
  const commits = [];
  const blocks = r.stdout.split('COMMIT_START').filter(s => s.trim());
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    commits.push({
      hash: lines[0] || '',
      author: lines[1] || '',
      date: lines[2] || '',
      message: lines[3] || '',
      body: lines.slice(4).join('\n').trim(),
    });
  }
  return { ok: true, commits, raw: r.stdout };
}

function diff(dir, opts = {}) {
  const args = ['diff'];
  if (opts.cached) args.push('--cached');
  if (opts.file) args.push(`"${opts.file}"`);
  if (opts.stat) args.push('--stat');
  if (opts.nameOnly) args.push('--name-only');
  return _run(dir, args.join(' '));
}

function diffSummary(dir) {
  return _run(dir, 'diff --stat');
}

function diffStaged(dir) {
  return _run(dir, 'diff --cached --stat');
}

function show(dir, commitHash = 'HEAD') {
  return _run(dir, `show ${commitHash} --stat`);
}

// ── Branch Operations ────────────────────────────────────────────────────────

function _getCurrentBranch(dir) {
  const r = _run(dir, 'branch --show-current');
  return r.ok ? r.stdout : 'main';
}

function branch(dir, name = null) {
  if (name) return _run(dir, `branch "${name}"`);
  return _run(dir, 'branch');
}

function checkout(dir, target) {
  return _run(dir, `checkout "${target}"`);
}

function createAndCheckout(dir, branchName) {
  return _run(dir, `checkout -b "${branchName}"`);
}

function deleteBranch(dir, name, force = false) {
  return _run(dir, `branch ${force ? '-D' : '-d'} "${name}"`);
}

function merge(dir, branch) {
  return _run(dir, `merge "${branch}"`);
}

// ── Remote Operations ────────────────────────────────────────────────────────

function remote(dir, action = 'list', name = null, url = null) {
  switch (action) {
    case 'list': return _run(dir, 'remote -v');
    case 'add': return _run(dir, `remote add "${name}" "${url}"`);
    case 'remove': return _run(dir, `remote remove "${name}"`);
    case 'set-url': return _run(dir, `remote set-url "${name}" "${url}"`);
    default: return { ok: false, stderr: `Unknown remote action: ${action}` };
  }
}

// ── Stash Operations ─────────────────────────────────────────────────────────

function stash(dir, action = 'save', message = null) {
  switch (action) {
    case 'save': return _run(dir, `stash save${message ? ` "${message}"` : ''}`);
    case 'pop': return _run(dir, 'stash pop');
    case 'apply': return _run(dir, 'stash apply');
    case 'list': return _run(dir, 'stash list');
    case 'drop': return _run(dir, 'stash drop');
    case 'clear': return _run(dir, 'stash clear');
    default: return { ok: false, stderr: `Unknown stash action: ${action}` };
  }
}

// ── Tag Operations ───────────────────────────────────────────────────────────

function tag(dir, name = null, message = null) {
  if (name && message) return _run(dir, `tag -a "${name}" -m "${message.replace(/"/g, '\\"')}"`);
  if (name) return _run(dir, `tag "${name}"`);
  return _run(dir, 'tag');
}

// ── Undo/Safety ──────────────────────────────────────────────────────────────

function resetFile(dir, filePath) {
  return _run(dir, `checkout -- "${filePath}"`);
}

function resetHard(dir, commit = 'HEAD~1') {
  return _run(dir, `reset --hard ${commit}`);
}

function revert(dir, commitHash) {
  return _run(dir, `revert ${commitHash}`);
}

function undoLastCommit(dir, keepChanges = true) {
  const flag = keepChanges ? '--soft' : '--hard';
  return _run(dir, `reset ${flag} HEAD~1`);
}

// ── Ignore Management ────────────────────────────────────────────────────────

function addGitignore(dir, patterns) {
  const ignorePath = path.join(dir, '.gitignore');
  const existing = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf-8') : '';
  const lines = Array.isArray(patterns) ? patterns : [patterns];
  const newEntries = lines.filter(l => !existing.includes(l));
  if (newEntries.length === 0) return { ok: true, message: 'Already ignored' };
  const addition = '\n' + newEntries.join('\n') + '\n';
  fs.appendFileSync(ignorePath, addition, 'utf-8');
  return { ok: true, added: newEntries };
}

// ── History Search ───────────────────────────────────────────────────────────

function searchLog(dir, query) {
  return _run(dir, `log --all --oneline --grep="${query.replace(/"/g, '\\"')}"`);
}

function searchLogByFile(dir, filePath) {
  return _run(dir, `log --oneline -- "${filePath}"`);
}

function blame(dir, filePath) {
  return _run(dir, `blame "${filePath}"`);
}

function getFileAtCommit(dir, filePath, commitHash) {
  return _run(dir, `show ${commitHash}:"${filePath}"`);
}

// ── Conflict Resolution ─────────────────────────────────────────────────────

function listConflicts(dir) {
  const r = _run(dir, 'diff --name-only --diff-filter=U');
  if (!r.ok) return { ok: true, conflicts: [] };
  return { ok: true, conflicts: r.stdout.split('\n').filter(Boolean) };
}

function resolveConflicts(dir, files) {
  const fileArgs = Array.isArray(files) ? files.map(f => `"${f}"`).join(' ') : `"${files}"`;
  return _run(dir, `add ${fileArgs}`);
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getConfig(dir, key = null) {
  if (key) return _run(dir, `config --get ${key}`);
  return _run(dir, 'config --list');
}

function setConfig(dir, key, value) {
  return _run(dir, `config ${key} "${value}"`);
}

function getCurrentCommit(dir) {
  return _run(dir, 'rev-parse HEAD');
}

function getCurrentShortHash(dir) {
  return _run(dir, 'rev-parse --short HEAD');
}

// ── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  GIT_BIN,
  isGitRepo,
  getRepoRoot,
  detectProject,
  init,
  clone,
  add,
  commit,
  push,
  pull,
  fetch,
  status,
  log,
  logDetailed,
  diff,
  diffSummary,
  diffStaged,
  show,
  branch,
  checkout,
  createAndCheckout,
  deleteBranch,
  merge,
  remote,
  stash,
  tag,
  resetFile,
  resetHard,
  revert,
  undoLastCommit,
  addGitignore,
  searchLog,
  searchLogByFile,
  blame,
  getFileAtCommit,
  listConflicts,
  resolveConflicts,
  getConfig,
  setConfig,
  getCurrentCommit,
  getCurrentShortHash,
};
