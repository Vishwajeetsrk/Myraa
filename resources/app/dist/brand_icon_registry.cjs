'use strict';
/**
 * Real brand icons from the installed @thesvg/react package (MIT, 7,600+ icons).
 * No hand-drawn/fake logos: if an icon is not in the package, report NOT_FOUND.
 * Serves raw SVG from the package's own variant data (currentColor 'mono' by default).
 */
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..', 'node_modules', '@thesvg', 'react', 'dist');
let names = null;
function catalog() {
  if (names) return names;
  try {
    names = fs.readdirSync(PKG).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
  } catch (e) { names = []; }
  return names;
}
function find(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!n) return null;
  const all = catalog();
  return all.includes(n) ? n : (all.find((x) => x.replace(/-/g, '') === n.replace(/[-_]/g, '')) || null);
}
function kebab(k) { return k.replace(/([A-Z])/g, '-$1').toLowerCase(); }
function serializeNode(node) {
  if (typeof node === 'string') return node;
  if (!node || !node.type) return '';
  const props = Object.entries(node.props || {}).map(([k, v]) => {
    if (v == null || typeof v === 'object') return '';
    return ' ' + kebab(k) + '="' + String(v).replace(/"/g, '&quot;') + '"';
  }).join('');
  const children = (node.children || []).map(serializeNode).join('');
  return '<' + node.type + props + '>' + children + '</' + node.type + '>';
}
function svg(name, variant) {
  const found = find(name);
  if (!found) return { ok: false, code: 'NOT_FOUND', error: 'no real brand icon named ' + name };
  try {
    const source = fs.readFileSync(path.join(PKG, found + '.js'), 'utf8');
    const m = source.match(/const _variants = (\{[\s\S]*?\});\r?\n/);
    if (!m) return { ok: false, code: 'PARSE_ERROR', error: 'variant data not found' };
    const variants = JSON.parse(m[1]);
    const key = (variant && variants[variant]) ? variant : (variants.mono ? 'mono' : 'default');
    const v = variants[key];
    const body = (v.childNodes || []).map(serializeNode).join('');
    const fill = v.fill || 'currentColor';
    return {
      ok: true,
      name: found,
      variant: key,
      source: '@thesvg/react@4.0.12 (MIT)',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + v.viewBox + '" fill="' + fill + '">' + body + '</svg>',
    };
  } catch (e) {
    return { ok: false, code: 'READ_ERROR', error: e.message };
  }
}
function search(query, limit) {
  const q = String(query || '').toLowerCase();
  const n = Math.min(200, Math.max(1, Number(limit) || 50));
  const items = catalog().filter((x) => !q || x.includes(q)).slice(0, n);
  return { ok: true, count: items.length, source: '@thesvg/react', icons: items };
}
function status() {
  return { ok: catalog().length > 0, icons: catalog().length, source: '@thesvg/react (MIT)', note: 'real brand assets only; unknown names return NOT_FOUND' };
}
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.get('/catalog', (req, res) => res.json(search(req.query.q, req.query.limit)));
  router.get('/icon/:name', (req, res) => {
    const r = svg(req.params.name, req.query.variant);
    if (!r.ok) return res.status(404).json(r);
    res.type('image/svg+xml').send(r.svg);
  });
  return router;
}
module.exports = { catalog, find, svg, search, status, createRouter };
