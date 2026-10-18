'use strict';
/**
 * MYRAA Investigation skills - tests (Phase 17).
 * Run: node tests/test_investigation.cjs (from repo root).
 * No target execution: all fixtures are built in TEMP and only ever read.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const skills = require('../resources/app/dist/investigation_skills.cjs');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name); }
  else { fail++; console.log('  [BAD] ' + name + (extra ? ' :: ' + extra : '')); }
}

const tmpRoot = path.join(os.tmpdir(), 'myraa-investigation-' + Date.now());
fs.mkdirSync(tmpRoot, { recursive: true });
function writeFile(rel, buf) {
  const p = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  return p;
}

function buildPe(machine, optMagic) {
  const buf = Buffer.alloc(160, 0);
  buf.write('MZ', 0, 'ascii');
  buf.writeUInt32LE(64, 0x3c);
  buf.write('PE\0\0', 64, 'ascii');
  buf.writeUInt16LE(machine, 68);
  buf.writeUInt16LE(3, 70);
  buf.writeUInt32LE(0, 72);
  buf.writeUInt16LE(0x0102, 74 + 16);
  buf.writeUInt16LE(optMagic, 88);
  return buf;
}

async function main() {
  console.log('== module surface ==');
  ok('skill catalog has 4 skills', skills.SKILL_CATALOG.length === 4 && skills.SKILL_CATALOG.every((s) => s.id && s.intent && s.summary));
  ok('exports decoders', ['sha256File', 'extractStrings', 'peekPe', 'listAsar', 'peekSqlite', 'listZip', 'inspectArtifact', 'investigateFeature', 'crashScan', 'verifyReconstruction'].every((k) => typeof skills[k] === 'function'));

  console.log('== files + hashing ==');
  const known = writeFile('artifacts/known.bin', Buffer.from('MYRAA evidence bytes'));
  const h = skills.sha256File(known);
  ok('sha256File matches direct hash', h.ok && h.sha256 === crypto.createHash('sha256').update('MYRAA evidence bytes').digest('hex'));
  ok('sha256File reports size', h.sizeBytes === 'MYRAA evidence bytes'.length);
  const missing = skills.sha256File(path.join(tmpRoot, 'nope.bin'));
  ok('sha256File missing file degrades', missing.ok === false && !!missing.error);

  console.log('== strings ==');
  const sbuf = Buffer.concat([Buffer.from('abc'), Buffer.from([0]), Buffer.from('hello world from binary\0\0'), Buffer.from('ok1')]);
  const strs = skills.extractStrings(sbuf);
  ok('ascii runs >=4 kept, <4 dropped', strs.length === 1 && strs[0].text === 'hello world from binary');
  ok('strings cap present', strs.length <= skills.CAPS.MAX_STRINGS);

  console.log('== PE header ==');
  const peX64 = skills.peekPe(buildPe(0x8664, 0x10b));
  ok('x64 detected', peX64.isPe === true && peX64.machine === 'x64' && peX64.optMagic === 'PE32');
  const peArm = skills.peekPe(buildPe(0xaa64, 0x20b));
  ok('arm64 + PE32+ detected', peArm.machine === 'arm64' && peArm.optMagic === 'PE32+');
  ok('non-PE returns isPe false', skills.peekPe(Buffer.from('NOTPE')).isPe === false);
  ok('truncated buffer safe', skills.peekPe(Buffer.alloc(2)).isPe === false);

  console.log('== asar ==');
  const headerJson = JSON.stringify({ files: { 'main.js': { integrity: { algorithm: 'SHA256' }, size: 12 }, 'assets': { files: { 'x.png': { integrity: { algorithm: 'SHA256' }, size: 9 } } } } });
  const hk = Buffer.from(headerJson, 'utf8');
  const abuf = Buffer.concat([
    Buffer.from([4, 0, 0, 0]),
    (function () { const b = Buffer.alloc(4); b.writeUInt32LE(8 + hk.length, 0); return b; })(),
    (function () { const b = Buffer.alloc(4); b.writeUInt32LE(hk.length, 0); return b; })(),
    (function () { const b = Buffer.alloc(4); b.writeUInt32LE(hk.length, 0); return b; })(),
    hk, Buffer.from('PAYLOADBYTES'),
  ]);
  const asar = skills.listAsar(abuf);
  const names = asar.ok ? asar.entries.map((e) => e.path) : [];
  ok('asar entries listed', asar.ok === true && names.includes('main.js') && names.includes('assets/x.png'));
  ok('asar sizes recorded', asar.entries.find((e) => e.path === 'main.js').sizeBytes === 12);
  ok('asar garbage rejected', skills.listAsar(Buffer.from('garbage-garbage-garbage')).ok === false);

  console.log('== sqlite ==');
  const sql = Buffer.alloc(120, 0);
  Buffer.from('SQLite format 3\0', 'binary').copy(sql, 0);
  sql.writeUInt16BE(4096, 16);
  sql.writeUInt32BE(1, 56);
  const peeked = skills.peekSqlite(sql);
  ok('sqlite magic + page + encoding', peeked.isSqlite === true && peeked.pageSizeBytes === 4096 && peeked.textEncoding === 'utf8');
  ok('non-sqlite rejected', skills.peekSqlite(Buffer.from('nope-pad-nope-pad-nope-pad-x')).isSqlite === false);

  console.log('== zip/apk ==');
  const zipName = Buffer.from('AndroidManifest.xml');
  const cd = Buffer.alloc(46 + zipName.length, 0);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(zipName.length, 28);
  zipName.copy(cd, 46);
  const eocd = Buffer.alloc(22, 0);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(21, 16);
  const zipBuf = Buffer.concat([Buffer.from('PK\x03\x04local-header-ish\x00'), cd, eocd]);
  const zip = skills.listZip(zipBuf);
  ok('zip central directory parsed', zip.ok === true && zip.entries[0] === 'AndroidManifest.xml');
  ok('zip garbage rejected', skills.listZip(Buffer.from('plainly not a zip at all')).ok === false);

  console.log('== inspectArtifact ==');
  const exePath = writeFile('artifacts/app.exe', Buffer.concat([buildPe(0x8664, 0x10b), Buffer.from('\0\0strings: tev_live_agent v1.9\0\0')]));
  const insp = skills.inspectArtifact(exePath);
  ok('exe reads as pe_binary', insp.ok && insp.kind === 'pe_binary' && insp.detail.machine === 'x64');
  ok('inspect records hash + path evidence', insp.evidence.some((e) => e.kind === 'path') && insp.evidence.some((e) => e.kind === 'hash' && e.value.startsWith('sha256:')));
  ok('exe has string evidence about hardcoding', insp.evidence.some((e) => e.kind === 'text'));
  const asarPath1 = writeFile('artifacts/app.asar', abuf);
  ok('asar dispatch works', skills.inspectArtifact(asarPath1).kind === 'asar_archive');
  inspectOnlyResult('unknown ext stays generic');
  function inspectOnlyResult(label) {
    const g = skills.inspectArtifact(known);
    ok(label, g.ok && g.kind === 'generic');
  }
  ok('missing artifact target fails cleanly', skills.inspectArtifact(path.join(tmpRoot, 'ghost.exe')).ok === false);

  console.log('== investigateFeature ==');
  writeFile('src/thing.js', Buffer.from('function login(user) {\n  return auth.login(user);\n}\nNOT login here\n'));
  writeFile('node_modules/lib.js', Buffer.from('module login hidden from scan\n'));
  writeFile('img.png', Buffer.from([0, 1, 2, 3]));
  const scan = skills.investigateFeature(tmpRoot, 'login');
  ok('feature scan finds source hits', scan.ok && scan.hits.length === 3 && scan.hits.every((h) => h.file.includes('thing.js')));
  ok('node_modules excluded from scan', !scan.hits.some((h) => h.file.includes('node_modules')));
  ok('line numbers recorded', scan.hits[0].line === 2 || scan.hits.some((h) => h.line === 2));
  ok('empty token rejected', skills.investigateFeature(tmpRoot, '   ').ok === false);
  ok('bad root rejected', skills.investigateFeature(path.join(tmpRoot, 'nothinghere'), 'x').ok === false);

  console.log('== verifyReconstruction + jaccard ==');
  const j = skills.jaccardStrings(['a', 'b', 'c'], ['a', 'c', 'd']);
  ok('jaccard math', j.shared === 2 && j.overlap === 0.6667 && j.onlyA === 1 && j.onlyB === 1);
  const same = writeFile('recon/same.js', Buffer.from('handle request co process co module api service user data\0'));
  const differ = writeFile('recon/diff.js', Buffer.from('handle request co process co module api service other words entirely\0'));
  const vSame = skills.verifyReconstruction(same, same);
  ok('identical reconstruction verdict', vSame.ok && vSame.identical === true && vSame.verdict.includes('byte-identical') && vSame.evidence.length === 3);
  const vDiff = skills.verifyReconstruction(same, differ);
  ok('different reconstruction verdict', vDiff.ok && vDiff.identical === false && vDiff.verdict.includes('different'));
  ok('missing file for verification fails', skills.verifyReconstruction(same, path.join(tmpRoot, 'ghost.js')).ok === false);

  console.log('== crashScan ==');
  const dmp = writeFile('crash/app.1.5.0.dmp', Buffer.from('Exception\0 ExceptionCode 0xC0000005\0 ACCESS_VIOLATION\0 stack trace frame\0 normal words\0'));
  const crash = skills.crashScan(dmp);
  ok('crash keywords captured', crash.ok && crash.crashSignatures.length >= 2);
  ok('crash records hash evidence', crash.evidence.some((e) => e.kind === 'hash'));
  ok('crash note stays honest about debugger limits', /debugger\/minidump/.test(crash.note));
  ok('crash on unreadable file fails cleanly', skills.crashScan(path.join(tmpRoot, 'ghost.dmp')).ok === false);

  console.log(fail === 0 ? 'PASS=' + pass + ' FAIL=' + fail : 'FAIL=' + fail);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('test crashed:', e.message); process.exit(1); });
