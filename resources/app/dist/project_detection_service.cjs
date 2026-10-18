'use strict';
/**
 * project_detection_service.cjs — Deep Project Detection & Analysis
 * MYRAA Coding Agent — Phase 3
 *
 * Detects: framework, language, package manager, scripts, dependencies,
 *          database, environment, Git state, architecture, important files.
 */

const fs = require('fs');
const path = require('path');

const FRAMEWORK_SIGNATURES = {
  // Frontend
  'react': { pkg: 'react', devDeps: ['react-dom', 'vite', 'webpack'], scripts: ['dev', 'build'] },
  'next.js': { pkg: 'next', scripts: ['dev', 'build', 'start'] },
  'vite': { devDeps: ['vite'], scripts: ['dev', 'build'] },
  'vue': { pkg: 'vue', devDeps: ['@vue/cli-service', 'vite'] },
  'angular': { pkg: '@angular/core', devDeps: ['@angular/cli'] },
  'svelte': { pkg: 'svelte', devDeps: ['svelte-check'] },
  'remix': { pkg: '@remix-run/react', scripts: ['dev', 'build'] },
  'solid': { pkg: 'solid-js' },
  'qwik': { pkg: '@builder.io/qwik' },
  // Backend
  'express': { pkg: 'express' },
  'fastify': { pkg: 'fastify' },
  'nestjs': { pkg: '@nestjs/core', devDeps: ['@nestjs/cli'] },
  'hono': { pkg: 'hono' },
  // Python
  'django': { files: ['manage.py', 'settings.py'], exts: ['.py'] },
  'flask': { pkg: 'Flask', files: ['app.py', 'wsgi.py'] },
  'fastapi': { pkg: 'fastapi', files: ['main.py'] },
  'uvicorn': { pkg: 'uvicorn' },
  // Rust
  'rust': { files: ['Cargo.toml'], exts: ['.rs'] },
  // Go
  'go': { files: ['go.mod'], exts: ['.go'] },
  // Java
  'spring': { files: ['pom.xml', 'build.gradle'], exts: ['.java'] },
  // Desktop
  'electron': { pkg: 'electron', devDeps: ['electron-builder'] },
  'tauri': { files: ['tauri.conf.json'], exts: ['.rs', '.ts'] },
};

const DATABASE_SIGNATURES = {
  'postgres': { pkg: 'pg', envVars: ['DATABASE_URL', 'POSTGRES_URL'], files: ['knexfile.js', 'drizzle.config.ts', 'prisma/schema.prisma'] },
  'mysql': { pkg: 'mysql2', envVars: ['MYSQL_URL', 'DATABASE_URL'] },
  'sqlite': { pkg: 'better-sqlite3', files: ['*.db', '*.sqlite'] },
  'mongodb': { pkg: 'mongoose', envVars: ['MONGODB_URI', 'MONGO_URL'] },
  'redis': { pkg: 'redis', envVars: ['REDIS_URL'] },
  'prisma': { devDeps: ['prisma', '@prisma/client'], files: ['prisma/schema.prisma'] },
  'drizzle': { devDeps: ['drizzle-orm'], files: ['drizzle.config.ts', 'drizzle.config.js'] },
  'knex': { pkg: 'knex', files: ['knexfile.js'] },
};

const PACKAGE_MANAGERS = {
  'npm': { lock: 'package-lock.json', config: 'package.json' },
  'yarn': { lock: 'yarn.lock', config: '.yarnrc.yml' },
  'pnpm': { lock: 'pnpm-lock.yaml', config: 'pnpm-workspace.yaml' },
  'bun': { lock: 'bun.lockb', config: 'bunfig.toml' },
  'pip': { lock: null, config: 'requirements.txt' },
  'poetry': { lock: 'poetry.lock', config: 'pyproject.toml' },
  'cargo': { lock: 'Cargo.lock', config: 'Cargo.toml' },
  'go-mod': { lock: 'go.sum', config: 'go.mod' },
};

function _exists(p) { return fs.existsSync(p); }
function _readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
function _readText(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

function _scanDir(dir, depth = 0, maxDepth = 3, results = []) {
  if (depth > maxDepth) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
      if (e.isDirectory()) {
        results.push({ type: 'dir', name: e.name, path: path.join(dir, e.name) });
        _scanDir(path.join(dir, e.name), depth + 1, maxDepth, results);
      } else {
        results.push({ type: 'file', name: e.name, path: path.join(dir, e.name) });
      }
    }
  } catch { /* permission denied */ }
  return results;
}

function _detectLanguage(dir, files) {
  const extCounts = {};
  for (const f of files) {
    if (f.type !== 'file') continue;
    const ext = path.extname(f.name).toLowerCase();
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) extCounts['javascript'] = (extCounts['javascript'] || 0) + 1;
    else if (ext === '.py') extCounts['python'] = (extCounts['python'] || 0) + 1;
    else if (ext === '.rs') extCounts['rust'] = (extCounts['rust'] || 0) + 1;
    else if (ext === '.go') extCounts['go'] = (extCounts['go'] || 0) + 1;
    else if (ext === '.java') extCounts['java'] = (extCounts['java'] || 0) + 1;
    else if (ext === '.cs') extCounts['csharp'] = (extCounts['csharp'] || 0) + 1;
    else if (ext === '.rb') extCounts['ruby'] = (extCounts['ruby'] || 0) + 1;
    else if (ext === '.php') extCounts['php'] = (extCounts['php'] || 0) + 1;
    else if (ext === '.swift') extCounts['swift'] = (extCounts['swift'] || 0) + 1;
    else if (ext === '.kt') extCounts['kotlin'] = (extCounts['kotlin'] || 0) + 1;
    else if (ext === '.html') extCounts['html'] = (extCounts['html'] || 0) + 1;
    else if (ext === '.css') extCounts['css'] = (extCounts['css'] || 0) + 1;
    else if (ext === '.scss') extCounts['scss'] = (extCounts['scss'] || 0) + 1;
    else if (ext === '.vue') extCounts['vue'] = (extCounts['vue'] || 0) + 1;
    else if (ext === '.svelte') extCounts['svelte'] = (extCounts['svelte'] || 0) + 1;
    else if (ext === '.sql') extCounts['sql'] = (extCounts['sql'] || 0) + 1;
    else if (ext === '.json') extCounts['json'] = (extCounts['json'] || 0) + 1;
    else if (ext === '.yaml' || ext === '.yml') extCounts['yaml'] = (extCounts['yaml'] || 0) + 1;
    else if (ext === '.toml') extCounts['toml'] = (extCounts['toml'] || 0) + 1;
    else if (ext === '.sh' || ext === '.ps1') extCounts['shell'] = (extCounts['shell'] || 0) + 1;
  }
  const sorted = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'unknown';
}

function _detectFramework(pkgJson, files) {
  const detected = [];
  const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  for (const [name, sig] of Object.entries(FRAMEWORK_SIGNATURES)) {
    if (sig.pkg && allDeps[sig.pkg]) { detected.push(name); continue; }
    if (sig.devDeps && sig.devDeps.some(d => allDeps[d])) { detected.push(name); continue; }
    if (sig.files && sig.files.some(f => files.some(ff => ff.name === f || ff.name.endsWith(f)))) { detected.push(name); continue; }
    if (sig.scripts && sig.scripts.every(s => pkgJson.scripts && pkgJson.scripts[s])) { detected.push(name); continue; }
  }
  return detected;
}

function _detectDatabase(pkgJson, files, envContent) {
  const detected = [];
  const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  for (const [name, sig] of Object.entries(DATABASE_SIGNATURES)) {
    if (sig.pkg && allDeps[sig.pkg]) { detected.push(name); continue; }
    if (sig.devDeps && sig.devDeps.some(d => allDeps[d])) { detected.push(name); continue; }
    if (sig.envVars && sig.envVars.some(v => envContent.includes(v))) { detected.push(name); continue; }
    if (sig.files && sig.files.some(f => files.some(ff => ff.name === f || ff.name.endsWith(f)))) { detected.push(name); continue; }
  }
  return detected;
}

function _detectPackageManager(dir) {
  for (const [name, sig] of Object.entries(PACKAGE_MANAGERS)) {
    if (sig.lock && _exists(path.join(dir, sig.lock))) return name;
    if (sig.config && _exists(path.join(dir, sig.config))) return name;
  }
  return 'unknown';
}

function _getScripts(pkgJson) {
  return pkgJson.scripts || {};
}

function _getDependencies(pkgJson) {
  return {
    dependencies: Object.keys(pkgJson.dependencies || {}),
    devDependencies: Object.keys(pkgJson.devDependencies || {}),
    peerDependencies: Object.keys(pkgJson.peerDependencies || {}),
    total: Object.keys({ ...pkgJson.dependencies, ...pkgJson.devDependencies }).length,
  };
}

function _findImportantFiles(dir, files) {
  const important = [];
  const patterns = [
    'README.md', 'readme.md', 'README.rst',
    'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'angular.json', 'svelte.config.js',
    'webpack.config.js', 'rollup.config.js', 'esbuild.config.js',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.env', '.env.example', '.env.local',
    '.gitignore', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js',
    '.prettierrc', '.prettierrc.json',
    'jest.config.js', 'jest.config.ts', 'vitest.config.ts',
    'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js',
    'prisma/schema.prisma', 'drizzle.config.ts',
    'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle',
    'requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile',
    'Makefile', 'CMakeLists.txt',
    'src/main.ts', 'src/main.js', 'src/index.ts', 'src/index.js',
    'app/main.py', 'app.py', 'main.py', 'manage.py',
    'src/App.tsx', 'src/App.jsx', 'src/App.vue', 'src/App.svelte',
  ];
  for (const p of patterns) {
    const fullPath = path.join(dir, p);
    if (_exists(fullPath)) important.push(p);
  }
  return important;
}

function _findEntryPoints(dir, files, pkgJson, framework) {
  const entries = [];
  // From package.json
  if (pkgJson.main) entries.push(pkgJson.main);
  if (pkgJson.bin) {
    const bins = typeof pkgJson.bin === 'string' ? [pkgJson.bin] : Object.values(pkgJson.bin);
    entries.push(...bins);
  }
  if (pkgJson.scripts) {
    if (pkgJson.scripts.dev) entries.push(`[script] dev: ${pkgJson.scripts.dev}`);
    if (pkgJson.scripts.start) entries.push(`[script] start: ${pkgJson.scripts.start}`);
    if (pkgJson.scripts.build) entries.push(`[script] build: ${pkgJson.scripts.build}`);
  }
  // Framework-specific
  const srcFiles = files.filter(f => f.type === 'file' && f.path.includes('src'));
  const commonEntries = ['main.ts', 'main.js', 'index.ts', 'index.js', 'App.tsx', 'App.jsx', 'App.vue', 'App.svelte'];
  for (const ce of commonEntries) {
    const found = srcFiles.find(f => f.name === ce);
    if (found) entries.push(path.relative(dir, found.path));
  }
  return entries.slice(0, 10);
}

function _getGitInfo(dir) {
  try {
    const gitService = require('./git_service.cjs');
    if (!gitService.isGitRepo(dir)) return { isRepo: false };
    return { isRepo: true, ...gitService.detectProject(dir) };
  } catch {
    return { isRepo: false };
  }
}

function _getEnvironmentVars(dir) {
  const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
  const vars = {};
  for (const ef of envFiles) {
    const p = path.join(dir, ef);
    if (!_exists(p)) continue;
    const content = _readText(p);
    const lines = content.split('\n').filter(l => l && !l.startsWith('#'));
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
      if (match) {
        const key = match[1];
        const value = line.substring(match[0].length).trim();
        const safeValue = key.includes('SECRET') || key.includes('PASSWORD') || key.includes('TOKEN') || key.includes('KEY')
          ? '[REDACTED]'
          : value;
        vars[key] = safeValue;
      }
    }
  }
  return vars;
}

// ── Main Detection ───────────────────────────────────────────────────────────

function detectProject(dir) {
  const files = _scanDir(dir);
  const pkgJsonPath = path.join(dir, 'package.json');
  const pkgJson = _exists(pkgJsonPath) ? _readJSON(pkgJsonPath) : { dependencies: {}, devDependencies: {}, scripts: {} };
  const envContent = _readText(path.join(dir, '.env')) + '\n' + _readText(path.join(dir, '.env.local'));
  const cargoPath = path.join(dir, 'Cargo.toml');
  const goModPath = path.join(dir, 'go.mod');
  const pyProjectPath = path.join(dir, 'pyproject.toml');
  const reqPath = path.join(dir, 'requirements.txt');

  let language = _detectLanguage(dir, files);
  if (_exists(cargoPath)) language = 'rust';
  else if (_exists(goModPath)) language = 'go';
  else if (_exists(pyProjectPath) || _exists(reqPath)) language = 'python';

  const frameworks = _detectFramework(pkgJson, files);
  const databases = _detectDatabase(pkgJson, files, envContent);
  const packageManager = _detectPackageManager(dir);
  const scripts = _getScripts(pkgJson);
  const dependencies = _getDependencies(pkgJson);
  const importantFiles = _findImportantFiles(dir, files);
  const entryPoints = _findEntryPoints(dir, files, pkgJson, frameworks[0]);
  const gitInfo = _getGitInfo(dir);
  const envVars = _getEnvironmentVars(dir);

  const name = pkgJson.name || path.basename(dir);
  const version = pkgJson.version || '0.0.0';
  const description = pkgJson.description || '';

  const commands = {};
  if (scripts.dev) commands.dev = `npm run dev`;
  if (scripts.build) commands.build = `npm run build`;
  if (scripts.test) commands.test = `npm test`;
  if (scripts.lint) commands.lint = `npm run lint`;
  if (scripts.start) commands.start = `npm start`;

  return {
    name,
    version,
    description,
    path: dir,
    language,
    frameworks,
    databases,
    packageManager,
    scripts,
    dependencies,
    importantFiles,
    entryPoints,
    git: gitInfo,
    envVars,
    commands,
    fileCount: files.filter(f => f.type === 'file').length,
    directoryCount: files.filter(f => f.type === 'dir').length,
    timestamp: new Date().toISOString(),
  };
}

function getProjectState(dir) {
  const detection = detectProject(dir);
  return {
    project: detection.name,
    path: detection.path,
    stack: [...detection.frameworks, detection.language],
    runtime: {
      node: process.version,
      npm: detection.packageManager,
      database: detection.databases,
    },
    commands: detection.commands,
    git: detection.git,
    database: detection.databases,
    apis: detection.dependencies.dependencies.filter(d =>
      ['express', 'fastify', 'hono', 'koa', 'axios', 'got', 'node-fetch', 'superagent'].includes(d)
    ),
    important_files: detection.importantFiles,
    known_issues: [],
    recent_changes: [],
  };
}

module.exports = {
  detectProject,
  getProjectState,
  FRAMEWORK_SIGNATURES,
  DATABASE_SIGNATURES,
};
