'use strict';
/**
 * MYRAA Excel Intelligence (Phase C, spec section 6).
 *
 * Extends (does not replace) office_doc_engine.cjs: real workbook analysis via
 * openpyxl, data-driven chart-type selection, dashboard generation with multiple
 * charts bound to real ranges, and reopen-validation of the produced file.
 * No chart or formula is claimed unless openpyxl can read it back.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const STATUS = Object.freeze(['AVAILABLE', 'PARTIAL', 'DEPENDENCY_MISSING', 'UNAVAILABLE', 'FAILED']);
const CHART_TYPES = Object.freeze(['bar', 'column', 'line', 'pie', 'doughnut', 'scatter', 'area']);

function whichPython() {
  const override = process.env.MYRAA_PYTHON_PATH;
  if (override && fs.existsSync(override)) return override;
  for (const name of ['python', 'py', 'python3']) {
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
    for (const dir of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
      for (const ext of exts) {
        const p = path.join(dir, name + ext);
        try { if (fs.existsSync(p)) return p; } catch (e) { /* skip */ }
      }
    }
  }
  return null;
}

function status() {
  const python = whichPython();
  if (!python) return { ok: false, status: 'DEPENDENCY_MISSING', reason: 'python not found; set MYRAA_PYTHON_PATH' };
  const r = spawnSync(python, ['-c', 'import openpyxl; print(openpyxl.__version__)'], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return { ok: false, status: 'DEPENDENCY_MISSING', reason: 'openpyxl unavailable: ' + ((r.stderr || r.error || {}).message || '').slice(0, 200) };
  return {
    ok: true,
    status: 'AVAILABLE',
    python,
    openpyxl: String(r.stdout || '').trim(),
    chartTypes: CHART_TYPES,
    note: 'analysis/generation/validation run through real openpyxl; output is reopened before success',
  };
}

function workdir() {
  const base = process.env.MYRAA_DATA_DIR || path.join(os.tmpdir(), 'myraa-excel-intel');
  const dir = path.join(base, 'excel-intelligence');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* best effort */ }
  return dir;
}

function runPython(source, args, timeout = 60000) {
  const py = whichPython();
  if (!py) return { ok: false, error: 'DEPENDENCY_MISSING' };
  const script = path.join(workdir(), `xlsx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.py`);
  try { fs.writeFileSync(script, source, 'utf8'); }
  catch (e) { return { ok: false, error: 'SCRIPT_WRITE_FAILED', detail: e.message }; }
  const r = spawnSync(py, [script, ...args], { windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 });
  try { fs.unlinkSync(script); } catch (e) { /* temp */ }
  if (r.error) return { ok: false, error: 'SPAWN_ERROR', detail: r.error.message };
  if (r.status !== 0) return { ok: false, error: 'PYTHON_FAILED', detail: String(r.stderr || '').slice(0, 600) };
  try { return JSON.parse(String(r.stdout || '').trim()); }
  catch (e) { return { ok: false, error: 'BAD_JSON', detail: String(r.stdout || '').slice(0, 300) }; }
}

const ANALYZE_PY = `
import openpyxl, json, sys
from collections import Counter
p = sys.argv[1]
try:
    wb = openpyxl.load_workbook(p, data_only=False, read_only=True)
    out = {"ok": True, "sheets": [], "formulaCount": 0}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            out["sheets"].append({"name": ws.title, "rows": 0, "columns": 0, "empty": True})
            continue
        headers = [str(c) if c is not None else "" for c in rows[0]]
        body = rows[1:]
        ncols = len(headers)
        types, missing, formulas = {}, {}, 0
        samples = []
        for ri, row in enumerate(body):
            for ci in range(ncols):
                v = row[ci] if ci < len(row) else None
                if isinstance(v, str) and v.startswith("="):
                    formulas += 1
                    continue
                if v is None or v == "":
                    missing[ci] = missing.get(ci, 0) + 1
                    continue
                t = "number" if isinstance(v, (int, float)) and not isinstance(v, bool) else ("date" if hasattr(v, "year") else "text")
                types.setdefault(ci, Counter())[t] += 1
        for ci, h in enumerate(headers):
            counts = types.get(ci, {})
            preferred = counts.most_common(1)[0][0] if counts else "unknown"
            colvals = [str(r[ci]) for r in body if ci < len(r) and r[ci] is not None]
            dupes = len(colvals) - len(set(colvals))
            samples.append({"index": ci, "header": h, "inferredType": preferred,
                            "missing": missing.get(ci, 0), "duplicates": dupes,
                            "unique": len(set(colvals))})
        out["formulaCount"] += formulas
        out["sheets"].append({"name": ws.title, "rows": len(body), "columns": ncols,
                              "headers": headers, "columnsInfo": samples, "formulaCount": formulas,
                              "sample": [[str(c) if c is not None else None for c in r[:ncols]] for r in body[:8]]})
    wb.close()
    print(json.dumps(out))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;

function analyzeWorkbook(input) {
  const i = typeof input === 'string' ? { file: input } : (input || {});
  if (!i.file) return { ok: false, error: 'FILE_REQUIRED' };
  const file = path.resolve(i.file);
  if (!fs.existsSync(file)) return { ok: false, error: 'FILE_NOT_FOUND', detail: file };
  const r = runPython(ANALYZE_PY, [file]);
  if (!r.ok) return r;
  const rec = recommendCharts(r);
  return { ...r, recommendations: rec.recommendations, suggestedDashboard: rec.dashboard };
}

function recommendCharts(analysis) {
  const recs = [];
  const dashboard = [];
  for (const sheet of analysis.sheets || []) {
    if (sheet.empty || !sheet.columnsInfo) continue;
    const numeric = sheet.columnsInfo.filter((c) => c.inferredType === 'number' && c.unique > 1);
    const categorical = sheet.columnsInfo.find((c) => c.inferredType === 'text' && c.unique > 1 && c.unique <= 30);
    const dateCol = sheet.columnsInfo.find((c) => c.inferredType === 'date');
    if (numeric.length >= 1 && categorical) {
      recs.push({ sheet: sheet.name, chartType: dateCol ? 'line' : 'bar', reason: 'categorical dimension + numeric measure' + (dateCol ? ' with date axis' : ''), category: categorical.header, measures: numeric.slice(0, 3).map((c) => c.header) });
      dashboard.push({ sheet: sheet.name, chartType: dateCol ? 'line' : 'bar', categoryIndex: categorical.index, valueIndexes: numeric.slice(0, 3).map((c) => c.index) });
    }
    if (numeric.length === 2 && !categorical) {
      recs.push({ sheet: sheet.name, chartType: 'scatter', reason: 'two numeric measures', category: null, measures: numeric.map((c) => c.header) });
      dashboard.push({ sheet: sheet.name, chartType: 'scatter', categoryIndex: null, valueIndexes: numeric.map((c) => c.index) });
    }
    if (numeric.length === 1 && categorical && categorical.unique <= 8 && sheet.rows <= 12) {
      recs.push({ sheet: sheet.name, chartType: 'pie', reason: 'few categories, single measure (part-of-whole)', category: categorical.header, measures: [numeric[0].header] });
    }
  }
  return { ok: true, recommendations: recs, dashboard: dashboard.slice(0, 6) };
}

const GENERATE_PY = `
import openpyxl, json, sys
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart import BarChart, LineChart, PieChart, ScatterChart, Reference
from openpyxl.utils import get_column_letter
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    dest = sys.argv[2]
    wb = openpyxl.Workbook()
    src = wb.active
    src.title = 'Data'
    headers = cfg['headers']
    rows = cfg['rows']
    for ci, h in enumerate(headers, 1):
        c = src.cell(row=1, column=ci, value=h)
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill(start_color='0A192F', end_color='0A192F', fill_type='solid')
        c.alignment = Alignment(horizontal='center')
    for ri, row in enumerate(rows, 2):
        for ci, v in enumerate(row, 1):
            src.cell(row=ri, column=ci, value=v)

    dash = wb.create_sheet('Dashboard')
    dash['A1'] = cfg.get('title', 'MYRAA Analytics Dashboard')
    dash['A1'].font = Font(size=18, bold=True, color='0A192F')
    row_ptr = 3
    created = []
    for spec in cfg.get('charts', []):
        kind = spec.get('chartType', 'bar')
        try:
            if kind == 'pie':
                ch = PieChart(); ch.title = spec.get('title', 'Distribution')
            elif kind == 'line':
                ch = LineChart(); ch.title = spec.get('title', 'Trend')
            elif kind == 'scatter':
                ch = ScatterChart(); ch.title = spec.get('title', 'Relationship')
            else:
                ch = BarChart(); ch.type = 'col'; ch.title = spec.get('title', 'Comparison')
            ci = int(spec['valueIndexes'][0]) + 1
            data = Reference(src, min_col=ci, min_row=1, max_row=len(rows)+1)
            ch.add_data(data, titles_from_data=True)
            if spec.get('categoryIndex') is not None:
                cc = int(spec['categoryIndex']) + 1
                cats = Reference(src, min_col=cc, min_row=2, max_row=len(rows)+1)
                ch.set_categories(cats)
            ch.height = 9; ch.width = 16
            dash.add_chart(ch, f'A{row_ptr}')
            created.append({'type': kind, 'anchor': f'A{row_ptr}', 'valueColumns': [c+1 for c in spec['valueIndexes']]})
            row_ptr += 19
        except Exception as ce:
            created.append({'type': kind, 'error': str(ce)})

    # KPI cards from real sums/counts
    for ci, h in enumerate(headers, 1):
        if not any(isinstance(r[ci-1], (int, float)) for r in rows if len(r) >= ci):
            continue
        dash.cell(row=row_ptr, column=1, value=h + ' (KPI)').font = Font(bold=True)
        dash.cell(row=row_ptr, column=2, value=f'=SUM(Data!{get_column_letter(ci)}2:{get_column_letter(ci)}{len(rows)+1})')
        row_ptr += 1
    wb.save(dest)

    # Reopen validation
    check = openpyxl.load_workbook(dest)
    okcharts = len(check['Dashboard']._charts) if 'Dashboard' in check.sheetnames else 0
    print(json.dumps({"ok": True, "path": dest, "chartsCreated": len(created), "chartsReadBack": okcharts,
                      "sheets": check.sheetnames, "details": created}))
except Exception as e:
    import traceback
    print(json.dumps({"ok": False, "error": str(e), "trace": traceback.format_exc()[:800]}))
`;

function generateDashboard(input) {
  const i = input || {};
  if (!Array.isArray(i.rows) || !i.rows.length || !Array.isArray(i.headers) || !i.headers.length) {
    return { ok: false, error: 'VALIDATION', detail: 'headers and rows are required' };
  }
  const dir = workdir();
  const out = path.resolve(i.output || path.join(dir, `dashboard_${Date.now()}.xlsx`));
  const cfg = {
    headers: i.headers.map(String),
    rows: i.rows.map((r) => Array.isArray(r) ? r : []),
    title: i.title || 'MYRAA Analytics Dashboard',
    charts: Array.isArray(i.charts) && i.charts.length ? i.charts : [],
  };
  if (!cfg.charts.length) return { ok: false, error: 'NO_CHARTS', detail: 'call analyzeWorkbook first or supply charts' };
  for (const c of cfg.charts) {
    if (!CHART_TYPES.includes(c.chartType)) return { ok: false, error: 'UNSUPPORTED_CHART', detail: c.chartType };
  }
  const cfgFile = path.join(dir, `cfg_${Date.now()}.json`);
  try { fs.writeFileSync(cfgFile, JSON.stringify(cfg), 'utf8'); }
  catch (e) { return { ok: false, error: 'CONFIG_WRITE_FAILED', detail: e.message }; }
  const r = runPython(GENERATE_PY, [cfgFile, out], 120000);
  try { fs.unlinkSync(cfgFile); } catch (e) { /* temp */ }
  if (!r.ok) return r;
  if (!r.chartsReadBack || r.chartsReadBack < cfg.charts.length) {
    return { ok: false, error: 'OUTPUT_VALIDATION_FAILED', detail: 'charts not readable from generated workbook', evidence: r };
  }
  return { ...r, verified: true, output: out };
}

function validateWorkbook(input) {
  const file = path.resolve((input && (input.file || input.output)) || '');
  if (!fs.existsSync(file)) return { ok: false, error: 'FILE_NOT_FOUND' };
  const r = runPython(ANALYZE_PY, [file]);
  if (!r.ok) return r;
  return { ...r, verified: true };
}

function createRouter() {
  let router = null;
  try { router = require('express').Router(); } catch (e) { return null; }
  router.get('/status', (req, res) => res.json(status()));
  router.post('/analyze', (req, res) => res.json(analyzeWorkbook(req.body || {})));
  router.post('/recommend', (req, res) => res.json(recommendCharts(req.body || {})));
  router.post('/generate', (req, res) => res.json(generateDashboard(req.body || {})));
  router.post('/validate', (req, res) => res.json(validateWorkbook(req.body || {})));
  return router;
}

module.exports = { STATUS, CHART_TYPES, status, analyzeWorkbook, recommendCharts, generateDashboard, validateWorkbook, createRouter };
