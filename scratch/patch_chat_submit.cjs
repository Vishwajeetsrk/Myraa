'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.resolve('C:/Users/Vishwajeet/Music/Myraa/resources/app/dist/assets/index-qnLjC2CG.js');
const TMP = path.resolve(os.tmpdir(), 'myraa_bundle_patched.js');

let c = fs.readFileSync(SRC, 'utf8');

// Locate exact handler using a unique suffix
const suffix = 'gt.sendText(q),a==="disconnected"&&await gt.connect(!1))}';
const suffixIdx = c.indexOf(suffix);
if (suffixIdx === -1) {
  // Check if already patched
  if (c.includes('fetch("/api/chat"')) {
    console.log('[OK] Bundle already patched with REST fallback.');
    process.exit(0);
  }
  console.error('FATAL: Handler not found.');
  process.exit(1);
}
console.log('Found suffix at:', suffixIdx);

const funcStart = c.lastIndexOf('ea=async it=>{it.preventDefault();', suffixIdx);
console.log('Function starts at:', funcStart);

const OLD_HANDLER = c.slice(funcStart, suffixIdx + suffix.length);
console.log('Old handler:\n', OLD_HANDLER);

// Build new handler as an array of parts to avoid quote escaping
const dq = '"';
const NEW_HANDLER = [
  'ea=async it=>{',
  'it.preventDefault();',
  'const q=I.trim(),gt=rn.current;',
  'if(!q)return;',
  'vt(null);at("");',
  'if(!gt||a==="disconnected"||a==="connecting"){',
    'fetch("/api/chat",{method:"POST",',
    'headers:{"Content-Type":"application/json"},',
    'body:JSON.stringify({message:q})})',
    '.then(r=>r.json())',
    '.then(d=>{',
      'J(q);',
      'O(d&&d.reply?d.reply:"...");',
      'dt("idle");',
      'setTimeout(()=>{J("");O("");},9000);',
    '})',
    '.catch(()=>{',
      'J(q);',
      'O("Network error - check connection.");',
      'dt("idle");',
    '});',
    'return;',
  '}',
  'gt.sendText(q);',
  '}'
].join('');

console.log('New handler:\n', NEW_HANDLER);

c = c.slice(0, funcStart) + NEW_HANDLER + c.slice(funcStart + OLD_HANDLER.length);

fs.writeFileSync(TMP, c, 'utf8');
console.log('[OK] Written to temp file:', TMP, 'Size:', c.length);

// Stream the tmp file back to source using read/write streams to avoid EPERM from copyFile
const srcFd = fs.openSync(SRC, 'r+');
const tmpContent = fs.readFileSync(TMP);
fs.writeSync(srcFd, tmpContent, 0, tmpContent.length, 0);
fs.ftruncateSync(srcFd, tmpContent.length);
fs.closeSync(srcFd);
console.log('[OK] Written back to source via fd:', SRC);
console.log('Final size:', fs.statSync(SRC).size);

