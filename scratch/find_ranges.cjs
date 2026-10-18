'use strict';
const fs = require('fs');
const files = ['ui-health-patch.js', 'myraa_v6_app.js', 'myraa_hud.js', 'universal-control-addon.js', 'assets/index-qnLjC2CG.js'];
for (const f of files) {
  const p = 'resources/app/dist/' + f;
  if (!fs.existsSync(p)) continue;
  const c = fs.readFileSync(p, 'utf8');
  const ranges = [...c.matchAll(/type=["']range["']/gi)];
  console.log(f, 'type=range count:', ranges.length);
  for (const r of ranges) {
    const start = Math.max(0, r.index - 100);
    const end = Math.min(c.length, r.index + 200);
    console.log('--- ' + f + ' at ' + r.index);
    console.log(c.slice(start, end));
  }
}
