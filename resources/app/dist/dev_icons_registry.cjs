'use strict';
/**
 * Real Devicons from the installed @dev.icons/react package (MIT, 1,969 icons).
 * SVGs are rendered from the actual React components via react-dom/server.
 * Unknown names return NOT_FOUND - no hand-drawn or fabricated icons.
 */

let icons = null;
let React = null;
let render = null;

function load() {
  if (icons) return { icons, React, render };
  try {
    icons = require('@dev.icons/react');
    React = require('react');
    render = require('react-dom/server').renderToStaticMarkup;
  } catch (e) { icons = {}; React = null; render = null; }
  return { icons, React, render };
}

function catalog(query, limit) {
  const { icons: all } = load();
  const q = String(query || '').toLowerCase();
  const n = Math.min(300, Math.max(1, Number(limit) || 100));
  const names = Object.keys(all).filter((x) => !q || x.toLowerCase().includes(q)).sort().slice(0, n);
  return { ok: true, count: names.length, icons: names, source: '@dev.icons/react@1.3.0 (MIT)' };
}

function svg(name, opts = {}) {
  const { icons: all, React: R, render: toMarkup } = load();
  const key = String(name || '');
  if (!Object.prototype.hasOwnProperty.call(all, key)) {
    return { ok: false, code: 'NOT_FOUND', error: 'no real Devicon named ' + key };
  }
  if (!R || !toMarkup) return { ok: false, code: 'RENDERER_UNAVAILABLE' };
  try {
    const props = { size: Number(opts.size) || 48 };
    if (opts.color) props.color = opts.color;
    if (opts.alt || opts.title) props.alt = String(opts.alt || opts.title).slice(0, 120);
    const markup = toMarkup(R.createElement(all[key], props));
    return { ok: true, name: key, source: '@dev.icons/react@1.3.0 (MIT)', svg: markup, size: props.size };
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', error: e.message };
  }
}

function status() {
  const { icons: all } = load();
  const names = Object.keys(all);
  return {
    ok: names.length > 0,
    icons: names.length,
    source: '@dev.icons/react@1.3.0 (MIT)',
    examples: ['_React', '_Vue', 'Nextjs'].filter((n) => names.includes(n)),
    method: 'server-rendered from the real React components',
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json(status()));
  router.get('/catalog', (req, res) => res.json(catalog(req.query.q, req.query.limit)));
  router.get('/icon/:name', (req, res) => {
    const r = svg(req.params.name, req.query);
    if (!r.ok) return res.status(404).json(r);
    res.type('image/svg+xml').send(r.svg);
  });
  return router;
}

module.exports = { catalog, svg, status, createRouter };
