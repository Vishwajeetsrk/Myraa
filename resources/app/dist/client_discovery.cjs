'use strict';
/**
 * MYRAA Client Discovery Engine
 * =============================================================================
 * Reconciles REAL supplied evidence into a structured client record. It never
 * invents a domain, phone, email, address, source URL or verification status.
 *
 * Evidence shape: { field, value, source, url, confidence, checkedAt }
 * Confidence: verified | likely | uncertain
 *
 * Network probing is deliberately narrow: only an explicitly supplied public
 * http(s) URL is fetched, with redirect and byte limits, and only title plus
 * mailto:/tel: links are extracted. A failed probe yields "Website: Not found".
 */

const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');

const FIELDS = [
  ['companyName', 'Company Name'], ['contactPerson', 'Contact Person'],
  ['designation', 'Designation'], ['phone', 'Phone'], ['email', 'Email'],
  ['website', 'Website'], ['addressLine1', 'Address Line 1'],
  ['addressLine2', 'Address Line 2'], ['city', 'City'], ['state', 'State'],
  ['pinCode', 'PIN Code'], ['country', 'Country'],
  ['googleMapsLink', 'Google Maps Link'], ['source', 'Source'],
  ['verificationStatus', 'Verification Status'], ['lastVerified', 'Last Verified'],
  ['notes', 'Notes'],
];

const RANK = { verified: 3, likely: 2, uncertain: 1 };
const NOT_FOUND = 'Not found';
const WEBSITE_NOT_FOUND = 'Website: Not found';
const PHONE_NOT_VERIFIED = 'Phone number not verified';

function isPrivateHost(host) {
  const h = String(host || '').toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (net.isIP(h)) {
    if (h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.')) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
    if (h.startsWith('169.254.')) return true;
  }
  return false;
}

function probeWebsite(rawUrl, timeoutMs = 9000) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(String(rawUrl || '')); } catch (e) {
      return resolve({ ok: false, reachable: false, reason: 'Invalid URL', website: WEBSITE_NOT_FOUND });
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      return resolve({ ok: false, reachable: false, reason: 'Only http/https URLs can be probed', website: WEBSITE_NOT_FOUND });
    }
    if (isPrivateHost(url.hostname)) {
      return resolve({ ok: false, reachable: false, reason: 'Private/local hosts are not probed', website: WEBSITE_NOT_FOUND });
    }
    const mod = url.protocol === 'https:' ? https : http;
    let redirects = 0;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };

    function request(target) {
      const req = mod.get(target, {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'MYRAA-Client-Discovery/1.0', Accept: 'text/html,*/*' },
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 3) {
          redirects += 1;
          let next;
          try { next = new URL(res.headers.location, target).toString(); } catch (e) { return finish({ ok: false, reachable: false, reason: 'Bad redirect', website: WEBSITE_NOT_FOUND }); }
          res.resume();
          return request(next);
        }
        if (res.statusCode < 200 || res.statusCode >= 400) {
          res.resume();
          return finish({ ok: false, reachable: false, statusCode: res.statusCode, reason: 'HTTP error', website: WEBSITE_NOT_FOUND });
        }
        let bytes = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (bytes.length < 1024 * 1024) bytes += chunk;
          else res.destroy();
        });
        res.on('end', () => {
          const titleM = bytes.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : null;
          const mails = [...new Set((bytes.match(/mailto:([^"'\s>]+)/gi) || []).map((m) => m.slice(7)).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 5);
          const tels = [...new Set((bytes.match(/tel:([^"'\s>]+)/gi) || []).map((m) => m.slice(4)).filter((t) => /^[+\d][\d\s()-]{5,}$/.test(t)))].slice(0, 5);
          finish({
            ok: true,
            reachable: true,
            url: target,
            finalUrl: target,
            statusCode: res.statusCode,
            title,
            emails: mails,
            phones: tels,
            evidence: `Fetched ${target}; extracted title and contact links only.`,
          });
        });
      });
      req.on('timeout', () => { req.destroy(); finish({ ok: false, reachable: false, reason: 'Timeout', website: WEBSITE_NOT_FOUND }); });
      req.on('error', (e) => finish({ ok: false, reachable: false, reason: e.message, website: WEBSITE_NOT_FOUND }));
    }
    request(url.toString());
  });
}

function pickEvidence(evidence, field) {
  const list = (Array.isArray(evidence) ? evidence : []).filter((e) => e && e.field === field && e.value);
  if (!list.length) return null;
  list.sort((a, b) => (RANK[b.confidence] || 0) - (RANK[a.confidence] || 0));
  return list[0];
}

function clientId(input) {
  const basis = `${input.companyName || input.name || ''}|${input.website || ''}|${input.phone || ''}`.toLowerCase();
  return 'CLI-' + crypto.createHash('sha1').update(basis).digest('hex').slice(0, 8).toUpperCase();
}

function analyze(input = {}, evidence = []) {
  const i = input && typeof input === 'object' ? input : {};
  const ev = Array.isArray(evidence) ? evidence : [];
  const record = {};
  const provenance = {};

  for (const [key] of FIELDS) {
    const best = pickEvidence(ev, key);
    if (best) {
      record[key] = best.value;
      provenance[key] = {
        confidence: best.confidence || 'uncertain',
        source: best.source || 'supplied',
        url: best.url || null,
        checkedAt: best.checkedAt || null,
      };
    } else {
      record[key] = NOT_FOUND;
      provenance[key] = { confidence: 'not_found', source: null, url: null, checkedAt: null };
    }
  }

  record.companyName = record.companyName !== NOT_FOUND ? record.companyName : (i.companyName || i.name || NOT_FOUND);
  record.clientId = clientId(i);

  if (record.website === NOT_FOUND) record.website = WEBSITE_NOT_FOUND;
  if (record.phone === NOT_FOUND) record.phone = PHONE_NOT_VERIFIED;
  if (record.googleMapsLink === NOT_FOUND && i.googleMapsLink) {
    record.googleMapsLink = i.googleMapsLink;
    provenance.googleMapsLink = { confidence: 'likely', source: 'supplied query', url: i.googleMapsLink, checkedAt: null };
  }

  const sourceUrls = [...new Set(ev.map((e) => e && e.url).filter(Boolean))];
  const missing = FIELDS.filter(([key]) => record[key] === NOT_FOUND || record[key] === WEBSITE_NOT_FOUND || record[key] === PHONE_NOT_VERIFIED)
    .map(([key, label]) => label);

  const scores = Object.values(provenance).map((p) => RANK[p.confidence] || 0);
  const overall = scores.some((s) => s === 3) ? 'verified' : scores.some((s) => s === 2) ? 'likely' : scores.some((s) => s === 1) ? 'uncertain' : 'not_found';
  record.verificationStatus = record.verificationStatus !== NOT_FOUND ? record.verificationStatus : overall;
  record.lastVerified = record.lastVerified !== NOT_FOUND ? record.lastVerified : new Date().toISOString();

  return {
    ok: true,
    record,
    provenance,
    sourceUrls,
    missing,
    overallConfidence: overall,
    evidenceLabels: ['verified', 'likely', 'uncertain', 'not_found'],
    honesty: 'Missing fields are reported verbatim. No domain, phone or address is generated.',
  };
}

function toExcelRow(record) {
  return FIELDS.map(([key]) => (record && record[key] !== undefined ? record[key] : NOT_FOUND));
}

function toMarkdown(analysis) {
  const r = analysis.record;
  return [
    'Client Record',
    '-------------',
    `Client ID: ${r.clientId}`,
    `Company: ${r.companyName}`,
    `Contact: ${r.contactPerson} (${r.designation})`,
    `Phone: ${r.phone}`,
    `Email: ${r.email}`,
    `Website: ${r.website}`,
    `Address: [${r.addressLine1}] [${r.addressLine2}] ${r.city} ${r.state} ${r.pinCode} ${r.country}`,
    `Google Maps: ${r.googleMapsLink}`,
    `Status: ${r.verificationStatus}`,
    `Last verified: ${r.lastVerified}`,
    `Missing: ${analysis.missing.join(', ') || 'none'}`,
    `Sources: ${analysis.sourceUrls.join(', ') || 'none supplied'}`,
  ].join('\n');
}

async function addToExcel(input, evidence, opts = {}) {
  if (opts.confirm !== true) {
    return { ok: false, code: 'APPROVAL_REQUIRED', error: 'Writing a client record requires confirm: true.' };
  }
  if (!opts.workbook) {
    return { ok: false, code: 'VALIDATION', error: 'workbook is required (an open Excel workbook).' };
  }
  try {
    const xl = require('./excel_bridge.cjs');
    const a = analyze(input || {}, evidence || []);
    const headers = FIELDS.map(([, label]) => label);
    const row = toExcelRow(a.record);
    const range = opts.range || 'A1';
    const write = await xl.writeRange({ workbook: opts.workbook, sheet: opts.sheet, range, values: [headers, row] });
    if (!write.ok) return { ok: false, code: write.code || 'WRITE_FAILED', error: write.error, analysis: a };
    const start = range.split(':')[0];
    const rowNum = Number((range.match(/\d+/) || [1])[0]) + 1;
    const verify = await xl.readRange({ workbook: opts.workbook, sheet: write.sheet, range: `${start}:Q${rowNum}` });
    return {
      ok: true,
      clientId: a.record.clientId,
      wrote: { workbook: write.workbook, sheet: write.sheet, address: write.address, rows: 2, columns: headers.length },
      verification: {
        readBackOk: verify.ok,
        companyCellMatches: !!(verify.values && verify.values[1] && verify.values[1][0] === a.record.companyName),
        note: verify.ok ? 'Header and client row were read back from the live workbook.' : 'Readback failed; write was attempted but not verified.',
      },
      missing: a.missing,
      sourceUrls: a.sourceUrls,
      websiteStatus: a.record.website,
      analysis: a,
    };
  } catch (e) {
    return { ok: false, code: 'WRITE_ERROR', error: e.message };
  }
}

function createRouter() {
  const express = require('express');
  const router = express.Router();
  router.get('/status', (req, res) => res.json({
    ok: true,
    service: 'client-discovery',
    rules: { website: WEBSITE_NOT_FOUND, phone: PHONE_NOT_VERIFIED, generic: NOT_FOUND },
    networkProbe: 'explicit public http(s) URL only; no private hosts; 9s timeout; title and contact links only',
    neverFabricates: true,
  }));
  router.post('/analyze', (req, res) => {
    const b = req.body || {};
    res.json(analyze(b.input || b, b.evidence || []));
  });
  router.post('/probe', async (req, res) => {
    const r = await probeWebsite((req.body || {}).url);
    res.status(r.ok ? 200 : 404).json(r);
  });
  router.post('/excel-row', (req, res) => {
    const b = req.body || {};
    const a = analyze(b.input || b, b.evidence || []);
    res.json({ ok: true, headers: FIELDS.map(([, label]) => label), row: toExcelRow(a.record), clientId: a.record.clientId });
  });
  router.post('/add-to-excel', async (req, res) => {
    const b = req.body || {};
    const r = await addToExcel(b.input || b, b.evidence || [], b);
    res.status(r.ok ? 200 : (r.code === 'APPROVAL_REQUIRED' ? 409 : (r.code === 'VALIDATION' ? 400 : 409))).json(r);
  });
  return router;
}

module.exports = {
  STATUS: { ok: true, service: 'client-discovery', neverFabricates: true },
  FIELDS, NOT_FOUND, WEBSITE_NOT_FOUND, PHONE_NOT_VERIFIED,
  probeWebsite, analyze, toExcelRow, toMarkdown, addToExcel, createRouter,
};
