'use strict';
/**
 * MYRAA Cross-Application Orchestrator
 * Composes EXISTING engines: client_discovery + office_doc_engine.
 * No new document engine, no new runner. Each stage reports its real result.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const cd = require('./client_discovery.cjs');

let office = null;
try { office = require('./office_doc_engine.cjs'); } catch (e) { office = null; }

const STAGES = ['research', 'excel', 'word', 'powerpoint', 'outlook'];

function slug(s) { return String(s || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); }

function dryRun(input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const dir = b.outputDir || path.join(os.tmpdir(), 'myraa-cross-app');
  const name = slug(b.clientName || (b.input && (b.input.companyName || b.input.name)) || 'client');
  const plan = {
    ok: true,
    mode: 'DRY_RUN',
    noChangesMade: true,
    outputDir: dir,
    stages: [
      { stage: 'research', would: 'reconcile supplied evidence into a client record', changes: 'none' },
      { stage: 'excel', would: 'create spreadsheet', file: path.join(dir, `${name}-clients.xlsx`), changes: 'new file' },
      { stage: 'word', would: 'create client report', file: path.join(dir, `${name}-report.docx`), changes: 'new file' },
      { stage: 'powerpoint', would: 'create summary deck', file: path.join(dir, `${name}-summary.pptx`), changes: 'new file' },
      { stage: 'outlook', would: 'create draft', status: 'NOT_IMPLEMENTED', changes: 'none' },
    ],
    note: 'Simulation only. No file was written and no application was opened.',
  };
  return plan;
}

async function run(input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const dir = b.outputDir || path.join(os.tmpdir(), 'myraa-cross-app');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* reported by stages */ }
  const name = slug(b.clientName || (b.input && (b.input.companyName || b.input.name)) || 'client');
  const evidence = Array.isArray(b.evidence) ? b.evidence : [];
  const results = [];
  const stage = (name2, status, detail) => {
    results.push({ stage: name2, status, detail: detail === undefined ? null : detail, at: new Date().toISOString() });
  };

  const analysis = cd.analyze(b.input || {}, evidence);
  stage('research', 'SUCCESS', { clientId: analysis.record.clientId, website: analysis.record.website, missing: analysis.missing });
  let record = analysis.record;
  if (b.batchId && b.collected && b.collected.analysis) {
    record = b.collected.analysis.record;
    stage('research', 'SUCCESS', { source: 'background batch', clientId: record.clientId });
  }

  if (!office) {
    for (const s of ['excel', 'word', 'powerpoint']) stage(s, 'UNAVAILABLE', 'office_doc_engine.cjs not loaded');
  } else {
    try {
      const headers = cd.FIELDS.map(([, label]) => label);
      const row = cd.toExcelRow(record);
      const r = await office.generateExcel({ filename: path.join(dir, `${name}-clients.xlsx`), sheetName: 'Clients', headers, rows: [row] });
      stage('excel', r && r.ok !== false ? 'SUCCESS' : 'FAILED', r);
    } catch (e) { stage('excel', 'FAILED', e.message); }

    try {
      const r = await office.generateWord({
        filename: path.join(dir, `${name}-report.docx`),
        title: `Client Research Report: ${record.companyName}`,
        subtitle: `Client ID ${record.clientId} - ${record.verificationStatus}`,
        sections: [
          { heading: 'Summary', body: `Website: ${record.website}. Phone: ${record.phone}. Email: ${record.email}.` },
          { heading: 'Address', body: `${record.addressLine1} ${record.addressLine2} ${record.city} ${record.state} ${record.pinCode} ${record.country}`.trim() },
          { heading: 'Sources', body: (analysis.sourceUrls || []).join('\n') || 'None supplied.' },
          { heading: 'Missing information', body: (analysis.missing || []).join(', ') || 'None.' },
        ],
        docType: 'report',
      });
      stage('word', r && r.ok !== false ? 'SUCCESS' : 'FAILED', r);
    } catch (e) { stage('word', 'FAILED', e.message); }

    try {
      const r = await office.generatePresentation({
        filename: path.join(dir, `${name}-summary.pptx`),
        title: `${record.companyName} - Client Summary`,
        subtitle: `${record.clientId} | ${record.verificationStatus}`,
        slides: [
          { title: 'Identity', bullets: [`Client: ${record.companyName}`, `Contact: ${record.contactPerson}`, `Website: ${record.website}`] },
          { title: 'Verification', bullets: [`Status: ${record.verificationStatus}`, `Sources: ${analysis.sourceUrls.length}`, `Missing: ${analysis.missing.length}`] },
        ],
      });
      stage('powerpoint', r && r.ok !== false ? 'SUCCESS' : 'FAILED', r);
    } catch (e) { stage('powerpoint', 'FAILED', e.message); }
  }

  stage('outlook', 'NOT_IMPLEMENTED', 'No verified Outlook COM/OAuth draft path is connected; no email was created.');

  const succeeded = results.filter((r) => r.status === 'SUCCESS').length;
  const failed = results.filter((r) => r.status === 'FAILED' || r.status === 'UNAVAILABLE').length;
  return {
    ok: succeeded > 0,
    overall: failed ? 'PARTIAL' : (succeeded === STAGES.length ? 'COMPLETED' : 'PARTIAL'),
    clientId: record.clientId,
    outputDir: dir,
    stages: results,
    files: results.map((r) => (r.detail && r.detail.path) || null).filter(Boolean),
    honesty: 'No stage is reported as done unless its engine returned a real result.',
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json({ ok: true, service: 'cross-app-orchestrator', stages: STAGES, officeEngine: !!office, outlook: 'NOT_IMPLEMENTED' }));
  router.post('/dry-run', (req, res) => res.json(dryRun(req.body || {})));
  router.post('/run', async (req, res) => {
    const r = await run(req.body || {});
    res.status(r.ok ? 200 : 500).json(r);
  });
  return router;
}

module.exports = { STATUS: { ok: true, service: 'cross-app-orchestrator' }, STAGES, dryRun, run, createRouter };
