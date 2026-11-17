'use strict';
/**
 * Response tags (Phase 29) - parse typed action tags from a MODEL reply only.
 * Never parse screen content: callers must pass { source: 'model' } (the default).
 * Malformed tags are dropped from speech, never executed. Run: node tests\test_response_tags.cjs
 */

function slice(v, n) { return String(v == null ? '' : v).slice(0, n); }

const POINT_RE = /\[\s*POINT\s*:\s*(none|-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)(?:\s*:\s*([^\]]*?))?\s*\]/gi;
const CONTROL_RE = /\[\s*(STEPS\s*:\s*(\d{1,2})|DONE)\s*\]/gi;
const PLAN_RE = /\[\s*PLAN\s*:\s*([^\[\]]*)\]/gi;
const GOAL_RE = /\[\s*GOAL\s*:\s*([^\[\]]*)\]/gi;
const DO_HEAD_RE = /\[\s*DO\s*:\s*([a-z][a-z_]{1,40})\s*/gi;
const MALFORMED_RE = /\[\s*(?:POINT|STEPS|PLAN|GOAL|DO|DONE)\b[^\]]*\]/gi;

function cleanSpoken(text) {
  return String(text || '')
    .replace(/[*`#]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ +([,.!?;:])/g, '$1')
    .trim();
}

function scanDo(text, startAt, tags, warnings) {
  DO_HEAD_RE.lastIndex = startAt;
  const m = DO_HEAD_RE.exec(text);
  if (!m) return null;
  const name = m[1].toLowerCase();
  let i = m.index + m[0].length;
  let args = {};
  let valid = true;
  if (text[i] === '{') {
    let depth = 0, inString = false, escape = false, end = -1;
    for (let p = i; p < text.length; p++) {
      const c = text[p];
      if (inString) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { end = p + 1; break; }
      }
    }
    if (end === -1) { warnings.push('malformed DO JSON: ' + name); valid = false; return { start: m.index, end: m.index + m[0].length }; }
    try {
      const parsed = JSON.parse(text.slice(i, end));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed;
      else { warnings.push('DO args not an object: ' + name); valid = false; }
    } catch (e) { warnings.push('invalid DO JSON: ' + name); valid = false; }
    i = end;
  }
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== ']') {
    warnings.push('malformed DO tag: ' + name);
    return { start: m.index, end: i < text.length ? i + 1 : i };
  }
  if (valid) tags.push({ type: 'DO', name, args });
  return { start: m.index, end: i + 1 };
}

function parseReply(text, opts) {
  const o = opts || {};
  const source = slice(o.source || 'model', 40);
  const raw = slice(text, 20000);
  const warnings = [];
  if (source !== 'model') {
    return { ok: true, spoken: cleanSpoken(raw), tags: [], warnings: ['source-not-model: tags ignored'], ignored: true };
  }

  const tags = [];
  const spans = [];
  const add = (re, fn) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const built = fn(m);
      if (built) { tags.push(built.tag); spans.push({ start: m.index, end: m.index + m[0].length }); }
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  add(POINT_RE, (m) => {
    if (/^none$/i.test(m[1])) return { tag: { type: 'POINT', none: true } };
    const [xs, ys] = m[1].split(',').map((v) => parseFloat(v));
    if (!Number.isFinite(xs) || !Number.isFinite(ys)) { warnings.push('malformed POINT'); return null; }
    const labelAndScreen = slice(m[2] || '', 120);
    const sm = labelAndScreen.match(/^(.*?)(?::\s*screen\s*(\d+))?\s*$/i);
    return { tag: { type: 'POINT', x: xs, y: ys, label: (sm && sm[1] || '').trim(), screen: sm && sm[2] ? Number(sm[2]) : null } };
  });
  add(CONTROL_RE, (m) => (/^DONE$/i.test(m[1])
    ? { tag: { type: 'DONE' } }
    : { tag: { type: 'STEPS', total: Number(m[2]) } }));
  add(PLAN_RE, (m) => {
    const steps = m[1].split('|').map((s) => s.replace(/^[\s.]+|[\s.]+$/g, '')).filter(Boolean).slice(0, 10);
    return steps.length ? { tag: { type: 'PLAN', steps } } : null;
  });
  add(GOAL_RE, (m) => {
    const goal = m[1].replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 200);
    return goal ? { tag: { type: 'GOAL', text: goal } } : null;
  });

  // DO tags need a JSON-aware scan and may overlap other matches; process them last.
  let cursor = 0;
  while (cursor < raw.length) {
    const scanned = scanDo(raw, cursor, tags, warnings);
    if (!scanned) break;
    spans.push({ start: scanned.start, end: scanned.end });
    cursor = Math.max(scanned.end, cursor + 1);
  }

  // Drop malformed tags from speech but never execute them.
  MALFORMED_RE.lastIndex = 0;
  let mm;
  while ((mm = MALFORMED_RE.exec(raw)) !== null) {
    const known = spans.some((s) => s.start === mm.index && s.end === mm.index + mm[0].length);
    if (!known) { spans.push({ start: mm.index, end: mm.index + mm[0].length }); warnings.push('malformed tag dropped'); }
  }

  spans.sort((a, b) => a.start - b.start);
  let spoken = '', last = 0;
  for (const s of spans) {
    if (s.start < last) continue;
    spoken += raw.slice(last, s.start) + ' ';
    last = Math.max(last, s.end);
  }
  spoken += raw.slice(last);

  return { ok: true, spoken: cleanSpoken(spoken), tags, warnings };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.post('/parse', (req, res) => {
    const b = req.body || {};
    res.json(parseReply(b.text, { source: b.source }));
  });
  return router;
}

module.exports = { parseReply, cleanSpoken, createRouter };
