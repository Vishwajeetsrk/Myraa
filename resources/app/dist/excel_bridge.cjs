'use strict';
/**
 * MYRAA Excel Bridge — live Microsoft Excel control over COM.
 *
 * Scope split, deliberately:
 *   - excel_intelligence.cjs  : offline .xlsx analysis/generation (Python/openpyxl)
 *   - excel_bridge.cjs        : the RUNNING Excel instance the user is looking at
 *
 * Nothing here duplicates the file engine, and nothing here starts a hidden
 * workbook to fake success. If Excel is not running, or the named workbook is
 * missing/ambiguous, the call fails with an honest code.
 *
 * Safety:
 *   - delete-sheet / delete-rows / close require confirm: true.
 *   - Arguments cross the PowerShell boundary as base64 JSON, never as
 *     interpolated script text.
 *   - The user's other workbooks are never closed. Excel.Quit is never called.
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const express = require('express');

const RUNNER_SCRIPT = path.join(__dirname, 'excel_bridge_runner.ps1');
const DEFAULT_TIMEOUT = 45000;
const MAX_TIMEOUT = 120000;

function run(command, args = {}, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(RUNNER_SCRIPT)) {
        return resolve({ ok: false, code: 'RUNNER_MISSING', error: `Excel bridge runner not found: ${RUNNER_SCRIPT}` });
      }
      const payload = Buffer.from(JSON.stringify(args || {}), 'utf8').toString('base64');
      const argv = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', RUNNER_SCRIPT,
        '-Command', String(command),
        '-ArgsB64', payload,
      ];
      const ms = Math.min(MAX_TIMEOUT, Math.max(5000, Number(timeout) || DEFAULT_TIMEOUT));
      execFile('powershell.exe', argv, {
        encoding: 'utf8',
        timeout: ms,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      }, (err, stdout, stderr) => {
        const text = String(stdout || '').trim();
        if (text) {
          const parsed = parseOutput(text);
          if (parsed) return resolve(parsed);
        }
        if (err) {
          return resolve({
            ok: false,
            code: err.killed ? 'TIMEOUT' : 'POWERSHELL_ERROR',
            error: err.killed ? `Excel did not answer within ${ms} ms.` : err.message,
            stderr: String(stderr || '').trim().slice(0, 800) || undefined,
          });
        }
        return resolve({ ok: false, code: 'EMPTY_RESPONSE', error: 'Excel bridge returned no output.' });
      });
    } catch (err) {
      resolve({ ok: false, code: 'BRIDGE_ERROR', error: String((err && err.message) || err) });
    }
  });
}

function parseOutput(text) {
  try { return JSON.parse(text); } catch (e) { /* fall through to last line */ }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    try { return JSON.parse(line); } catch (e) { /* keep scanning */ }
  }
  return null;
}

// ── public operations ────────────────────────────────────────────────────────

function status() { return run('status'); }
function workbooks() { return run('workbooks'); }
function sheets(workbook) { return run('sheets', { workbook }); }
function info(workbook, sheet) { return run('info', { workbook, sheet }); }
function selection() { return run('selection'); }

function readRange(opts = {}) {
  return run('read', {
    workbook: opts.workbook,
    sheet: opts.sheet,
    range: opts.range || 'A1',
    formulas: opts.formulas === true,
    text: opts.text === true,
    formats: opts.formats === true,
  });
}

function writeRange(opts = {}) {
  return run('write', {
    workbook: opts.workbook,
    sheet: opts.sheet,
    range: opts.range || 'A1',
    values: opts.values,
    asFormula: opts.asFormula === true,
  });
}

function setFormula(opts = {}) {
  return run('formula', {
    workbook: opts.workbook,
    sheet: opts.sheet,
    range: opts.range || 'A1',
    formula: opts.formula,
  });
}

function formatRange(opts = {}) {
  const args = { workbook: opts.workbook, sheet: opts.sheet, range: opts.range || 'A1' };
  const keys = [
    'bold', 'italic', 'fontSize', 'fontName', 'numberFormat', 'wrapText',
    'columnWidth', 'rowHeight', 'fillColor', 'fontColor',
    'horizontalAlignment', 'verticalAlignment', 'borders',
  ];
  for (const k of keys) {
    if (opts[k] !== undefined) args[k] = opts[k];
  }
  return run('format', args);
}

function addSheet(opts = {}) { return run('add-sheet', { workbook: opts.workbook, name: opts.name, after: opts.after }); }
function renameSheet(opts = {}) { return run('rename-sheet', { workbook: opts.workbook, sheet: opts.sheet, name: opts.name }); }
function deleteSheet(opts = {}) { return run('delete-sheet', { workbook: opts.workbook, sheet: opts.sheet, confirm: opts.confirm === true }); }
function insertRows(opts = {}) { return run('insert-rows', { workbook: opts.workbook, sheet: opts.sheet, at: opts.at, count: opts.count }); }
function deleteRows(opts = {}) { return run('delete-rows', { workbook: opts.workbook, sheet: opts.sheet, at: opts.at, count: opts.count, confirm: opts.confirm === true }); }

function createChart(opts = {}) {
  return run('chart', {
    workbook: opts.workbook,
    sheet: opts.sheet,
    range: opts.range,
    type: opts.type || 'column',
    title: opts.title,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
  });
}

function save(opts = {}) { return run('save', { workbook: opts.workbook, path: opts.path }); }
function openWorkbook(opts = {}) { return run('open', { path: opts.path, readOnly: opts.readOnly === true }, 60000); }
function createWorkbook(opts = {}) { return run('create-workbook', { path: opts.path }, 60000); }
function closeWorkbook(opts = {}) {
  return run('close', { workbook: opts.workbook, save: opts.save === true, confirm: opts.confirm === true });
}
function recalculate() { return run('recalculate'); }

function sortRange(opts = {}) {
  return run('sort', { workbook: opts.workbook, sheet: opts.sheet, range: opts.range, key: opts.key, descending: opts.descending === true, header: opts.header !== false });
}
function autoFilter(opts = {}) {
  return run('autofilter', { workbook: opts.workbook, sheet: opts.sheet, range: opts.range, field: opts.field, criteria: opts.criteria });
}
function tables(workbook) { return run('tables', { workbook }); }
function createTable(opts = {}) {
  return run('create-table', { workbook: opts.workbook, sheet: opts.sheet, range: opts.range, name: opts.name, header: opts.header !== false });
}
function namedRanges(workbook) { return run('named-ranges', { workbook }); }
function addNamedRange(opts = {}) {
  return run('add-named-range', { workbook: opts.workbook, sheet: opts.sheet, name: opts.name, range: opts.range });
}
function dataValidation(opts = {}) {
  return run('data-validation', { workbook: opts.workbook, sheet: opts.sheet, range: opts.range, values: opts.values });
}
function conditionalFormat(opts = {}) {
  return run('conditional-format', { workbook: opts.workbook, sheet: opts.sheet, range: opts.range, operator: opts.operator || 'greater', value: opts.value, fillColor: opts.fillColor });
}
function activateSheet(opts = {}) { return run('activate-sheet', { workbook: opts.workbook, sheet: opts.sheet }); }
function insertColumns(opts = {}) { return run('insert-columns', { workbook: opts.workbook, sheet: opts.sheet, at: opts.at, count: opts.count }); }
function deleteColumns(opts = {}) { return run('delete-columns', { workbook: opts.workbook, sheet: opts.sheet, at: opts.at, count: opts.count, confirm: opts.confirm === true }); }

// ── HTTP layer ───────────────────────────────────────────────────────────────

const STATUS_BY_CODE = {
  VALIDATION: 400,
  RANGE_TOO_LARGE: 400,
  UNKNOWN_COMMAND: 400,
  FILE_NOT_FOUND: 400,
  SHEET_NOT_FOUND: 404,
  WORKBOOK_NOT_FOUND: 404,
  NOT_A_RANGE: 409,
  AMBIGUOUS: 409,
  NO_WORKBOOK: 409,
  NO_ACTIVE_WORKBOOK: 409,
  NO_ACTIVE_SHEET: 409,
  NEEDS_PATH: 409,
  APPROVAL_REQUIRED: 409,
  EXCEL_BUSY: 503,
  EXCEL_NOT_ATTACHED: 503,
  TIMEOUT: 504,
  COM_ERROR: 500,
};

function send(res, result) {
  const http = result && result.ok ? 200 : (STATUS_BY_CODE[result && result.code] || 500);
  return res.status(http).json(result);
}

function handler(fn) {
  return async (req, res) => {
    try {
      const body = { ...(req.body || {}) };
      for (const [k, v] of Object.entries(req.query || {})) {
        if (body[k] === undefined) body[k] = v;
      }
      send(res, await fn(body));
    } catch (err) {
      res.status(500).json({ ok: false, code: 'ROUTE_ERROR', error: String((err && err.message) || err) });
    }
  };
}

function createRouter() {
  const router = express.Router();

  router.get('/status', handler(() => status()));
  router.get('/workbooks', handler(() => workbooks()));
  router.get('/sheets', handler((q) => sheets(q.workbook)));
  router.get('/info', handler((q) => info(q.workbook, q.sheet)));
  router.get('/selection', handler(() => selection()));

  router.post('/read', handler((b) => readRange(b)));
  router.post('/write', handler((b) => writeRange(b)));
  router.post('/formula', handler((b) => setFormula(b)));
  router.post('/format', handler((b) => formatRange(b)));
  router.post('/sheet/add', handler((b) => addSheet(b)));
  router.post('/sheet/rename', handler((b) => renameSheet(b)));
  router.post('/sheet/delete', handler((b) => deleteSheet(b)));
  router.post('/rows/insert', handler((b) => insertRows(b)));
  router.post('/rows/delete', handler((b) => deleteRows(b)));
  router.post('/chart', handler((b) => createChart(b)));
  router.post('/save', handler((b) => save(b)));
  router.post('/recalculate', handler(() => recalculate()));
  router.post('/sort', handler((b) => sortRange(b)));
  router.post('/autofilter', handler((b) => autoFilter(b)));
  router.get('/tables', handler((q) => tables(q.workbook)));
  router.post('/tables', handler((b) => createTable(b)));
  router.get('/named-ranges', handler((q) => namedRanges(q.workbook)));
  router.post('/named-ranges', handler((b) => addNamedRange(b)));
  router.post('/data-validation', handler((b) => dataValidation(b)));
  router.post('/conditional-format', handler((b) => conditionalFormat(b)));
  router.post('/sheet/activate', handler((b) => activateSheet(b)));
  router.post('/columns/insert', handler((b) => insertColumns(b)));
  router.post('/columns/delete', handler((b) => deleteColumns(b)));
  router.post('/workbook/open', handler((b) => openWorkbook(b)));
  router.post('/workbook/create', handler((b) => createWorkbook(b)));
  router.post('/workbook/close', handler((b) => closeWorkbook(b)));

  router.get('/', (req, res) => {
    res.json({
      ok: true,
      service: 'excel-bridge',
      engine: 'live COM automation of the running Excel instance',
      operations: [
        'GET /status', 'GET /workbooks', 'GET /sheets', 'GET /info', 'GET /selection',
        'POST /read', 'POST /write', 'POST /formula', 'POST /format',
        'POST /sheet/add', 'POST /sheet/rename', 'POST /sheet/delete',
        'POST /rows/insert', 'POST /rows/delete', 'POST /chart',
        'POST /save', 'POST /recalculate',
        'POST /workbook/open', 'POST /workbook/create', 'POST /workbook/close',
      ],
      safety: {
        requiresConfirm: ['/sheet/delete', '/rows/delete', '/workbook/close'],
        neverQuitsExcel: true,
        neverCreatesHiddenWorkbookForWrite: true,
        argumentTransport: 'base64 JSON (no script interpolation)',
      },
      offlineAnalysis: '/api/excel-intelligence (openpyxl file engine)',
    });
  });

  return router;
}

module.exports = {
  RUNNER_SCRIPT,
  status,
  workbooks,
  sheets,
  info,
  selection,
  readRange,
  writeRange,
  setFormula,
  formatRange,
  addSheet,
  renameSheet,
  deleteSheet,
  insertRows,
  deleteRows,
  createChart,
  save,
  openWorkbook,
  createWorkbook,
  closeWorkbook,
  recalculate,
  sortRange,
  autoFilter,
  tables,
  createTable,
  namedRanges,
  addNamedRange,
  dataValidation,
  conditionalFormat,
  activateSheet,
  insertColumns,
  deleteColumns,
  createRouter,
};
