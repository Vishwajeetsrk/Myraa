const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/server.cjs', 'utf8');
const lines = s.split('\n').filter(l => l.match(/\.(get|post|put|delete|patch)\s*\(\s*["'](\/api)/));
console.log('Total API routes found:', lines.length);
const routes = [];
lines.forEach(l => {
  const method = (l.match(/\.(get|post|put|delete|patch)\s*\(/) || [])[1];
  const path = (l.match(/["'](\/api[^"']*)/) || [])[1];
  if (method && path) routes.push({ method: method.toUpperCase(), path });
});
const unique = [...new Map(routes.map(r => [r.method + r.path, r])).values()];
unique.forEach(r => console.log(r.method.padEnd(8), r.path));
