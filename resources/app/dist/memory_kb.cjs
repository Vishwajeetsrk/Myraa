/* =============================================================================
 * MYRAA AI OS — Memory & Knowledge (RAG) Layer  (Phase 3)
 * -----------------------------------------------------------------------------
 * Adds a durable knowledge store + retrieval on top of memory_core_service:
 *   • canonical memory TAXONOMY (preference / identity / episodic / semantic /
 *     knowledge / system_fact / location)
 *   • source chunking (~512 tokens) with overlap for document/knowledge intake
 *   • deterministic local embeddings (256-dim hashed n-grams, no deps) with an
 *     optional Gemini text-embedding-004 upgrade when MYRAA_EMBED_REMOTE=1
 *   • cosine retrieval with sources + citations (never throws)
 *   • /api/memory/* HTTP routes + MCP hooks for agents/chat
 *
 * Source of truth = memory_core_service rows (%APPDATA%/MYRAA/memories.json +
 * SQLite). The vector overlay lives in %APPDATA%/MYRAA/memory/kb_index.json and
 * can always be rebuilt from rows. Identity assets are never touched here.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const appData = process.env.APPDATA
  || (process.platform === 'darwin'
    ? path.join(process.env.HOME, 'Library/Application Support')
    : path.join(process.env.HOME, '.config'));
const myraaDataDir = process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
const memoryDir = path.join(myraaDataDir, 'memory');
const kbIndexFile = path.join(memoryDir, 'kb_index.json');

let memoryCore = null;
try { memoryCore = require('./memory_core_service.cjs'); } catch (e) { /* optional */ }

if (!fs.existsSync(memoryDir)) { try { fs.mkdirSync(memoryDir, { recursive: true }); } catch (e) {} }

// ── Taxonomy ─────────────────────────────────────────────────────────────────
const TAXONOMY = {
  preference: 'User likes, dislikes, style and taste choices.',
  identity: 'Facts about the user, their people and relationships.',
  episodic: 'Events, past conversations and things that happened.',
  semantic: 'Learned concepts, explanations and distilled knowledge.',
  knowledge: 'Ingested sources/documents (stored as chunked rows).',
  system_fact: 'Facts about MYRAA itself and this PC.',
  location: 'Location / geo data.',
};
const KB_CATEGORIES = Object.keys(TAXONOMY);

// ── Tokenizer / chunker ──────────────────────────────────────────────────────
function tokenize(text) {
  const s = String(text || '').toLowerCase();
  const words = (s.match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1);
  const bigrams = [];
  for (const w of words) if (w.length >= 3) bigrams.push(w.slice(0, 2), w.slice(-2));
  return words.concat(bigrams);
}

const CHUNK_MAX_WORDS = 512;
function chunkText(text, { maxWords = CHUNK_MAX_WORDS, overlap = 40 } = {}) {
  const src = String(text || '').trim();
  if (!src) return [];
  const sentences = src.replace(/\r?\n{2,}/g, '\n').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).length;
    if (curLen + w > maxWords && cur.length) {
      chunks.push(cur.join(' '));
      cur = cur.slice(-overlap);
      curLen = cur.join(' ').split(/\s+/).length;
    }
    cur.push(s);
    curLen += w;
  }
  if (cur.length) chunks.push(cur.join(' '));
  // hard-split any residual single very long sentence to respect the budget
  const out = [];
  for (const c of chunks) {
    const ws = c.split(/\s+/);
    if (ws.length <= maxWords) { out.push(c); continue; }
    for (let i = 0; i < ws.length; i += maxWords - overlap) out.push(ws.slice(i, i + maxWords).join(' '));
  }
  return out.filter(Boolean);
}

// ── Local embeddings (deterministic, dependency-free) ───────────────────────
const EMBED_DIM = 256;
function hashSign(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h & 0xFFFFFFFF) >= 0x80000000 ? -1 : 1;
}
function embedLocal(text) {
  const v = new Float32Array(EMBED_DIM);
  const toks = tokenize(text);
  if (!toks.length) return v;
  const scored = new Map();
  for (const t of toks) scored.set(t, (scored.get(t) || 0) + 1);
  for (const [t, n] of scored) {
    let h = 0;
    for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) >>> 0; }
    const idx = h % EMBED_DIM;
    const weight = 1 + Math.log(n);
    v[idx] += weight * hashSign(t);
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBED_DIM; i++) v[i] /= norm;
  return v;
}

// ── Optional Gemini embeddings ───────────────────────────────────────────────
let GoogleGenAI = null;
try { ({ GoogleGenAI } = require('@google/genai')); } catch (e) {}
async function embedRemote(text, key) {
  if (process.env.MYRAA_EMBED_REMOTE !== '1' || !GoogleGenAI || !key) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const out = await ai.models.embedContent({ model: 'text-embedding-004', contents: String(text).slice(0, 2000) });
    const values = out && out.embedding && out.embedding.values;
    if (!Array.isArray(values) || !values.length) return null;
    const v = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) v[i] = Number(values[i]);
    let norm = 0; for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1; for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  } catch (e) { return null; }
}

function resolveGeminiKey() {
  try {
    const s = {};
    const secretsPath = path.join(myraaDataDir, 'secrets.json');
    if (fs.existsSync(secretsPath)) Object.assign(s, JSON.parse(fs.readFileSync(secretsPath, 'utf8')));
    let vault = null;
    try { vault = require('./secure_vault.cjs'); } catch (e) {}
    return String(s.geminiApiKey || '').trim()
      || String(process.env.GEMINI_API_KEY || '').trim()
      || (vault ? String(vault.getSecret('GEMINI_API_KEY') || vault.getSecret('GOOGLE_GENERATIVE_AI_API_KEY') || '') : '')
      || null;
  } catch (e) { return null; }
}

// ── Index overlay ───────────────────────────────────────────────────────────
function readIndex() {
  try { return JSON.parse(fs.readFileSync(kbIndexFile, 'utf8')); }
  catch (e) { return []; }
}
function writeIndex(rows) {
  try {
    const tmp = kbIndexFile + '.' + Date.now() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rows), 'utf8');
    fs.renameSync(tmp, kbIndexFile);
    return true;
  } catch (e) { return false; }
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

function buildEntry(mem) {
  const text = String(mem.text || '');
  const vec = embedLocal(text);
  return {
    key: mem.key || mem.id,
    category: mem.category || 'other',
    text,
    vec: Array.from(vec),
    updatedAt: mem.updatedAt || new Date().toISOString(),
    metadata: mem.metadata || {},
  };
}

// ── Knowledge base API ───────────────────────────────────────────────────────
const kb = {
  taxonomy: TAXONOMY,

  remember({ key, text, category = 'preference', metadata = {} } = {}) {
    const t = String(text || '').trim();
    if (!t) return null;
    if (!memoryCore) return null;
    if (category === 'knowledge' && t.length > 600) {
      return this.ingest({ title: key || 'source', text: t, category, metadata });
    }
    const entry = memoryCore.save({ key, category, text: t, metadata });
    if (!entry) return null;
    const idx = readIndex().filter((r) => r.key !== (entry.key || entry.id));
    idx.push(buildEntry(entry));
    writeIndex(idx);
    return { key: entry.key || entry.id, category, ok: true };
  },

  ingest({ title, text, url = '', category = 'knowledge', metadata = {} } = {}) {
    const src = String(text || '').trim();
    if (!src || !memoryCore) return { ok: false, chunks: 0, error: 'no source text' };
    const chunks = chunkText(src);
    const slug = String(title || 'source')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'source';
    const saved = [];
    const idx = readIndex();
    const idxSet = new Set(idx.map((r) => r.key));
    chunks.forEach((chunk, i) => {
      const key = `kb_${slug}_${i}`;
      const md = { ...metadata, sourceTitle: title || slug, sourceUrl: url, chunkIndex: i, chunkCount: chunks.length };
      if (!idxSet.has(key)) {
        memoryCore.save({ key, category, text: chunk, metadata: md });
        idx.push(buildEntry({ key, category, text: chunk, updatedAt: new Date().toISOString(), metadata: md }));
        idxSet.add(key);
      }
      saved.push(key);
    });
    writeIndex(idx);
    return { ok: saved.length > 0, chunks: saved.length, keys: saved };
  },

  search(query) { return memoryCore ? memoryCore.search(query) : []; },

  async retrieve(query, { limit = 4, includeScores = true } = {}) {
    const q = String(query || '').trim();
    if (!q) return { ok: false, memories: [], sources: [], citations: [], error: 'empty query' };
    const qvec = embedLocal(q);
    let idx = readIndex();
    if (!idx.length && memoryCore) {
      // rebuild index lazily from the source of truth
      idx = memoryCore.getAll().map(buildEntry);
      if (idx.length) writeIndex(idx);
    }
    const scored = idx
      .map((r) => ({ r, score: cosine(qvec, r.vecGemini || r.vec || []) }))
      .filter((s) => Number.isFinite(s.score) && s.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const memories = scored.map(({ r, score }) => ({
      key: r.key, text: r.text, category: r.category, score: includeScores ? Number(score.toFixed(4)) : undefined,
      updatedAt: r.updatedAt, metadata: r.metadata || {},
    }));
    const sources = memories.map((m) => ({ key: m.key, category: m.category, title: (m.metadata && m.metadata.sourceTitle) || m.key }));
    return {
      ok: true,
      query: q,
      memories,
      sources,
      citations: sources.map((s) => s.key),
      backend: 'local_embed',
      count: memories.length,
    };
  },

  async recall(query, opts) { return this.retrieve(query, opts); },

  buildContext(query, limit = 3) {
    // synchronous light view for chat: reuse local read + cosine inline
    const q = String(query || '').trim();
    if (!q || !memoryCore) return '';
    const idx = readIndex();
    const list = idx.length ? idx : memoryCore.getAll().map(buildEntry);
    const qvec = embedLocal(q);
    const top = list
      .map((r) => ({ r, score: cosine(qvec, r.vecGemini || r.vec || []) }))
      .filter((s) => s.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    if (!top.length) return '';
    const lines = ['\n[MYRAA MEMORY CONTEXT (semantic recall)]'];
    for (const { r, score } of top) {
      const label = (r.metadata && r.metadata.sourceTitle) || r.key;
      lines.push(`- (${r.category}, ${score.toFixed(2)}) [${label}] ${String(r.text).slice(0, 280)}`);
    }
    lines.push('[/MYRAA MEMORY CONTEXT]');
    return lines.join('\n');
  },

  stats() {
    const rows = memoryCore ? memoryCore.getAll() : [];
    const counts = {};
    for (const r of rows) {
      const c = r.category || 'other';
      counts[c] = (counts[c] || 0) + 1;
    }
    return {
      total: rows.length,
      categories: counts,
      index_entries: readIndex().length,
      vector_dim: EMBED_DIM,
      backend: 'local_embed' + (process.env.MYRAA_EMBED_REMOTE === '1' ? '+gemini' : ''),
      index_file: kbIndexFile,
    };
  },

  rebuildIndex() {
    if (!memoryCore) return { ok: false };
    const idx = memoryCore.getAll().map(buildEntry);
    const ok = writeIndex(idx);
    return { ok, entries: idx.length };
  },

  // Re-embed all rows with Gemini text-embedding-004 (opt-in, async).
  async upgradeRemote(concurrency = 2) {
    if (process.env.MYRAA_EMBED_REMOTE !== '1') return { ok: false, skipped: true, reason: 'MYRAA_EMBED_REMOTE != 1' };
    const key = resolveGeminiKey();
    if (!key) return { ok: false, skipped: true, reason: 'no gemini key' };
    if (!memoryCore) return { ok: false, skipped: true, reason: 'no memory core' };
    const rows = memoryCore.getAll();
    const idx = readIndex().map((r) => ({ ...r, vecGemini: null, backend: 'gemini' }));
    const byKey = new Map(idx.map((r) => [r.key, r]));
    for (const row of rows) {
      const key2 = row.key || row.id;
      try {
        const vec = await embedRemote(String(row.text || ''), key);
        if (vec && byKey.has(key2)) byKey.get(key2).vecGemini = Array.from(vec);
      } catch (e) { /* keep local */ }
    }
    const ok = writeIndex(Array.from(byKey.values()));
    return { ok, entries: idx.length, embedded: idx.filter((r) => r.vecGemini).length };
  },

  remove(key) {
    if (!memoryCore) return false;
    memoryCore.delete(key);
    writeIndex(readIndex().filter((r) => r.key !== key));
    return true;
  },
};

// ── HTTP routes /api/memory/* ────────────────────────────────────────────────
const router = express.Router();

router.get('/api/memory/stats', (req, res) => { res.json({ ok: true, ...kb.stats() }); });
router.get('/api/memory/taxonomy', (req, res) => { res.json({ ok: true, taxonomy: TAXONOMY, categories: KB_CATEGORIES }); });
router.get('/api/memory', (req, res) => {
  const list = memoryCore ? memoryCore.getAll(req.query.category || null) : [];
  res.json({ ok: true, total: list.length, memories: list.map((m) => ({ key: m.key || m.id, category: m.category, text: m.text, createdAt: m.createdAt, updatedAt: m.updatedAt, metadata: m.metadata || {} })) });
});
router.post('/api/memory/remember', (req, res) => {
  const { key, text, category, metadata } = req.body || {};
  if (!text) return res.status(400).json({ ok: false, error: 'text is required' });
  const out = kb.remember({ key, text, category, metadata });
  if (!out) return res.status(500).json({ ok: false, error: 'memory write failed' });
  res.json({ ok: true, ...out });
});
router.post('/api/memory/knowledge', (req, res) => {
  const { title, text, url, metadata } = req.body || {};
  const out = kb.ingest({ title, text, url, metadata });
  if (!out.ok) return res.status(400).json(out);
  res.json({ ok: true, chunks: out.chunks, keys: out.keys });
});
router.get('/api/memory/retrieve', async (req, res) => {
  const q = String(req.query.q || req.query.query || '').trim();
  if (!q) return res.status(400).json({ ok: false, memory: [], error: 'q is required' });
  const out = await kb.retrieve(q, { limit: Number(req.query.limit) || 4 });
  res.json(out);
});
router.post('/api/memory/retrieve', async (req, res) => {
  const q = String((req.body && (req.body.query || req.body.q)) || '').trim();
  if (!q) return res.status(400).json({ ok: false, memories: [], error: 'query is required' });
  const out = await kb.retrieve(q, { limit: Number((req.body && req.body.limit)) || 4 });
  res.json(out);
});
router.delete('/api/memory/:key', (req, res) => {
  const ok = kb.remove(req.params.key);
  res.json({ ok: Boolean(ok) });
});
router.post('/api/memory/index/rebuild', async (req, res) => {
  const remote = Boolean(req.body && req.body.remote === true);
  if (remote) {
    const out = await kb.upgradeRemote();
    return res.json({ ok: out.ok, skipped: Boolean(out.skipped), reason: out.reason, entries: out.entries, embedded: out.embedded });
  }
  const out = kb.rebuildIndex();
  res.json({ ok: out.ok, entries: out.entries });
});

module.exports = { kb, router, TAXONOMY, embedLocal, chunkText, tokenize }; // eslint-disable-line