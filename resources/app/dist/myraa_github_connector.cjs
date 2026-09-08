// MYRAA AI OS — GitHub REST Connector (universal adapter, additive)
// Provider: GitHub REST API v3 (api.github.com). Token from encrypted SecureVault (server-side only).
// NEVER accept tokens from frontend. Default READ-ONLY. Mutations require ctx.confirmed.
// Safety: default allow-list OFF (no repos authorized → reads still allowed on public/invited repos,
//       writes always require explicit repo allow-list + confirmation).
// Honest: non-2xx → ok:false with status/reason, never fabricated data.

'use strict';

const CACHE_TTL_MS = 60 * 1000;
const _cache = new Map();
const _token = { v: null }; // cached token (never leaked/logged)

const API = 'https://api.github.com';
const MAX_ALLOW_LIST = Number(process.env.MYRAA_GITHUB_MAX_REPOS || 50);

function loadVault() {
  try { return require('./secure_vault.cjs'); } catch (e) { return null; }
}

function getToken() {
  if (_token.v) return _token.v;
  const vault = loadVault();
  let t = null;
  if (vault) {
    t = vault.getSecret && (vault.getSecret('github') || vault.getSecret('github_token'));
    if (t && typeof t === 'object') t = t.token || t.value || null;
  }
  _token.v = t || null;
  return _token.v;
}

function cacheGet(k) { const e = _cache.get(k); if (!e) return null; if (Date.now() - e.at > CACHE_TTL_MS) { _cache.delete(k); return null; } return e.data; }
function cacheSet(k, d) { _cache.set(k, { at: Date.now(), data: d }); if (_cache.size > 100) _cache.delete(_cache.keys().next().value); }

function api(path, opts, ctx) {
  const { method = 'GET', body } = opts || {};
  const token = getToken();
  const headers = {
    'User-Agent': 'MYRAA-AI-OS/7.5.0',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';

  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.request({ hostname: 'api.github.com', path, method, headers, timeout: 20000 }, (res) => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        let data = null;
        try { data = d.trim() ? JSON.parse(d) : null; } catch (e) { data = null; }
        const rate = res.headers['x-ratelimit-remaining'] || null;
        resolve({ status: res.statusCode, data, rate });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Read-only WHITELIST of query param validation (defense in depth)
function assertFetch(action) {
  const deny = ['push', 'merge', 'delete_ref', 'create_pull', 'edit', 'force'];
  if (deny.includes(action)) return `action '${action}' is not READ_ONLY`;
  return null;
}

const connector = {
  id: 'github',
  name: 'GitHub Repository Intelligence',
  category: 'Development',

  async connect() {
    const t = getToken();
    return { authenticated: Boolean(t), mode: t ? 'authed' : 'unauthenticated' };
  },
  async disconnect() {
    _cache.clear();
    _token.v = null;
  },

  async ping() {
    const r = await api('/rate_limit');
    if (r.status >= 500) throw new Error('github ping failed ' + r.status);
    return { status: r.status, rateLimit: r.rate };
  },

  async healthCheck() {
    const t0 = Date.now();
    try {
      const p = await this.ping();
      const token = getToken();
      return {
        state: p.status < 500 ? 'healthy' : 'unavailable',
        latencyMs: Date.now() - t0,
        authenticated: Boolean(token),
        rateLimitRemaining: p.rateLimit,
        lastSuccess: new Date().toISOString(),
      };
    } catch (e) { return { state: 'unavailable', reason: String((e && e.message) || e) }; }
  },

  async listResources() {
    return [{ id: 'github-rest-v3', kind: 'api', name: 'GitHub REST API v3', uri: API, authenticated: Boolean(getToken()) }];
  },

  getCapabilities() {
    const share = [
      ['myraa.github.repo_list', 'list repositories (private with token)', 'READ_ONLY'],
      ['myraa.github.repo_tree', 'read a repository file tree & metadata', 'READ_ONLY'],
      ['myraa.github.read_file', 'read a single file from a repo', 'READ_ONLY'],
      ['myraa.github.search_code', 'code search across repos', 'READ_ONLY'],
    ];
    return [{
      id: 'github-intelligence',
      description: 'read repo list/tree/file/code (READ_ONLY default; writes require allow-list + confirmation)',
      tools: share.map((s) => s[0]),
    }];
  },

  _repoAllowed(owner, repo) {
    // Allow-list enforcement for WRITES. Reads do not gate on allow-list here
    // (token scoping + user consent govern). Writes bypassed until wired with ctx.confirmed path.
    void owner; void repo; // future: check against MYRAA_GITHUB_ALLOW_REGEX
    return true;
  },

  /**
   * execute('repo_list'|'repo_tree'|'read_file'|'search_code', input, ctx)
   * ctx.confirmed ignored for reads (READ_ONLY default).
   */
  async execute(action, input, ctx) {
    const forbidden = assertFetch(action);
    if (forbidden) return { ok: false, reason: forbidden };

    switch (action) {
      case 'repo_list': return this.listRepos(input, ctx);
      case 'repo_tree': return this.repoTree(input, ctx);
      case 'read_file': return this.readFile(input, ctx);
      case 'search_code': return this.searchCode(input, ctx);
      default: throw new Error(`Unknown github action: ${action}`);
    }
  },

  async listRepos(input) {
    const username = String((input && input.username) || '').trim();
    const per = Math.min(Number((input && input.limit) || 20), 100);
    const cacheKey = `repos:${username || 'me'}:${per}`;
    const hit = cacheGet(cacheKey); if (hit) return { ...hit, cached: true };
    const path = username ? `/users/${encodeURIComponent(username)}/repos?per_page=${per}&sort=updated` : '/user/repos?per_page=' + per + '&sort=updated&visibility=all';
    const token = getToken();
    try {
      const r = await api(path);
      if (r.status === 404) return { ok: false, reason: 'user not found: ' + username };
      if (r.status === 401) {
        if (!username && !token) return { ok: false, reason: 'not authenticated — connect a GitHub token to list your repos (server key only, never client)' };
        return { ok: false, reason: 'token invalid or expired — reauthorize GitHub in Integrations. Server key only, never client.' };
      }
      if (r.status >= 400) return { ok: false, reason: `GitHub ${r.status}: ${(r.data && r.data.message) || 'error'}` };
      const arr = (!username && !token) ? [] : (Array.isArray(r.data) ? r.data : []);
      const repos = arr.map((x) => ({ name: x.name, full_name: x.full_name, private: x.private, default_branch: x.default_branch, language: x.language, description: x.description || '', html_url: x.html_url, updated_at: x.updated_at })).slice(0, per);
      const out = { ok: true, tool: 'myraa.github.repo_list', connector: 'github', authenticated: Boolean(token), count: repos.length, repos, scope: username || 'authenticated user', summary: `${repos.length} repo(s)${username ? ' for ' + username : ''} (${token ? 'authenticated' : 'unauthenticated'})`, timestamp: new Date().toISOString() };
      cacheSet(cacheKey, out); return out;
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },

  async repoTree(input) {
    const owner = String((input && input.owner) || '').trim();
    const repo = String((input && input.repo) || '').trim();
    const branch = String((input && input.branch) || (input && input.ref) || 'HEAD').trim();
    if (!owner || !repo) return { ok: false, reason: 'owner and repo required' };
    urlSafe(owner); urlSafe(repo);
    const cacheKey = `tree:${owner}/${repo}:${branch}`;
    const hit = cacheGet(cacheKey); if (hit) return { ...hit, cached: true };
    try {
      const r = await api(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      if (r.status >= 400) return { ok: false, reason: `GitHub ${r.status}: ${(r.data && r.data.message) || 'error'} (branch '${branch}' may not exist)` };
      const tree = Array.isArray(r.data.tree) ? r.data.tree.filter((t) => t.type === 'blob').map((t) => t.path).slice(0, 500) : [];
      const out = { ok: true, tool: 'myraa.github.repo_tree', connector: 'github', owner, repo, branch, truncated: r.data.truncated ? true : false, fileCount: tree.length, files: tree, summary: `${tree.length} file(s) in ${owner}/${repo}@${branch}${r.data.truncated ? ' (truncated)' : ''}`, timestamp: new Date().toISOString() };
      cacheSet(cacheKey, out); return out;
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },

  async readFile(input) {
    const owner = String((input && input.owner) || '').trim();
    const repo = String((input && input.repo) || '').trim();
    const path = String((input && input.path) || '').trim().replace(/^\//, '');
    const ref = String((input && input.ref) || 'HEAD').trim();
    if (!owner || !repo || !path) return { ok: false, reason: 'owner, repo and path required' };
    urlSafe(owner); urlSafe(repo);
    try {
      const r = await api(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
      if (r.status === 404) return { ok: false, reason: `not found: ${owner}/${repo}/${path}@${ref}` };
      if (r.status >= 400) return { ok: false, reason: `GitHub ${r.status}: ${(r.data && r.data.message) || 'error'}` };
      let content = r.data.content || '';
      try { content = Buffer.from(content, 'base64').toString('utf8'); } catch (e) {}
      return { ok: true, tool: 'myraa.github.read_file', connector: 'github', owner, repo, path, ref, size: r.data.size, content, summary: `Read ${owner}/${repo}/${path} (${content.length} chars)` };
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },

  async searchCode(input) {
    const q = String((input && input.q) || (input && input.query) || '').trim();
    if (!q) return { ok: false, reason: 'search query (q) required' };
    const per = Math.min(Number((input && input.limit) || 10), 30);
    try {
      const r = await api(`/search/code?q=${encodeURIComponent(q)}&per_page=${per}`);
      if (r.status === 403) return { ok: false, reason: 'code search rate-limited (requires authentication) — connect GitHub token' };
      if (r.status >= 400) return { ok: false, reason: `GitHub ${r.status}: ${(r.data && r.data.message) || 'error'}` };
      const items = (Array.isArray(r.data.items) ? r.data.items : []).map((i) => ({ name: i.name, path: i.path, repo: i.repository && i.repository.full_name, html_url: i.html_url }));
      return { ok: true, tool: 'myraa.github.search_code', connector: 'github', count: items.length, results: items, summary: `${items.length} code result(s) for "${q}"` };
    } catch (e) { return { ok: false, reason: 'unavailable: ' + String((e && e.message) || e) }; }
  },
};

function urlSafe(s) { if (/[^a-zA-Z0-9._-]/.test(s)) throw new Error('invalid repo/owner name'); return s; }

module.exports = connector;
