/**
 * =============================================================================
 * MYRAA AI OS — Project Index Service (v2.0 APEX)
 * =============================================================================
 * Prevents duplicate project folders by checking MemoryCore project_index before mkdir.
 * Recalls and opens projects by name directly.
 *  - getAllProjects()                              -> list of indexed projects
 *  - findProject(nameOrDesc)                       -> existing entry or null
 *  - registerProject({ name, description, dir })   -> upsert to SQLite project_index
 *  - resolveProjectDir(name, desc, baseDir)        -> existing or new path
 *  - openProject(nameOrDesc)                       -> launches Explorer / default editor
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');
const memoryCore = require('./memory_core_service.cjs');

const CATEGORY = 'project';

function _normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function _similarity(a, b) {
  const na = _normalize(a), nb = _normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = new Set(na.split(' ')), wordsB = nb.split(' ');
  const shared = wordsB.filter(w => wordsA.has(w)).length;
  return shared / Math.max(wordsA.size, wordsB.length);
}

const ProjectIndexService = {

  getAllProjects() {
    const sqliteProjects = memoryCore.listProjects() || [];
    const legacyMemories = memoryCore.getAll(CATEGORY) || [];
    
    const map = new Map();
    sqliteProjects.forEach(p => {
      map.set(p.name.toLowerCase(), {
        name: p.name,
        description: p.description,
        projectDir: p.projectDir,
        toolchain: p.toolchain,
        registeredAt: p.registeredAt
      });
    });

    legacyMemories.forEach(m => {
      const meta = m.metadata || {};
      const name = meta.name || m.key || '';
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), {
          name,
          description: meta.description || m.text || '',
          projectDir: meta.projectDir || '',
          toolchain: meta.toolchain || 'unknown',
          registeredAt: meta.registeredAt || m.createdAt
        });
      }
    });

    return Array.from(map.values());
  },

  findProject(nameOrDesc) {
    if (!nameOrDesc) return null;
    const cleanQuery = String(nameOrDesc).trim().toLowerCase();
    
    // 1. Exact lookup from SQLite table
    const direct = memoryCore.getProject(cleanQuery);
    if (direct) return direct;

    const projects = this.getAllProjects();
    if (!projects.length) return null;

    // 2. Exact match in full project list
    const exact = projects.find(p => p.name.toLowerCase() === cleanQuery);
    if (exact) return exact;

    // 3. Substring match
    const sub = projects.find(p => 
      p.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(p.name.toLowerCase())
    );
    if (sub) return sub;

    // 4. Fuzzy similarity
    const THRESHOLD = 0.65;
    let best = null, bestScore = 0;
    for (const p of projects) {
      const nameScore = _similarity(cleanQuery, p.name);
      const descScore = _similarity(cleanQuery, p.description);
      const score = Math.max(nameScore, descScore);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= THRESHOLD ? best : null;
  },

  registerProject({ name, description, projectDir, toolchain }) {
    if (!name) throw new Error('Project name is required');
    const safeName = name.trim();
    const dir = projectDir ? path.resolve(projectDir) : '';

    // Save to SQLite project_index table
    memoryCore.saveProject({
      name: safeName,
      description: description || '',
      projectDir: dir,
      toolchain: toolchain || 'unknown'
    });

    // Also persist into memoryCore memories.json for backwards-compatibility
    const key = 'project_' + _normalize(safeName).replace(/\s+/g, '_');
    memoryCore.save({
      key,
      category: CATEGORY,
      text: description || safeName,
      metadata: { name: safeName, description: description || '', projectDir: dir, toolchain, registeredAt: new Date().toISOString() }
    });

    return { ok: true, name: safeName, projectDir: dir };
  },

  resolveProjectDir(name, description, baseDir = 'C:\\Users\\Vishwajeet\\Projects') {
    const existing = this.findProject(name || description);
    if (existing && existing.projectDir) {
      if (fs.existsSync(existing.projectDir)) {
        return { projectDir: existing.projectDir, isNew: false, matchedProject: existing.name };
      }
    }

    // Create new project directory
    const safeName = (name || 'Project_' + Date.now()).replace(/[^a-zA-Z0-9_\-. ]/g, '_').slice(0, 60);
    const newDir = path.join(baseDir, safeName);
    if (!fs.existsSync(newDir)) {
      try { fs.mkdirSync(newDir, { recursive: true }); } catch(e) {}
    }
    this.registerProject({ name: safeName, description, projectDir: newDir });
    return { projectDir: newDir, isNew: true, matchedProject: null };
  },

  openProject(nameOrDesc) {
    const match = this.findProject(nameOrDesc);
    if (!match) {
      return { ok: false, error: `Project '${nameOrDesc}' not found in project_index.` };
    }
    let pdir = match.projectDir;
    if (!pdir || !fs.existsSync(pdir)) {
      const candidates = [
        'D:\\Team of Vishwajeet',
        'C:\\Users\\Vishwajeet\\Downloads\\Jarvis\\Automated-Agentic-AI-Web-Agency\\Automated-Agentic-AI-Web-Agency-main',
        'C:\\Users\\Vishwajeet\\Projects\\' + match.name
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          pdir = cand;
          match.projectDir = cand;
          this.registerProject(match);
          break;
        }
      }
      if (!pdir || !fs.existsSync(pdir)) {
        pdir = pdir || ('C:\\Users\\Vishwajeet\\Projects\\' + match.name);
        try { fs.mkdirSync(pdir, { recursive: true }); } catch(e) {}
      }
    }

    // Open via explorer
    try {
      exec(`explorer.exe "${pdir}"`, () => {});
      return {
        ok: true,
        project: { ...match, projectDir: pdir },
        message: `Opened project '${match.name}' directly at ${pdir}`
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};

module.exports = ProjectIndexService;
