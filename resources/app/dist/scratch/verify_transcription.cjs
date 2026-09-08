const fs = require('fs');
const s = fs.readFileSync('D:/Team of Vishwajeet/MYRAA/resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');
const target = 'q==="model"&&(O(Rt=>{const Tt=Rt+gt,Ot=E(Tt);return kt(Ot),Tt}),J(""))';
console.log('Found exact match:', s.includes(target));
const idx = s.indexOf('q==="model"&&(O(Rt=>{');
if (idx !== -1) {
  console.log('Snippet:', s.slice(idx, idx + 100));
}
