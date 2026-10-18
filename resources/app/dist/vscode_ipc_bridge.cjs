'use strict';
/**
 * vscode_ipc_bridge.cjs — VS Code Integration Bridge
 * MYRAA Coding Agent — v9.0.0
 *
 * Provides real VS Code integration:
 * - Detect active workspace
 * - Detect active file
 * - Read/write files
 * - Run terminal commands
 * - Detect errors in problems panel
 * - Open files/folders
 * - Search project
 * - Use VS Code CLI
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class VSCodeIPCBridge {
  constructor() {
    this.vscodePath = null;
    this.cliPath = null;
    this._detectVSCode();
  }

  _detectVSCode() {
    const candidates = [
      'code',
      path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
      'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
      '/usr/bin/code',
      '/usr/local/bin/code',
    ];
    for (const c of candidates) {
      try {
        execSync(`"${c}" --version`, { timeout: 5000, stdio: 'pipe' });
        this.cliPath = c;
        return true;
      } catch {}
    }
    return false;
  }

  // ── VS Code CLI Operations ─────────────────────────────────────────────────

  openFolder(folderPath) {
    if (!this.cliPath) return { ok: false, error: 'VS Code not found' };
    try {
      spawn(this.cliPath, [folderPath], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, message: `Opened ${folderPath} in VS Code` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  openFile(filePath, line = null, column = null) {
    if (!this.cliPath) return { ok: false, error: 'VS Code not found' };
    try {
      const args = [filePath];
      if (line) args.push(`-g${line}${column ? ':' + column : ''}`);
      spawn(this.cliPath, args, { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, message: `Opened ${filePath}${line ? ` at line ${line}` : ''}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  openWorkspace(workspacePath) {
    if (!this.cliPath) return { ok: false, error: 'VS Code not found' };
    try {
      spawn(this.cliPath, ['-n', workspacePath], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, message: `Opened workspace ${workspacePath}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Active Workspace Detection ─────────────────────────────────────────────

  getActiveWorkspace() {
    // Try to find VS Code process and detect workspace
    try {
      const result = execSync('tasklist /FI "IMAGENAME eq Code.exe" /FO CSV /NH', { encoding: 'utf-8', timeout: 5000 });
      if (!result.includes('Code.exe')) return { ok: false, error: 'VS Code not running' };
    } catch {
      return { ok: false, error: 'Could not detect VS Code' };
    }

    // Try to read workspace from VS Code state files
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const vscodeDir = path.join(appData, 'Code', 'User', 'workspaceStorage');

    if (fs.existsSync(vscodeDir)) {
      try {
        const workspaces = fs.readdirSync(vscodeDir);
        for (const ws of workspaces) {
          const wsFile = path.join(vscodeDir, ws, 'workspace.json');
          if (fs.existsSync(wsFile)) {
            const data = JSON.parse(fs.readFileSync(wsFile, 'utf-8'));
            if (data.folder) {
              const folderPath = data.folder.startsWith('file:///') ? decodeURIComponent(data.folder.replace('file:///', '')) : data.folder;
              if (fs.existsSync(folderPath)) {
                return { ok: true, workspace: folderPath, name: path.basename(folderPath) };
              }
            }
          }
        }
      } catch {}
    }

    return { ok: false, error: 'Could not detect active workspace' };
  }

  // ── Active File Detection ──────────────────────────────────────────────────

  getActiveFile() {
    // Try to detect active file from clipboard or VS Code state
    try {
      const clipboard = execSync('powershell -command "Get-Clipboard"', { encoding: 'utf-8', timeout: 3000 }).trim();
      if (clipboard && fs.existsSync(clipboard)) {
        return { ok: true, file: clipboard };
      }
    } catch {}

    // Try to detect from recent files
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const stateFile = path.join(appData, 'Code', 'User', 'globalStorage', 'state.vscdb');

    if (fs.existsSync(stateFile)) {
      return { ok: false, error: 'State database detected but not parsed (SQLite)' };
    }

    return { ok: false, error: 'Could not detect active file' };
  }

  // ── File Operations ────────────────────────────────────────────────────────

  readFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { ok: true, content, path: filePath, size: content.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  writeFile(filePath, content) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      return { ok: true, message: `Written ${filePath}`, size: content.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  editFile(filePath, oldContent, newContent) {
    try {
      const current = fs.readFileSync(filePath, 'utf-8');
      if (!current.includes(oldContent)) {
        return { ok: false, error: 'Old content not found in file' };
      }
      const updated = current.replace(oldContent, newContent);
      fs.writeFileSync(filePath, updated, 'utf-8');
      return { ok: true, message: `Edited ${filePath}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  createFile(filePath, content) {
    return this.writeFile(filePath, content);
  }

  deleteFile(filePath) {
    try {
      fs.unlinkSync(filePath);
      return { ok: true, message: `Deleted ${filePath}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  renameFile(oldPath, newPath) {
    try {
      fs.renameSync(oldPath, newPath);
      return { ok: true, message: `Renamed ${oldPath} → ${newPath}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  listFiles(dirPath, maxDepth = 3) {
    const results = [];
    const _scan = (dir, depth) => {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
          const fullPath = path.join(dir, e.name);
          if (e.isDirectory()) {
            results.push({ type: 'dir', name: e.name, path: path.relative(dirPath, fullPath) });
            _scan(fullPath, depth + 1);
          } else {
            results.push({ type: 'file', name: e.name, path: path.relative(dirPath, fullPath) });
          }
        }
      } catch {}
    };
    _scan(dirPath, 0);
    return { ok: true, files: results, count: results.length };
  }

  // ── Search Operations ──────────────────────────────────────────────────────

  searchFiles(dirPath, query, maxResults = 50) {
    const results = [];
    const _scan = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
          const fullPath = path.join(dir, e.name);
          if (e.isDirectory()) {
            _scan(fullPath);
          } else {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                  results.push({
                    file: path.relative(dirPath, fullPath),
                    line: i + 1,
                    content: lines[i].trim().substring(0, 200),
                  });
                  if (results.length >= maxResults) return;
                }
              }
            } catch {}
          }
        }
      } catch {}
    };
    _scan(dirPath);
    return { ok: true, results, count: results.length, query };
  }

  // ── Terminal Operations ────────────────────────────────────────────────────

  runTerminalCommand(command, cwd) {
    try {
      const stdout = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { ok: true, output: stdout, command };
    } catch (err) {
      return {
        ok: false,
        output: (err.stdout || '') + '\n' + (err.stderr || ''),
        error: err.message,
        exitCode: err.status || 1,
        command,
      };
    }
  }

  // ── Project Info ───────────────────────────────────────────────────────────

  getProjectInfo(dirPath) {
    const info = { path: dirPath, name: path.basename(dirPath) };
    const pkgJsonPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        info.name = pkg.name || info.name;
        info.version = pkg.version;
        info.description = pkg.description;
        info.scripts = pkg.scripts;
        info.dependencies = Object.keys(pkg.dependencies || {});
        info.devDependencies = Object.keys(pkg.devDependencies || {});
      } catch {}
    }

    // Detect framework
    const frameworks = [];
    const allDeps = [...(info.dependencies || []), ...(info.devDependencies || [])];
    if (allDeps.includes('react')) frameworks.push('React');
    if (allDeps.includes('next')) frameworks.push('Next.js');
    if (allDeps.includes('vue')) frameworks.push('Vue');
    if (allDeps.includes('@angular/core')) frameworks.push('Angular');
    if (allDeps.includes('svelte')) frameworks.push('Svelte');
    if (allDeps.includes('express')) frameworks.push('Express');
    if (allDeps.includes('fastify')) frameworks.push('Fastify');
    if (allDeps.includes('electron')) frameworks.push('Electron');
    if (allDeps.includes('tauri')) frameworks.push('Tauri');
    info.frameworks = frameworks;

    // Detect language
    const extCounts = {};
    const _countExts = (dir, depth = 0) => {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.git') continue;
          const fullPath = path.join(dir, e.name);
          if (e.isDirectory()) _countExts(fullPath, depth + 1);
          else {
            const ext = path.extname(e.name).toLowerCase();
            extCounts[ext] = (extCounts[ext] || 0) + 1;
          }
        }
      } catch {}
    };
    _countExts(dirPath);

    const extLangMap = { '.js': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.jsx': 'JavaScript', '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java' };
    const langCounts = {};
    for (const [ext, count] of Object.entries(extCounts)) {
      if (extLangMap[ext]) langCounts[extLangMap[ext]] = (langCounts[extLangMap[ext]] || 0) + count;
    }
    info.languages = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).map(([lang]) => lang);

    return { ok: true, ...info };
  }

  // ── Git Integration ────────────────────────────────────────────────────────

  getGitStatus(dirPath) {
    try {
      const status = execSync('git status --porcelain -b', { cwd: dirPath, encoding: 'utf-8', timeout: 5000 });
      const lines = status.split('\n');
      const header = lines[0] || '';
      const branchMatch = header.match(/^## (.+?)(?:\.\.\.(.+))?$/);
      const changes = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].length >= 3) {
          changes.push({ status: lines[i].substring(0, 2), file: lines[i].substring(3) });
        }
      }
      return {
        ok: true,
        branch: branchMatch?.[1] || 'unknown',
        remote: branchMatch?.[2] || null,
        clean: changes.length === 0,
        changes,
      };
    } catch {
      return { ok: false, error: 'Not a git repository' };
    }
  }

  getGitLog(dirPath, count = 10) {
    try {
      const log = execSync(`git log -${count} --pretty=format:"%h|%an|%ai|%s"`, { cwd: dirPath, encoding: 'utf-8', timeout: 5000 });
      const commits = log.split('\n').filter(Boolean).map(line => {
        const [hash, author, date, ...messageParts] = line.split('|');
        return { hash, author, date, message: messageParts.join('|') };
      });
      return { ok: true, commits };
    } catch {
      return { ok: false, error: 'Not a git repository' };
    }
  }
}

module.exports = new VSCodeIPCBridge();
