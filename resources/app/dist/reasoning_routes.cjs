'use strict';
const express = require('express');
const rf = require('./reasoning_frameworks.cjs');

const router = express.Router();

router.get('/status', (req, res) => res.json(rf.STATUS));

router.get('/frameworks', (req, res) => {
  res.json({
    ok: true,
    frameworks: Object.entries(rf.FRAMEWORKS).map(([name, f]) => ({
      name, title: f.title, sectionCount: f.sections.length,
    })),
    additional: rf.STATUS.additional,
    usage: 'POST /api/frameworks/{name} with any fields you have evidence for. Unsupplied fields stay UNKNOWN.',
  });
});

router.post('/:name', (req, res) => {
  const name = req.params.name;
  const result = rf.invoke(name, req.body || {});
  res.status(result.ok ? 200 : 404).json(result);
});

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'reasoning-frameworks',
    endpoints: ['GET /status', 'GET /frameworks', 'POST /:name'],
    policy: rf.STATUS.policy,
  });
});

module.exports = router;
