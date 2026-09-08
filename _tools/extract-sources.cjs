#!/usr/bin/env node
/* Extract original TypeScript sources embedded in a Vite/esbuild sourcemap. */
'use strict';
const fs = require('fs');
const path = require('path');

const mapFile = process.argv[2];
const outDir = process.argv[3];
if (!mapFile || !outDir) {
  console.error('usage: node extract-sources.cjs <mapfile> <outdir>');
  process.exit(1);
}
const m = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
let n = 0;
(m.sources || []).forEach((src, i) => {
  const content = m.sourcesContent && m.sourcesContent[i];
  if (!content) {
    console.log('NO CONTENT:', src);
    return;
  }
  const rel = src.split(/[\\/]+/).filter((p) => p !== '..' && p !== '.').join('/');
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  n++;
});
console.log('extracted', n, 'files to', outDir);
