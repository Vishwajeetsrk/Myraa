/**
 * =============================================================================
 * MYRAA AI OS — Code Review Engine (v1.0)
 * =============================================================================
 * Session-scoped, file-by-file code reviewer:
 *  - detectToolchain()   : reads project manifest files, returns stack + linter
 *  - enumerateFiles()    : git ls-files / dir walk, skipping build artifacts
 *  - reviewFile()        : runs language linter, tracks file status per session
 *  - applyPatch()        : read -> targeted line-range replace -> write -> diff
 * NEVER rewrites a whole file. Every patch produces a verifiable unified diff.
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const terminalRunner = require('./terminal_runner.cjs');

const TOOLCHAIN_MANIFESTS = [
  { file: 'package.json',     name: 'javascript/typescript', lintCmd: 'npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=50',  testCmd: 'npm test -- --passWithNoTests', exts: ['.js','.jsx','.ts','.tsx','.mjs','.cjs'] },
  { file: 'requirements.txt', name: 'python',                lintCmd: 'python -m flake8 . --max-line-length=120',                testCmd: 'python -m pytest --tb=short',   exts: ['.py'] },
  { file: 'pyproject.toml',   name: 'python',                lintCmd: 'python -m flake8 . --max-line-length=120',                testCmd: 'python -m pytest --tb=short',   exts: ['.py'] },
  { file: 'Cargo.toml',       name: 'rust',                  lintCmd: 'cargo clippy -- -D warnings',                             testCmd: 'cargo test',                    exts: ['.rs'] },
  { file: 'go.mod',           name: 'go',                    lintCmd: 'golangci-lint run ./...',                                 testCmd: 'go test ./...',                 exts: ['.go'] },
  { file: 'pom.xml',          name: 'java/maven',            lintCmd: 'mvn checkstyle:check -q',                                 testCmd: 'mvn test -q',                   exts: ['.java'] },
  { file: 'build.gradle',     name: 'java/gradle',           lintCmd: 'gradle checkstyleMain -q',                               testCmd: 'gradle test -q',                exts: ['.java','.kt'] },
  { file: 'Gemfile',          name: 'ruby',                  lintCmd: 'bundle exec rubocop --no-color',                         testCmd: 'bundle exec rspec',             exts: ['.rb'] },
  { file: 'composer.json',    name: 'php',                   lintCmd: 'vendor/bin/phpcs --standard=PSR12',                      testCmd: 'vendor/bin/phpunit',            exts: ['.php'] },
];

const SKIP_DIRS = new Set(['node_modules','.git','dist','build','out','target','.cache','__pycache__','.venv','venv','.next','.nuxt','coverage','.pytest_cache','vendor','bin','obj','.gradle','.idea','.vscode']);
const SKIP_EXTS = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.svg','.woff','.woff2','.ttf','.eot','.mp4','.mp3','.wav','.pdf','.zip','.tar','.gz','.exe','.dll','.so','.dylib','.map','.db','.sqlite']);

const sessions = new Map();

class CodeReviewEngine {

  detectToolchain(projectDir) {
    if (!projectDir || !fs.existsSync(projectDir)) return { name: 'unknown', lintCmd: null, testCmd: null, exts: [] };
    const entries = fs.readdirSync(projectDir);
    for (const m of TOOLCHAIN_MANIFESTS) {
      if (m.file.startsWith('*')) {
        const ext = m.file.slice(1);
        if (entries.some(e => e.endsWith(ext))) return { ...m, projectDir };
      } else if (entries.includes(m.file)) {
        const result = { ...m, projectDir };
        if (m.name === 'javascript/typescript') {
          const hasEslint = ['.eslintrc','.eslintrc.js','.eslintrc.json','eslint.config.js','eslint.config.mjs'].some(f => fs.existsSync(path.join(projectDir, f)));
          if (!hasEslint) result.lintCmd = null;
        }
        return result;
      }
    }
    const extCounts = {};
    this._walkDir(projectDir, fp => { const e = path.extname(fp); if (e) extCounts[e] = (extCounts[e]||0)+1; }, 2);
    const dominant = Object.entries(extCounts).sort((a,b) => b[1]-a[1])[0];
    if (dominant) { const match = TOOLCHAIN_MANIFESTS.find(m => m.exts.includes(dominant[0])); if (match) return { ...match, projectDir }; }
    return { name: 'unknown', lintCmd: null, testCmd: null, exts: [], projectDir };
  }

  enumerateFiles(projectDir) {
    if (!projectDir || !fs.existsSync(projectDir)) return { ok: false, files: [], error: 'Project directory not found' };
    const absRoot = path.resolve(projectDir);
    let files = [];
    try {
      const gitOut = execSync('git ls-files', { cwd: absRoot, timeout: 10000, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
      files = gitOut.trim().split('\n').filter(f => f.trim()).map(f => path.resolve(absRoot, f)).filter(f => !this._shouldSkipFile(f, absRoot));
    } catch (_) {
      // git not available — walk the directory tree directly
      this._walkDir(absRoot, fp => { if (!this._shouldSkipFile(fp, absRoot)) files.push(fp); });
    }
    return { ok: true, files, count: files.length };
  }

  _shouldSkipFile(fp, projectRoot) {
    // Only check path segments that are CHILDREN of the project root
    const absRoot = projectRoot ? path.resolve(projectRoot) : null;
    const rel = absRoot ? path.relative(absRoot, fp) : fp;
    // Split the *relative* path — so root dir segments are not tested
    const relParts = rel.split(/[\\/]/);
    // Skip any file whose relative path passes through a SKIP_DIRS segment
    // (only interior segments, not the filename itself)
    const dirParts = relParts.slice(0, -1);
    if (dirParts.some(p => SKIP_DIRS.has(p))) return true;
    const ext = path.extname(fp).toLowerCase();
    if (SKIP_EXTS.has(ext)) return true;
    const base = path.basename(fp);
    if (base.includes('.min.') || base.endsWith('.bak') || base.endsWith('.backup') || base.includes('.backup_')) return true;
    return false;
  }

  _walkDir(dir, cb, maxDepth=50, depth=0) {
    if (depth > maxDepth) return;
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(_) { return; }
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Skip known build/vendor dirs that are children of any dir
        if (SKIP_DIRS.has(e.name)) continue;
        this._walkDir(fp, cb, maxDepth, depth+1);
      } else if (e.isFile()) {
        cb(fp);
      }
    }
  }

  startSession(projectDir) {
    const { files, ok, error } = this.enumerateFiles(projectDir);
    if (!ok) return { ok: false, error };
    const toolchain = this.detectToolchain(projectDir);
    const sessionId = 'rev_' + crypto.randomBytes(6).toString('hex');
    const fileMap = new Map();
    for (const f of files) fileMap.set(f, 'pending');
    sessions.set(sessionId, { sessionId, projectDir, toolchain, files: fileMap, startedAt: new Date().toISOString() });
    return { ok: true, sessionId, fileCount: files.length, toolchain: toolchain.name, lintCmd: toolchain.lintCmd, files: files.map(f => ({ path: f, status: 'pending' })) };
  }

  getSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return null;
    const fileSummary = [];
    for (const [fp, status] of s.files) fileSummary.push({ path: fp, status });
    const counts = { pending:0, clean:0, flagged:0, fixed:0 };
    for (const { status } of fileSummary) { if (counts[status] !== undefined) counts[status]++; }
    return { sessionId, projectDir: s.projectDir, toolchain: s.toolchain.name, files: fileSummary, counts, startedAt: s.startedAt };
  }

  getSummary(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return null;
    const counts = { pending:0, clean:0, flagged:0, fixed:0, total: s.files.size };
    for (const status of s.files.values()) { if (counts[status] !== undefined) counts[status]++; }
    const progress = ((counts.clean + counts.flagged + counts.fixed) / counts.total * 100).toFixed(1);
    return { sessionId, toolchain: s.toolchain.name, counts, progressPercent: parseFloat(progress) };
  }

  async reviewFile(sessionId, filePath) {
    const s = sessions.get(sessionId);
    if (!s) return { ok: false, error: 'Session not found' };
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(s.projectDir, filePath);
    const currentStatus = s.files.get(absPath);
    if (currentStatus === 'clean' || currentStatus === 'fixed') {
      return { ok: true, filePath: absPath, status: currentStatus, skipped: true, reason: 'Already reviewed and clean in this session' };
    }
    if (!fs.existsSync(absPath)) { s.files.set(absPath, 'flagged'); return { ok: false, error: `File not found: ${absPath}` }; }
    const ext = path.extname(absPath).toLowerCase();
    const content = fs.readFileSync(absPath, 'utf8');
    const findings = [];

    if (['.js','.cjs','.mjs'].includes(ext)) {
      try { execSync(`node --check "${absPath}"`, { stdio: 'pipe', timeout: 5000 }); }
      catch (e) { findings.push({ type: 'SYNTAX_ERROR', severity: 'error', detail: (e.stderr||'').toString().trim() || e.message }); }
    }
    if (ext === '.py') {
      try {
        const res = execSync(`python -m py_compile "${absPath}" 2>&1`, { encoding: 'utf8', timeout: 5000 });
        if (res && res.trim()) findings.push({ type: 'PYTHON_SYNTAX', severity: 'error', detail: res.trim() });
      } catch(e) { findings.push({ type: 'PYTHON_SYNTAX', severity: 'error', detail: (e.stdout||e.message||'').toString().trim() }); }
    }

    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const ln = i + 1;
      if (['.js','.ts','.jsx','.tsx','.cjs','.mjs'].includes(ext) && /console\.log\(/.test(line) && !/\/\/\s*debug/i.test(line))
        findings.push({ type: 'DEBUG_LOG', severity: 'warning', line: ln, detail: 'console.log() left in production code', snippet: line.trim().slice(0, 120) });
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line))
        findings.push({ type: 'UNRESOLVED_TODO', severity: 'info', line: ln, detail: 'Unresolved TODO/FIXME', snippet: line.trim().slice(0, 120) });
      if (line.length > 200)
        findings.push({ type: 'LONG_LINE', severity: 'warning', line: ln, detail: `Line exceeds 200 characters (${line.length})` });
    });

    if (s.toolchain.lintCmd) {
      try {
        let fileLintCmd = null;
        const n = s.toolchain.name;
        const q = `"${absPath}"`;
        if (n === 'javascript/typescript') fileLintCmd = `npx eslint ${q} --max-warnings=20 --format compact`;
        else if (n === 'python') fileLintCmd = `python -m flake8 ${q} --max-line-length=120`;
        else if (n === 'go') fileLintCmd = `go vet ${q}`;
        if (fileLintCmd) {
          const lr = await terminalRunner.execute(fileLintCmd, { cwd: s.projectDir, timeoutMs: 30000 });
          if (!lr.ok && (lr.stdout || lr.stderr)) {
            findings.push({ type: 'LINTER', severity: 'warning', detail: (lr.stdout + '\n' + lr.stderr).trim().slice(0, 1000) });
          }
        }
      } catch(_) {}
    }

    const status = findings.length === 0 ? 'clean' : 'flagged';
    s.files.set(absPath, status);
    return { ok: true, filePath: absPath, status, lineCount: lines.length, findingCount: findings.length, findings };
  }

  applyPatch(sessionId, filePath, { targetContent, replacement, startLine, endLine }) {
    const s = sessions.get(sessionId);
    if (!s) return { ok: false, error: 'Session not found' };
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(s.projectDir, filePath);
    if (!fs.existsSync(absPath)) return { ok: false, error: `File not found: ${absPath}` };

    const originalContent = fs.readFileSync(absPath, 'utf8');
    const lines = originalContent.split('\n');
    const sl = (startLine || 1) - 1;
    const el = (endLine || lines.length) - 1;
    if (sl < 0 || el >= lines.length || sl > el)
      return { ok: false, error: `Invalid line range ${startLine}-${endLine} for file with ${lines.length} lines` };

    const rangeText = lines.slice(sl, el + 1).join('\n');
    if (targetContent && !rangeText.includes(targetContent))
      return { ok: false, error: `Target content not found in lines ${startLine}-${endLine}. Range:\n${rangeText.slice(0,300)}` };

    let newContent;
    if (targetContent) {
      const newRange = rangeText.replace(targetContent, replacement);
      newContent = [...lines.slice(0, sl), ...newRange.split('\n'), ...lines.slice(el + 1)].join('\n');
    } else {
      newContent = [...lines.slice(0, sl), ...replacement.split('\n'), ...lines.slice(el + 1)].join('\n');
    }

    const diff = this._generateUnifiedDiff(absPath, originalContent, newContent);
    fs.writeFileSync(absPath + '.myraa_patch_backup', originalContent, 'utf8');
    fs.writeFileSync(absPath, newContent, 'utf8');
    s.files.set(absPath, 'fixed');
    return { ok: true, filePath: absPath, linesChanged: this._countChangedLines(diff), diff, message: `Patch applied. ${this._countChangedLines(diff)} line(s) changed.` };
  }

  _generateUnifiedDiff(filePath, before, after) {
    const bl = before.split('\n'), al = after.split('\n');
    const name = path.basename(filePath);
    const out = [`--- a/${name}`, `+++ b/${name}`];
    const maxLen = Math.max(bl.length, al.length);
    let i = 0;
    while (i < maxLen) {
      if (bl[i] !== al[i]) {
        let j = i;
        while (j < maxLen && bl[j] !== al[j]) j++;
        const ctx = 2, cs = Math.max(0, i-ctx), ce = Math.min(maxLen-1, j+ctx);
        out.push(`@@ -${cs+1},${ce-cs+1} +${cs+1},${ce-cs+1} @@`);
        for (let k = cs; k <= ce; k++) {
          if (k < i || k >= j) { if (bl[k] !== undefined) out.push(' '+(bl[k]||'')); }
          else { if (bl[k] !== undefined) out.push('-'+(bl[k]||'')); if (al[k] !== undefined) out.push('+'+(al[k]||'')); }
        }
        i = j;
      } else { i++; }
    }
    return out.join('\n');
  }

  _countChangedLines(diff) {
    return diff.split('\n').filter(l => (l.startsWith('+')||l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---')).length;
  }
}

const codeReviewEngine = new CodeReviewEngine();
module.exports = codeReviewEngine;
