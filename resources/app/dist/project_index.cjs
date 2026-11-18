'use strict';
/**
 * Phase 12: real project + memory index. Nothing here invents a project,
 * a file count, a conversation or a memory. Unreadable stores report null.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist-release', 'win-unpacked', '.cache', 'AppData', 'Temp', 'logs']);
const MAX_PROJECTS = 50;
const MAX_FILES = 2000;

function dataDir() {
  return process.env.MYRAA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'MYRAA');
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function countEntries(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    const arrays = Object.values(value).filter(Array.isArray);
    if (arrays.length) return arrays.reduce((n, a) => n + a.length, 0);
    return Object.keys(value).length;
  }
  return null;
}
function gitInfo(dir) {
  const gitDir = path.join(dir, '.git');
  try {
    if (!fs.existsSync(gitDir)) return { isRepo: false, branch: null, lastCommit: null };
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const branch = head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : null;
    let sha = head;
    if (branch) {
      const refFile = path.join(gitDir, 'refs', 'heads', branch);
      if (fs.existsSync(refFile)) sha = fs.readFileSync(refFile, 'utf8').trim();
    }
    let lastCommit = null;
    const logFile = path.join(gitDir, 'logs', 'HEAD');
    if (fs.existsSync(logFile)) {
      const lines = fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);
      lastCommit = lines.length ? lines[lines.length - 1].slice(0, 160) : null;
    }
    return { isRepo: true, branch, sha: sha && sha.slice(0, 12), lastCommit };
  } catch (e) { return { isRepo: true, branch: null, lastCommit: null, error: e.message }; }
}
function countFiles(dir) {
  let count = 0;
  try {
    const walk = (d) => {
      if (count >= MAX_FILES) return;
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (count >= MAX_FILES) return;
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) walk(path.join(d, entry.name));
        } else if (entry.isFile()) count++;
      }
    };
    walk(dir);
  } catch (e) { return null; }
  return count;
}

function roots() {
  const list = [];
  if (process.env.MYRAA_PROJECT_DIR) list.push(process.env.MYRAA_PROJECT_DIR);
  const repo = path.resolve(__dirname, '..', '..', '..');
  list.push(repo);
  const projectsDir = path.join(repo, 'Projects');
  if (fs.existsSync(projectsDir)) list.push(projectsDir);
  return Array.from(new Set(list.filter((p) => p && fs.existsSync(p))));
}
function discover() {
  const found = new Map();
  for (const root of roots()) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const dir = path.join(root, e.name);
      const marker = ['package.json', '.git', 'SKILL.md', 'pyproject.toml', 'Cargo.toml'].some((f) => fs.existsSync(path.join(dir, f)));
      if (!marker) continue;
      if (!found.has(dir)) found.set(dir, { name: e.name, path: dir });
    }
  }
  return Array.from(found.values()).slice(0, MAX_PROJECTS);
}
function projectView(p) {
  const git = gitInfo(p.path);
  const tasks = require('./task_engine.cjs').list({ limit: 100 });
  const relevantTasks = tasks.tasks.filter((t) => t.goal && t.goal.toLowerCase().includes(p.name.toLowerCase())).length;
  const files = countFiles(p.path);
  return {
    name: p.name,
    path: p.path,
    files: files === null ? null : files,
    filesTruncated: files !== null && files >= MAX_FILES,
    git,
    tasks: relevantTasks,
    conversations: null,
    memories: null,
    agents: null,
    tools: null,
    environments: fs.existsSync(path.join(p.path, '.env')) ? ['.env (present, values never read)'] : [],
    dependencies: (() => {
      const pkg = readJson(path.join(p.path, 'package.json'));
      return pkg && pkg.dependencies ? Object.keys(pkg.dependencies).length : null;
    })(),
    notes: null,
    activity: null,
    status: 'DISCOVERED',
  };
}
function list() { return discover().map(projectView); }

function memoryOverview() {
  const stores = [];
  const candidates = [
    { name: 'legacy memories.json', path: path.join(dataDir(), 'memories.json') },
    { name: 'cognition memories.v1.json', path: path.join(dataDir(), 'cognition', 'memories.v1.json') },
    { name: 'knowledge kb_index.json', path: path.join(dataDir(), 'memory', 'kb_index.json') },
    { name: 'sqlite myraa_memory.db', path: path.join(dataDir(), 'memory', 'myraa_memory.db') },
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c.path)) { stores.push({ name: c.name, path: c.path, present: false, count: null, error: 'not found' }); continue; }
    if (c.path.endsWith('.db')) {
      let size = null;
      try { size = fs.statSync(c.path).size; } catch (e) {}
      stores.push({ name: c.name, path: c.path, present: true, count: null, bytes: size, error: 'SQLite not queried in-process - count unknown (honest null)' });
    } else {
      const data = readJson(c.path);
      stores.push({ name: c.name, path: c.path, present: true, count: data === null ? null : countEntries(data), error: data === null ? 'unreadable JSON - count unknown' : null });
    }
  }
  return {
    ok: true,
    sources: stores,
    totalKnown: stores.reduce((n, s) => n + (Number.isFinite(s.count) ? s.count : 0), 0),
    note: 'counts are per real store; null means unreadable or not queryable, never zero',
  };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/list', (req, res) => res.json({ ok: true, count: list().length, projects: list() }));
  router.get('/memory-overview', (req, res) => res.json(memoryOverview()));
  return router;
}
module.exports = { discover, list, memoryOverview, createRouter };
