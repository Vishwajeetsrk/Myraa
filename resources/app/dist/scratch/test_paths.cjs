const path = require('path');
const fs = require('fs');

// Simulate NSIS double-nesting: process.resourcesPath = ...\MYRAA AI OS\MYRAA AI OS\resources
const doubleNested = 'C:/Program Files/MYRAA AI OS/MYRAA AI OS/resources';

// Build candidate paths like main.cjs does
const baseDir = path.dirname(doubleNested);
const candidates = [
  path.join(doubleNested, 'app', 'dist', 'server.cjs'),
  path.join(doubleNested, 'app.asar.unpacked', 'dist', 'server.cjs'),
  path.join(baseDir, 'resources', 'app', 'dist', 'server.cjs'),
  path.join(baseDir, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
  path.join(path.dirname(baseDir), 'resources', 'app', 'dist', 'server.cjs'),
  path.join(path.dirname(baseDir), 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
];

// Test against the actual installed location
console.log('=== Testing against OLD install (double-nested) ===');
candidates.forEach(c => {
  console.log(fs.existsSync(c) ? '  EXISTS' : '  MISSING', c);
});

// Test against the new build (single-nested)
const singleNested = 'C:/Program Files/MYRAA AI OS/resources';
const baseDir2 = path.dirname(singleNested);
const candidates2 = [
  path.join(singleNested, 'app', 'dist', 'server.cjs'),
  path.join(singleNested, 'app.asar.unpacked', 'dist', 'server.cjs'),
  path.join(baseDir2, 'resources', 'app', 'dist', 'server.cjs'),
  path.join(baseDir2, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
];
console.log('\n=== Testing against NEW install (single-nested) ===');
candidates2.forEach(c => {
  console.log(fs.existsSync(c) ? '  EXISTS' : '  MISSING', c);
});

// Test against our build output
const buildOutput = 'C:/Users/Vishwajeet/Music/Myraa/resources/app/release/win-unpacked/resources';
const baseDir3 = path.dirname(buildOutput);
const candidates3 = [
  path.join(buildOutput, 'app', 'dist', 'server.cjs'),
  path.join(buildOutput, 'app.asar.unpacked', 'dist', 'server.cjs'),
  path.join(baseDir3, 'resources', 'app', 'dist', 'server.cjs'),
  path.join(baseDir3, 'resources', 'app.asar.unpacked', 'dist', 'server.cjs'),
];
console.log('\n=== Testing against BUILD OUTPUT ===');
candidates3.forEach(c => {
  console.log(fs.existsSync(c) ? '  EXISTS' : '  MISSING', c);
});
