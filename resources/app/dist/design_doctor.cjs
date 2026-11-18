'use strict';
/**
 * Design Doctor (spec phase 9/18): structured visual critique from REAL UI
 * source files. No invented findings; every item carries file:line evidence.
 * This is a static audit - it does not pretend to have seen a screenshot.
 */
const fs = require('fs');
const path = require('path');

const DIST = __dirname;
const FILES = [
  'index.html',
  'myraa_design_system.css',
  'ui_polish_phase14.css',
  'myraa_v6_styles.css',
  'ui-health-patch.js',
  'myraa_v6_app.js',
];
const SEVERITY = Object.freeze(['critical', 'high', 'medium', 'low']);

function read(file) {
  try { return fs.readFileSync(path.join(DIST, file), 'utf8'); } catch (e) { return null; }
}
function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}
function evidence(file, text, index, regexResult) {
  const line = lineOf(text, index);
  const lineText = text.split(/\r?\n/)[line - 1] || '';
  return { file, line, snippet: (regexResult || lineText).trim().slice(0, 180) };
}
function finding(id, category, severity, why, recommendation, ev) {
  return {
    id,
    category,
    severity: SEVERITY.includes(severity) ? severity : 'low',
    why,
    recommendation,
    evidence: ev || null,
    actionAvailable: false,
    source: 'static-ui-audit',
  };
}

function scanTinyText() {
  const out = [];
  for (const file of FILES) {
    const text = read(file);
    if (!text) continue;
    const re = /font-size:\s*(\d+(?:\.\d+)?)px/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const size = parseFloat(m[1]);
      if (size < 11) {
        out.push(finding('text-' + file + '-' + m.index, 'typography', size < 9 ? 'high' : 'medium',
          'Text at ' + size + 'px is below the 11px readability floor for normal UI text',
          'Raise to at least 11px (14px preferred for body copy); keep only technical metadata smaller',
          evidence(file, text, m.index, m[0])));
      }
      if (out.length > 60) return out;
    }
  }
  return out;
}
function scanFocus() {
  const out = [];
  for (const file of FILES.filter((f) => f.endsWith('.css'))) {
    const text = read(file);
    if (!text) continue;
    if (!/:focus-visible/.test(text)) {
      out.push(finding('focus-' + file, 'accessibility', 'medium',
        'No :focus-visible rule in this stylesheet',
        'Add a visible keyboard focus ring (2px accent, 2px offset)',
        { file, line: 1, snippet: 'stylesheet contains no :focus-visible selector' }));
    }
  }
  return out;
}
function scanEmoji() {
  const out = [];
  const re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of FILES) {
    const text = read(file);
    if (!text) continue;
    const m = re.exec(text);
    if (m) out.push(finding('emoji-' + file, 'identity', 'high', 'Emoji character present in shipped UI asset',
      'Replace with an inline SVG or ASCII symbol (MYRAA rule: no emojis)',
      evidence(file, text, m.index, m[0])));
  }
  return out;
}
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(rgb) {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastHex(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return null;
  const l1 = luminance(x), l2 = luminance(y);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}
function contrastAudit() {
  const css = read('myraa_design_system.css') || '';
  const get = (name) => {
    const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(css);
    return m ? m[1] : null;
  };
  const pairs = [
    ['myraa-text', 'myraa-bg', 4.5],
    ['myraa-muted', 'myraa-bg', 4.5],
    ['myraa-accent', 'myraa-bg', 3],
  ];
  const results = pairs.map(([a, b, min]) => {
    const fg = get(a), bg = get(b);
    const ratio = contrastHex(fg, bg);
    return {
      id: 'contrast-' + a + '-' + b,
      category: 'contrast',
      severity: ratio == null ? 'low' : (ratio >= min ? 'low' : 'high'),
      why: ratio == null ? 'token colours unavailable - no real ratio computed' : 'Measured contrast ' + ratio + ':1 against required ' + min + ':1',
      recommendation: ratio != null && ratio < min ? 'Adjust the token value until the real ratio meets ' + min + ':1' : 'No change needed',
      evidence: { file: 'myraa_design_system.css', line: 1, snippet: (fg || '?') + ' on ' + (bg || '?') },
      actionAvailable: false,
      source: 'wcag-contrast-computation',
      ratio,
      required: min,
      measured: ratio != null,
    };
  });
  return results;
}
function scanHardcodedTokens() {
  const css = read('myraa_v6_styles.css') || '';
  const m = css.match(/#[0-9a-fA-F]{6}\b/g) || [];
  return [finding('tokens-v6-hardcoded', 'design-system', 'low',
    m.length + ' raw hex colours in the legacy stylesheet instead of design tokens',
    'Migrate to --myraa-* tokens in the overlay layer; do not rewrite the compiled React bundle',
    { file: 'myraa_v6_styles.css', line: 1, snippet: m.slice(0, 5).join(', ') })];
}

function analyze() {
  const findings = [].concat(
    scanTinyText(),
    scanFocus(),
    scanEmoji(),
    scanHardcodedTokens(),
    contrastAudit(),
  );
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: 'static-ui-audit',
    findings,
    counts,
    note: 'Findings come from real UI files; this module has NOT seen a screenshot and never claims a visual pass',
  };
}
function report(data) {
  const d = data || analyze();
  const lines = ['# MYRAA Design Doctor', '', 'Mode: ' + d.mode, 'Generated: ' + d.generatedAt, '', d.note || '',
    'Counts: ' + Object.entries(d.counts).map(([k, v]) => k + '=' + v).join(', '), ''];
  for (const f of d.findings) {
    lines.push('## [' + f.severity.toUpperCase() + '] ' + f.category + ' - ' + f.id);
    lines.push('- Why: ' + f.why);
    lines.push('- Recommend: ' + f.recommendation);
    lines.push('- Evidence: ' + (f.evidence ? f.evidence.file + ':' + f.evidence.line + ' ' + f.evidence.snippet : 'none'));
    lines.push('');
  }
  return lines.join('\n');
}
function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/report-json', (req, res) => res.json(analyze()));
  router.get('/report', (req, res) => res.type('text/markdown').send(report()));
  return router;
}
module.exports = { SEVERITY, contrastHex, analyze, report, createRouter };
