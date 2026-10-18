'use strict';
const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, 'resources', 'app', 'dist', 'assets', 'index-qnLjC2CG.js');
let code = fs.readFileSync(bundlePath, 'utf8');

console.log('Original bundle size:', code.length);

// 1. Patch ws.onerror and ws.onclose
const target1 = 'this.ws.onerror=o=>{console.error("WebSocket transport error:",o),this.onError("Holographic network link lost. Please check connection."),this.disconnect()},this.ws.onclose=()=>{console.log("WebSocket connection closed"),this.disconnect()}';
const replace1 = 'this.ws.onerror=o=>{console.warn("WebSocket transport notice:",o),this.disconnect(),this._reconnTimer||(this._reconnTimer=setTimeout(()=>{this._reconnTimer=null,this.connect(this.useMicrophone)},1500))},this.ws.onclose=()=>{console.log("WebSocket connection closed"),this.disconnect(),this._reconnTimer||(this._reconnTimer=setTimeout(()=>{this._reconnTimer=null,this.connect(this.useMicrophone)},1500))}';

if (!code.includes(target1)) {
  console.error('[FAIL] target1 not found in bundle');
  process.exit(1);
}
code = code.replace(target1, replace1);
console.log('[OK] target1 replaced successfully');

// 2. Patch onError filter
const target2 = 'onError:q=>{/goaway|duration|aborted/i.test(q)||vt(q)}';
const replace2 = 'onError:q=>{/goaway|duration|aborted|network link lost|check connection|transport error/i.test(q)||vt(q)}';

if (!code.includes(target2)) {
  console.error('[FAIL] target2 not found in bundle');
  process.exit(1);
}
code = code.replace(target2, replace2);
console.log('[OK] target2 replaced successfully');

// 3. Patch Dismiss Code button
const target3 = 'b.jsx("button",{onClick:()=>vt(null),className:"mt-2 text-[10px] font-bold text-rose-400 underline font-mono uppercase",children:"Dismiss Code"})';
const replace3 = 'b.jsx("button",{onClick:()=>{vt(null);try{typeof ta!="undefined"&&ta.current&&ta.current()}catch{}},className:"mt-2 text-[10px] font-bold text-rose-400 underline font-mono uppercase",children:"Dismiss Code"})';

if (!code.includes(target3)) {
  console.error('[FAIL] target3 not found in bundle');
  process.exit(1);
}
code = code.replace(target3, replace3);
console.log('[OK] target3 replaced successfully');

// 4. Patch sendText to trigger reconnect if needed
const target4 = 'this.pendingTextMessages.push(s)}}flushPendingTextMessages()';
const replace4 = 'this.pendingTextMessages.push(s);try{(!this.ws||this.ws.readyState!==WebSocket.OPEN)&&this.connect(!1)}catch{}}}flushPendingTextMessages()';

if (!code.includes(target4)) {
  console.error('[FAIL] target4 not found in bundle');
  process.exit(1);
}
code = code.replace(target4, replace4);
console.log('[OK] target4 replaced successfully');

fs.writeFileSync(bundlePath, code, 'utf8');
console.log('[SUCCESS] Saved updated bundle! New size:', code.length);
process.exit(0);
