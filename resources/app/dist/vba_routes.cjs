'use strict';
const express = require('express');
const vba = require('./vba_analyzer.cjs');

const router = express.Router();
const MAX_CODE_CHARS = 200000;

function body(req, res) {
  const b = req.body || {};
  const code = b.code != null ? b.code : b.source;
  if (typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ ok: false, code: 'VALIDATION', error: 'code is required (VBA source text).' });
    return null;
  }
  if (code.length > MAX_CODE_CHARS) {
    res.status(400).json({ ok: false, code: 'TOO_LARGE', error: `code exceeds ${MAX_CODE_CHARS} characters.` });
    return null;
  }
  return { code, fileName: b.fileName ? String(b.fileName).slice(0, 200) : null };
}

router.get('/status', (req, res) => res.json(vba.STATUS));

router.post('/explain', (req, res) => {
  const b = body(req, res);
  if (b) res.json({ ...vba.explain(b.code), fileName: b.fileName });
});

router.post('/review', (req, res) => {
  const b = body(req, res);
  if (b) {
    const r = vba.review(b.code);
    res.json({ ...r, fileName: b.fileName });
  }
});

router.post('/improve', (req, res) => {
  const b = body(req, res);
  if (b) {
    const r = vba.improve(b.code);
    res.status(r.generated ? 200 : 422).json({ ...r, fileName: b.fileName });
  }
});

router.post('/analyze', (req, res) => {
  const b = body(req, res);
  if (b) {
    res.json({ ...vba.analyze(b.code), fileName: b.fileName });
  }
});

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'vba-intelligence',
    endpoints: ['GET /status', 'POST /explain', 'POST /review', 'POST /improve', 'POST /analyze'],
    input: { code: 'VBA source text', fileName: 'optional' },
    policy: vba.STATUS.rewritePolicy,
    neverDoes: vba.STATUS.neverDoes,
  });
});

module.exports = router;
