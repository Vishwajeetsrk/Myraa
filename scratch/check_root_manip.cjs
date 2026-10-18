const fs = require('fs');
const s = fs.readFileSync('resources/app/release/win-unpacked/resources/app.asar.unpacked/dist/ui-health-patch.js', 'utf8');

const terms = [
  'getElementById("root")',
  "getElementById('root')",
  "querySelector('#root')",
  'querySelector("#root")',
  'root.innerHTML',
  'root.appendChild',
  'root.remove',
  'canvas'
];

terms.forEach(t => {
  let idx = 0;
  let count = 0;
  while ((idx = s.indexOf(t, idx)) !== -1) {
    count++;
    if (count <= 3) {
      console.log('Match', t, 'at', idx, ':', s.slice(Math.max(0, idx - 40), Math.min(s.length, idx + 100)));
    }
    idx += t.length;
  }
  console.log('Total', t, ':', count);
});
