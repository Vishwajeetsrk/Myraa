const fs = require('fs');

const code = fs.readFileSync('C:/Users/Vishwajeet/Videos/MYRAA/resources/app/dist/server.cjs', 'utf8');
console.log('Old server.cjs size:', code.length, 'bytes');

// Search for /live
let idx = 0;
while ((idx = code.indexOf('/live', idx)) !== -1) {
  console.log('--- /live at', idx, '---');
  console.log(code.substring(Math.max(0, idx - 150), Math.min(code.length, idx + 350)));
  idx += 5;
}

// Search for routes
const routeRegex = /app\.(get|post|put|delete|use)\(\s*['"`]([^'"`]+)['"`]/g;
let m;
const routes = [];
while ((m = routeRegex.exec(code)) !== null) {
  routes.push(`${m[1].toUpperCase()} ${m[2]}`);
}
console.log('\n--- ALL ROUTES IN OLD SERVER.CJS ---');
console.log(routes.join('\n'));
