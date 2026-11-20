'use strict';
/**
 * MYRAA Legal-Awareness Research Adapter
 * Fetches ONLY from an explicit official-source allowlist and records exact
 * URLs plus date checked. It never states that a product is compliant.
 */

const https = require('https');
const http = require('http');

const ALLOWED = Object.freeze({
  'meity.gov.in': 'Ministry of Electronics and Information Technology',
  'egazette.gov.in': 'Official Gazette of India',
  'cert-in.org.in': 'Indian Computer Emergency Response Team',
  'gst.gov.in': 'Goods and Services Tax Portal',
  'consumerhelpline.gov.in': 'National Consumer Helpline',
});

const INDIA_TOPICS = [
  { key: 'dpdp', label: 'Digital Personal Data Protection Act / Rules (check current commencement, including 2025 Rules)', domains: ['meity.gov.in', 'egazette.gov.in'] },
  { key: 'certIn', label: 'CERT-In directions and current security guidance', domains: ['cert-in.org.in'] },
  { key: 'gst', label: 'GST and place-of-supply rules for the actual transaction', domains: ['gst.gov.in'] },
  { key: 'consumer', label: 'Consumer protection and e-commerce requirements where applicable', domains: ['consumerhelpline.gov.in'] },
];

function allowedDomain(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  return Object.prototype.hasOwnProperty.call(ALLOWED, h) ? h : null;
}

function fetchSource(rawUrl, timeoutMs = 9000) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(String(rawUrl || '')); } catch (e) {
      return resolve({ ok: false, status: 'NOT_VERIFIED', reason: 'Invalid URL' });
    }
    const domain = allowedDomain(url.hostname);
    if (!domain || !['https:', 'http:'].includes(url.protocol)) {
      return resolve({ ok: false, status: 'NOT_VERIFIED', reason: 'URL is not in the official-source allowlist', domain });
    }
    const mod = url.protocol === 'https:' ? https : http;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve({ ...v, domain, publisher: ALLOWED[domain], sourceTier: 1, requestedUrl: url.toString() }); } };
    const req = mod.get(url.toString(), { timeout: timeoutMs, headers: { 'User-Agent': 'MYRAA-Legal-Awareness/1.0', Accept: 'text/html,*/*' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return finish({ ok: false, status: 'NOT_VERIFIED', reason: 'Redirect; fetch the canonical official URL directly' });
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        return finish({ ok: false, status: 'NOT_VERIFIED', reason: `HTTP ${res.statusCode}`, httpStatus: res.statusCode });
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (body.length < 500000) body += c; else res.destroy(); });
      res.on('end', () => {
        const titleM = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        finish({
          ok: true,
          status: 'SOURCE_FETCHED',
          finalUrl: url.toString(),
          title: titleM ? titleM[1].replace(/<[^>]+>/g, '').trim().slice(0, 250) : null,
          snippet: text.slice(0, 1200),
          fetchedAt: new Date().toISOString(),
          dateChecked: new Date().toISOString().slice(0, 10),
          note: 'Source text fetched. Interpretation and applicability were NOT determined by this adapter.',
        });
      });
    });
    req.on('timeout', () => { req.destroy(); finish({ ok: false, status: 'NOT_VERIFIED', reason: 'Timeout' }); });
    req.on('error', (e) => finish({ ok: false, status: 'NOT_VERIFIED', reason: e.message }));
  });
}

async function review(input = {}) {
  const b = input && typeof input === 'object' ? input : {};
  const jurisdiction = b.jurisdiction || 'UNKNOWN';
  const isIndia = /india/i.test(String(jurisdiction));
  const urls = Array.isArray(b.sourceUrls) ? b.sourceUrls.slice(0, 10) : [];
  const fetched = [];
  for (const u of urls) fetched.push(await fetchSource(u));

  const checklist = isIndia ? INDIA_TOPICS.map((t) => ({
    topic: t.key,
    label: t.label,
    applicable: 'Unclear',
    sourceStatus: fetched.some((f) => f.ok && t.domains.some((d) => f.domain === d)) ? 'SOURCE_FETCHED' : 'NOT_CHECKED',
    currentSource: fetched.filter((f) => f.ok && t.domains.some((d) => f.domain === d)).map((f) => f.finalUrl),
    dateChecked: fetched.filter((f) => f.ok && t.domains.some((d) => f.domain === d)).map((f) => f.dateChecked),
    actionRequired: 'Verify current text and applicability with qualified counsel.',
    professionalReview: 'Required',
  })) : [];

  return {
    ok: true,
    framework: 'legalAwarenessResearch',
    status: 'UNKNOWN',
    jurisdiction,
    businessModel: b.businessModel || 'UNKNOWN',
    productCategory: b.productCategory || 'UNKNOWN',
    dataInvolved: b.dataInvolved || 'UNKNOWN',
    users: b.users || 'UNKNOWN',
    transactionType: b.transactionType || 'UNKNOWN',
    issues: [],
    sources: fetched,
    officialSourceAllowlist: Object.keys(ALLOWED),
    checklist,
    needsProfessionalReview: 'Required',
    disclaimer: 'Not legal advice. No compliance claim is made. Applicability and current commencement must be verified from the fetched official sources by a qualified professional.',
    lastChecked: new Date().toISOString(),
  };
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json({ ok: true, service: 'legal-research', allowlist: Object.keys(ALLOWED), neverClaimsCompliance: true }));
  router.post('/fetch', async (req, res) => {
    const r = await fetchSource((req.body || {}).url);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.post('/review', async (req, res) => res.json(await review(req.body || {})));
  return router;
}

module.exports = { STATUS: { ok: true, service: 'legal-research' }, ALLOWED, fetchSource, review, createRouter };
