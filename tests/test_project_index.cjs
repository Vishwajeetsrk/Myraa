'use strict';
// Phase 12: project/memory counts must come from real files, never placeholders.

const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'resources', 'app', 'dist');
const idx = require(path.join(DIST, 'project_index.cjs'));

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('[OK] ' + name); }
  else { fail++; console.log('[FAIL] ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  const projects = idx.list();
  check('projects are discovered from real dirs', Array.isArray(projects) && projects.every((p) => fs.existsSync(p.path)));
  check('no placeholder project names', projects.every((p) => p.name && !/placeholder|sample|demo project/i.test(p.name)));
  check('file counts are real or honestly null', projects.every((p) => p.files === null || (Number.isInteger(p.files) && p.files >= 0)));
  check('file scan is bounded', projects.every((p) => p.files === null || p.files <= 2000));
  check('git info is derived from .git', projects.every((p) => typeof p.git.isRepo === 'boolean'));
  check('unknown fields are null, not zero', projects.every((p) => ['conversations', 'memories', 'agents', 'tools', 'notes', 'activity'].every((k) => p[k] === null)));

  const mem = idx.memoryOverview();
  check('memory overview covers real stores', mem.ok === true && mem.sources.length === 4);
  check('each store has a real path', mem.sources.every((s) => typeof s.path === 'string' && s.path.length > 0));
  check('counts are finite or null', mem.sources.every((s) => s.count === null || Number.isInteger(s.count)));
  check('missing stores report not found', mem.sources.every((s) => s.present === true || s.error === 'not found'));
  check('totalKnown sums only known counts', mem.totalKnown === mem.sources.reduce((n, s) => n + (Number.isFinite(s.count) ? s.count : 0), 0));
  check('null count is explained', /null means unreadable/.test(mem.note));

  const router = idx.createRouter();
  const paths = router && router.stack ? router.stack.map((l) => l.route && l.route.path).filter(Boolean) : [];
  check('router exposes list + memory-overview', paths.includes('/list') && paths.includes('/memory-overview'));

  console.log('\nproject index tests: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('[FAIL] crash: ' + (e && e.message)); process.exit(1); });
