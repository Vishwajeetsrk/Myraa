const fs = require('fs');
const path = require('path');

const oldRoot = 'C:/Users/Vishwajeet/Videos/MYRAA';
const newRoot = 'C:/Users/Vishwajeet/Music/Myraa';

console.log('=== COMPARING TOP LEVEL ===');
console.log('Old root files:', fs.readdirSync(oldRoot));

console.log('\n=== OLD APP STRUCTURE ===');
function listTree(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'agent_dist') continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      console.log(`${prefix}[DIR]  ${item}`);
      listTree(full, prefix + '  ');
    } else {
      console.log(`${prefix}[FILE] ${item} (${stat.size} bytes)`);
    }
  }
}

console.log('--- Old resources/app:');
listTree(path.join(oldRoot, 'resources', 'app'));

console.log('\n--- New resources/app:');
listTree(path.join(newRoot, 'resources', 'app'));
