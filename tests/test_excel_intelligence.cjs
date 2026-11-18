'use strict';
// Excel Intelligence: real openpyxl analysis, chart selection, dashboard generation + readback.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const ei = require(path.join(DIST, 'excel_intelligence.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const st = ei.status();
  check('real python + openpyxl resolved', st.ok && st.status === 'AVAILABLE' && /3\./.test(st.openpyxl), JSON.stringify(st).slice(0, 180));
  check('chart types are honest list', ei.CHART_TYPES.includes('bar') && ei.CHART_TYPES.includes('scatter') && !ei.CHART_TYPES.includes('fake'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myraa_xlsx_'));
  const src = path.join(dir, 'sales.xlsx');
  const py = st.python;
  const setup = spawnSync(py, ['-c', `
import openpyxl
wb=openpyxl.Workbook(); ws=wb.active; ws.title='Sales'
ws.append(['Region','Revenue','Units','Growth'])
for r in [('North',1200,30,'=B2*0.1'),('South',900,22,'=B3*0.1'),('East',1500,40,'=B4*0.1'),('West',700,18,'=B5*0.1')]: ws.append(r)
wb.save(r'${src.replace(/\\/g, '\\\\')}')
`], { windowsHide: true, encoding: 'utf8' });
  check('real source workbook created', setup.status === 0 && fs.existsSync(src), (setup.stderr || '').slice(0, 200));
  if (!fs.existsSync(src)) { console.log('\nexcel intelligence tests: ' + pass + ' pass, ' + fail + ' fail'); process.exit(1); }

  const an = ei.analyzeWorkbook({ file: src });
  check('analysis reads real sheets/headers', an.ok && an.sheets[0].name === 'Sales' && an.sheets[0].headers[0] === 'Region' && an.sheets[0].rows === 4, JSON.stringify(an).slice(0, 220));
  check('analysis infers real column types', an.sheets[0].columnsInfo[1].inferredType === 'number' && an.sheets[0].columnsInfo[0].inferredType === 'text');
  check('analysis counts real formulas', an.formulaCount >= 4, String(an.formulaCount));
  check('recommendations derived from data shape', an.recommendations.length > 0 && an.recommendations[0].chartType === 'bar', JSON.stringify(an.recommendations).slice(0, 200));

  const rows = [
    ['North', 1200, 30], ['South', 900, 22], ['East', 1500, 40], ['West', 700, 18],
  ];
  const out = path.join(dir, 'dashboard.xlsx');
  const gen = ei.generateDashboard({
    headers: ['Region', 'Revenue', 'Units'], rows,
    title: 'MYRAA Sales Dashboard',
    charts: [
      { chartType: 'bar', categoryIndex: 0, valueIndexes: [1], title: 'Revenue by Region' },
      { chartType: 'line', categoryIndex: 0, valueIndexes: [2], title: 'Units Trend' },
    ],
    output: out,
  });
  check('dashboard generated with charts read back', gen.ok && gen.chartsReadBack >= 2 && gen.verified === true, JSON.stringify(gen).slice(0, 260));
  check('output file is real and non-empty', fs.existsSync(out) && fs.statSync(out).size > 4000);

  const val = ei.validateWorkbook({ file: out });
  check('generated workbook reopens via openpyxl', val.ok && val.verified === true && val.sheets.some((s) => s.name === 'Dashboard'), JSON.stringify(val).slice(0, 200));

  const bad = ei.generateDashboard({ headers: ['A'], rows: [[1]], charts: [{ chartType: 'hologram', valueIndexes: [0] }], output: path.join(dir, 'bad.xlsx') });
  check('unsupported chart type rejected', !bad.ok && bad.error === 'UNSUPPORTED_CHART');
  const noCharts = ei.generateDashboard({ headers: ['A'], rows: [[1]], output: path.join(dir, 'none.xlsx') });
  check('no-chart generation refused (no fake success)', !noCharts.ok && noCharts.error === 'NO_CHARTS');
  const missing = ei.analyzeWorkbook({ file: path.join(dir, 'missing.xlsx') });
  check('missing file rejected honestly', !missing.ok && missing.error === 'FILE_NOT_FOUND');

  const router = ei.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes status/analyze/recommend/generate/validate', ['/status', '/analyze', '/recommend', '/generate', '/validate'].every((p) => paths.includes(p)));

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp only */ }
  console.log('\nexcel intelligence tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.stack || e)); process.exit(1); });
