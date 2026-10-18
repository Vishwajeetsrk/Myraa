'use strict';
/**
 * MYRAA Investigation skills (Phase 17).
 * Local, no-daemon decoders that turn artifact bytes into EVIDENCE for the
 * Phase 16 evidence engine. Pattern-level REA work only: no code copied
 * (REA license unverified), no target execution, everything hash-backed and
 * bounded.
 *
 * Skills in catalog:
 *   investigate_feature   ("how does <app> implement <thing>")
 *   compare_versions      ("compare the two builds")
 *   trace_crash           ("analyze the crash dump")
 *   verify_reconstruction ("does my rewrite match the original")
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_HASH_BYTES = 64 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;
const MAX_ASAR_ENTRIES = 2000;
const MAX_STRINGS = 800;
const MAX_HIT_LINES = 40;
const MAX_SEARCH_FILES = 400;

const SKILL_CATALOG = [
  { id: 'investigate_feature', intent: 'investigate_feature', summary: 'find where a feature is implemented in a local source tree and record line-level evidence' },
  { id: 'compare_versions', intent: 'compare_artifacts', summary: 'diff two artifact investigation sessions by inference + evidence hash' },
  { id: 'trace_crash', intent: 'trace_crash', summary: 'scan crash dumps/logs for stack signatures and record observed strings as evidence' },
  { id: 'verify_reconstruction', intent: 'verify_reconstruction', summary: 'compare an original artifact against a reimplementation by hash + string-set overlap' },
];

function sha256File(filePath) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return { ok: false, error: 'not a regular file' };
    const h = crypto.createHash('sha256');
    const fd = fs.openSync(filePath, 'r');
    try {
      const chunk = Buffer.alloc(1024 * 1024);
      let remaining = 0;
      while (true) {
        const n = fs.readSync(fd, chunk, 0, chunk.length, remaining);
        if (n <= 0) break;
        h.update(chunk.slice(0, n));
        remaining += n;
        if (remaining > MAX_HASH_BYTES) {
          fs.closeSync(fd);
          return { ok: false, error: 'file exceeds ' + MAX_HASH_BYTES + ' byte analysis cap' };
        }
      }
    } finally {
      try { fs.closeSync(fd); } catch (e) {}
    }
    return { ok: true, sha256: h.digest('hex'), sizeBytes: st.size };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

function extractStrings(buf, minLen, cap) {
  const min = Math.max(4, Number(minLen) || 4);
  const limit = Math.min(MAX_STRINGS, Number(cap) || MAX_STRINGS);
  const out = [];
  let runStart = -1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    const printable = (c >= 32 && c <= 126);
    if (printable) {
      if (runStart < 0) runStart = i;
    } else {
      if (runStart >= 0 && i - runStart >= min) {
        out.push({ offset: runStart, text: checkAndSlice(buf, runStart, i) });
        if (out.length >= limit) break;
      }
      runStart = -1;
    }
  }
  if (runStart >= 0 && buf.length - runStart >= min && out.length < limit) {
    out.push({ offset: runStart, text: checkAndSlice(buf, runStart, buf.length) });
  }
  return out;
}

function checkAndSlice(buf, a, b) {
  return buf.slice(a, b).toString('ascii');
}

function peekPe(buf) {
  if (buf.length < 64 || buf[0] !== 0x4d || buf[1] !== 0x5a) return { isPe: false };
  const peOff = buf.readUInt32LE(0x3c);
  if (peOff <= 0 || peOff + 24 > buf.length) return { isPe: false, corrupt: 'bad e_lfanew' };
  if (buf[peOff] !== 0x50 || buf[peOff + 1] !== 0x45) return { isPe: false, corrupt: 'PE signature missing' };
  const machineMap = { 0x8664: 'x64', 0x014c: 'x86', 0xaa64: 'arm64', 0x01c4: 'arm' };
  const machine = buf.readUInt16LE(peOff + 4);
  const numSections = buf.readUInt16LE(peOff + 6);
  const timestamp = new Date(buf.readUInt32LE(peOff + 8) * 1000).toISOString();
  const characteristics = buf.readUInt16LE(peOff + 22);
  const optMagic = buf.readUInt16LE(peOff + 24);
  return {
    isPe: true,
    machine: machineMap[machine] || '0x' + machine.toString(16),
    sections: numSections,
    linkTimeUtc: timestamp,
    characteristicsHex: '0x' + characteristics.toString(16),
    optMagic: optMagic === 0x20b ? 'PE32+' : (optMagic === 0x10b ? 'PE32' : '0x' + optMagic.toString(16)),
  };
}

function listAsar(buf) {
  if (buf.length < 20) return { ok: false, error: 'file too small for asar header' };
  let jsonSize;
  try {
    jsonSize = buf.readUInt32LE(12);
  } catch (e) {
    return { ok: false, error: 'asar header read failed' };
  }
  if (jsonSize <= 0 || jsonSize > buf.length - 16 || jsonSize > 8 * 1024 * 1024) {
    return { ok: false, error: 'asar json size out of bounds (' + jsonSize + ')' };
  }
  let header;
  try {
    header = JSON.parse(buf.slice(16, 16 + jsonSize).toString('utf8'));
  } catch (e) {
    return { ok: false, error: 'asar header JSON parse failed' };
  }
  const files = [];
  (function walk(node, prefix) {
    if (files.length >= MAX_ASAR_ENTRIES) return;
    for (const name of Object.keys(node.files || {})) {
      const child = node.files[name];
      const p = prefix ? prefix + '/' + name : name;
      if (child.files) walk(child, p);
      else if (child.integrity) files.push({ path: p, sizeBytes: child.size });
    }
  })(header, '');
  return { ok: true, entries: files, truncated: files.length >= MAX_ASAR_ENTRIES };
}

function peekSqlite(buf) {
  const magic = Buffer.from('SQLite format 3\0', 'binary');
  if (buf.length < 100 || !buf.slice(0, 16).equals(magic)) return { isSqlite: false };
  const pageSize = buf.readUInt16BE(16);
  const writeVer = buf[18];
  const readVer = buf[19];
  let encoding = 'unknown';
  const enc = buf.readUInt32BE(56);
  if (enc === 1) encoding = 'utf8';
  if (enc === 2) encoding = 'utf16le';
  if (enc === 3) encoding = 'utf16be';
  return { isSqlite: true, pageSizeBytes: pageSize, writeVersion: writeVer, readVersion: readVer, textEncoding: encoding };
}

function listZip(buf) {
  if (buf.length < 22) return { ok: false, error: 'file too small for zip' };
  let eocd = -1;
  const scanFrom = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= scanFrom; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, error: 'zip EOCD not found' };
  const cdEntries = buf.readUInt16LE(eocd + 10);
  let cdOff = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < cdEntries && names.length < MAX_ZIP_ENTRIES; i++) {
    if (cdOff + 46 > buf.length) break;
    if (!(buf[cdOff] === 0x50 && buf[cdOff + 1] === 0x4b && buf[cdOff + 2] === 0x01 && buf[cdOff + 3] === 0x02)) break;
    const nameLen = buf.readUInt16LE(cdOff + 28);
    const extraLen = buf.readUInt16LE(cdOff + 30);
    const commentLen = buf.readUInt16LE(cdOff + 32);
    names.push(buf.slice(cdOff + 46, cdOff + 46 + nameLen).toString('ascii'));
    cdOff += 46 + nameLen + extraLen + commentLen;
  }
  return { ok: true, entries: names, truncated: names.length >= MAX_ZIP_ENTRIES };
}

// Read-only dispatcher: never executes the artifact, records bytes as evidence.
function inspectArtifact(filePath, opts) {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return { ok: false, error: 'not a regular file' };
    if (st.size === 0) return { ok: false, error: 'empty file' };
    if (st.size > MAX_HASH_BYTES) return { ok: false, error: 'file exceeds analysis cap' };
    const buf = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const ext = path.extname(filePath).toLowerCase();
    let kind = 'generic', detail = { note: 'strings-only view' }, strings = null;
    if (ext === '.exe' || ext === '.dll' || ext === '.sys') {
      const pe = peekPe(buf);
      kind = pe.isPe ? 'pe_binary' : 'binary_nonpe';
      detail = pe;
      strings = extractStrings(buf);
    } else if (ext === '.asar') {
      const asar = listAsar(buf);
      kind = 'asar_archive';
      detail = asar.ok ? { entryCount: asar.entries.length, truncated: asar.truncated } : asar;
      strings = asar.ok ? [] : extractStrings(buf);
    } else if (ext === '.apk' || ext === '.zip') {
      const zip = listZip(buf);
      kind = ext === '.apk' ? 'apk_archive' : 'zip_archive';
      detail = zip.ok ? { entryCount: zip.entries.length, firstEntries: zip.entries.slice(0, 20), truncated: zip.truncated } : zip;
      strings = zip.ok ? [] : extractStrings(buf);
    } else if (ext === '.sqlite' || ext === '.db') {
      const sql = peekSqlite(buf);
      kind = sql.isSqlite ? 'sqlite' : 'generic';
      detail = sql.isSqlite ? sql : { note: 'magic does not match sqlite' };
      strings = extractStrings(buf);
    } else {
      strings = extractStrings(buf);
    }
    const evidence = [
      { kind: 'path', value: filePath, provenance: 'investigation target (never executed)' },
      { kind: 'hash', value: 'sha256:' + hash, provenance: 'sha256 of full file' },
    ];
    if (strings && strings.length) {
      evidence.push({ kind: 'text', value: strings.slice(0, 60).map((s) => s.text).join('\n'), provenance: 'first ' + Math.min(60, strings.length) + ' printable strings' });
    }
    return {
      ok: true, kind, sizeBytes: st.size, sha256: hash, detail,
      evidence,
      stringsSample: strings ? strings.slice(0, 20).map((s) => s.text) : [],
      stringCount: strings ? strings.length : 0,
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

const TEXT_EXTS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.c', '.h', '.cpp', '.cs', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.php', '.md', '.json', '.html', '.css', '.vue', '.sh', '.ps1', '.yml', '.yaml', '.toml', '.ini'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'release', 'dist_electron', '.cache', '__pycache__']);

function isLikelyText(buf) {
  const probe = buf.slice(0, 8000);
  return !probe.includes(0);
}

function investigateFeature(rootDir, token, opts) {
  const q = String(token || '').trim();
  if (!q) return { ok: false, error: 'search token is required' };
  try {
    if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
      return { ok: false, error: 'rootDir is not a directory' };
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  const needle = q.toLowerCase();
  const hits = [];
  const filesSeen = { count: 0 };
  (function walk(dir, depth) {
    if (hits.length >= MAX_HIT_LINES || filesSeen.count >= MAX_SEARCH_FILES) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of entries) {
      if (hits.length >= MAX_HIT_LINES) return;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name)) continue;
        if (depth < 6) walk(full, depth + 1);
        continue;
      }
      if (!TEXT_EXTS.includes(path.extname(ent.name).toLowerCase())) continue;
      let st;
      try { st = fs.statSync(full); } catch (e) { continue; }
      if (st.size === 0 || st.size > 300 * 1024) continue;
      filesSeen.count++;
      if (filesSeen.count > MAX_SEARCH_FILES) break;
      let buf;
      try { buf = fs.readFileSync(full); } catch (e) { continue; }
      if (!isLikelyText(buf)) continue;
      const lines = buf.toString('utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          hits.push({ file: full, line: i + 1, text: lines[i].slice(0, 240) });
          if (hits.length >= MAX_HIT_LINES) break;
        }
      }
    }
  })(rootDir, 0);
  return {
    ok: true,
    token: q,
    filesScanned: filesSeen.count,
    hits,
    cappedNote: hits.length >= MAX_HIT_LINES ? 'hit cap reached; narrow the token' : null,
  };
}

function jaccardStrings(a, b) {
  const setA = new Set((a || []).map((s) => String(s).trim()).filter(Boolean));
  const setB = new Set((b || []).map((s) => String(s).trim()).filter(Boolean));
  if (!setA.size && !setB.size) return { overlap: 0, shared: 0, onlyA: 0, onlyB: 0 };
  let shared = 0;
  for (const v of setA) if (setB.has(v)) shared++;
  return {
    overlap: setA.size ? +(shared / setA.size).toFixed(4) : 0,
    shared,
    onlyA: setA.size - shared,
    onlyB: setB.size - shared,
  };
}

function verifyReconstruction(originalPath, rebuiltPath) {
  const a = sha256File(originalPath);
  if (!a.ok) return { ok: false, error: 'original: ' + a.error };
  const b = sha256File(rebuiltPath);
  if (!b.ok) return { ok: false, error: 'rebuilt: ' + b.error };
  const bufA = fs.readFileSync(originalPath);
  const bufB = fs.readFileSync(rebuiltPath);
  const stringsA = extractStrings(bufA).map((s) => s.text);
  const stringsB = extractStrings(bufB).map((s) => s.text);
  const cmp = jaccardStrings(stringsA, stringsB);
  const identical = a.sha256 === b.sha256;
  return {
    ok: true,
    identical,
    original: { sha256: a.sha256, sizeBytes: a.sizeBytes },
    rebuilt: { sha256: b.sha256, sizeBytes: b.sizeBytes },
    stringOverlap: cmp,
    verdict: identical ? 'byte-identical' : (cmp.overlap >= 0.8 ? 'high overlap (likely equivalent behavior, verify unknowns)' : 'different (records the delta as evidence)'),
    evidence: [
      { kind: 'hash', value: 'orig sha256:' + a.sha256 },
      { kind: 'hash', value: 'rebuilt sha256:' + b.sha256 },
      { kind: 'note', value: JSON.stringify(cmp), provenance: 'printable-string set overlap (bounded)' },
    ],
  };
}

function crashScan(filePath) {
  const inspect = inspectArtifact(filePath);
  if (!inspect.ok) return inspect;
  const patterns = /(exception|fault|error|violation|abort|panic|traceback|stack|code\s*0x[0-9a-f]{4,8})/i;
  const buf = fs.readFileSync(filePath);
  const captures = extractStrings(buf, 4).filter((s) => patterns.test(s.text)).slice(0, 40);
  return {
    ok: true,
    artifact: { kind: inspect.kind, sha256: inspect.sha256, sizeBytes: inspect.sizeBytes },
    crashSignatures: captures.map((s) => ({ offset: s.offset, text: s.text })),
    note: captures.length ? 'local strings-scan only: attach a debugger/minidump provider for call stacks' : 'no crash keywords found in strings; record unknowns',
    evidence: inspect.evidence.concat(captures.length ? [{
      kind: 'text',
      value: captures.slice(0, 20).map((s) => 'off ' + s.offset + ': ' + s.text).join('\n'),
      provenance: 'crash keyword strings scan',
    }] : []),
  };
}

module.exports = {
  SKILL_CATALOG,
  sha256File, extractStrings, peekPe, listAsar, peekSqlite, listZip,
  inspectArtifact, investigateFeature, jaccardStrings, verifyReconstruction, crashScan,
  CAPS: { MAX_HASH_BYTES, MAX_ZIP_ENTRIES, MAX_ASAR_ENTRIES, MAX_STRINGS, MAX_HIT_LINES, MAX_SEARCH_FILES },
};
