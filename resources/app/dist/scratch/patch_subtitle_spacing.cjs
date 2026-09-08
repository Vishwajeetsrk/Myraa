const fs = require('fs');
const filePath = 'D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js';
let s = fs.readFileSync(filePath, 'utf8');

const target = 'q==="model"&&(O(Rt=>{const Tt=Rt+gt,Ot=E(Tt);return kt(Ot),Tt}),J(""))';
const replacement = 'q==="model"&&(O(Rt=>{const sep=(Rt&&!/\\s$/.test(Rt)&&!/^\\s/.test(gt))?" ":"";let Tt=(Rt+sep+gt).replace(/([.?!,;:])([A-Za-z0-9])/g,"$1 $2").replace(/\\[\\s*(?:MYRAA\\s+)?(?:VISION|VISUAL|INTERNAL|PROACTIVE|COGNITIVE|AWARENESS|PRESENCE|SYSTEM|OBSERVATION|ACTION|PLAN)[^\\]]*\\]\\s*/gi,"").trimStart();const Ot=E(Tt);return kt(Ot),Tt}),J(""))';

if (!s.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}

s = s.replace(target, replacement);
fs.writeFileSync(filePath, s, 'utf8');
console.log('Successfully patched index-qnLjC2CG.js with subtitle spacing and tag sanitizer!');
