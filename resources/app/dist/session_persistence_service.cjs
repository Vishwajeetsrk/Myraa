'use strict';
/**
 * session_persistence_service.cjs — Persistent Session Storage
 * MYRAA Coding Agent — v9.0.0
 *
 * Stores code review sessions, test results, and task history to disk.
 * Uses SQLite (via memory_core_service) or JSON fallback.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSION_DIR = path.join(os.homedir(), '.myraa', 'sessions');

class SessionPersistenceService {
  constructor() {
    this.ensureDir();
    this.cache = new Map();
  }

  ensureDir() {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // ── Save Session ───────────────────────────────────────────────────────────

  saveSession(type, id, data) {
    const session = {
      id,
      type,
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const filePath = this._getFilePath(type, id);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
      this.cache.set(`${type}:${id}`, session);
      return { ok: true, path: filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Load Session ───────────────────────────────────────────────────────────

  loadSession(type, id) {
    const cacheKey = `${type}:${id}`;
    if (this.cache.has(cacheKey)) return { ok: true, session: this.cache.get(cacheKey) };

    const filePath = this._getFilePath(type, id);
    try {
      if (!fs.existsSync(filePath)) return { ok: false, error: 'Session not found' };
      const session = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.cache.set(cacheKey, session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Update Session ─────────────────────────────────────────────────────────

  updateSession(type, id, updates) {
    const result = this.loadSession(type, id);
    if (!result.ok) return result;

    const session = { ...result.session, ...updates, updatedAt: new Date().toISOString() };
    const filePath = this._getFilePath(type, id);
    try {
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
      this.cache.set(`${type}:${id}`, session);
      return { ok: true, session };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Delete Session ─────────────────────────────────────────────────────────

  deleteSession(type, id) {
    const filePath = this._getFilePath(type, id);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      this.cache.delete(`${type}:${id}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── List Sessions ──────────────────────────────────────────────────────────

  listSessions(type, opts = {}) {
    const dirPath = path.join(SESSION_DIR, type);
    try {
      if (!fs.existsSync(dirPath)) return { ok: true, sessions: [] };

      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
      const sessions = files.map(f => {
        try {
          const session = JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf-8'));
          return {
            id: session.id,
            type: session.type,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            summary: this._summarizeSession(session),
          };
        } catch { return null; }
      }).filter(Boolean);

      // Sort by updatedAt descending
      sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      if (opts.limit) return { ok: true, sessions: sessions.slice(0, opts.limit) };
      return { ok: true, sessions };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Code Review Sessions ───────────────────────────────────────────────────

  saveCodeReview(reviewId, reviewData) {
    return this.saveSession('code-review', reviewId, {
      projectPath: reviewData.projectPath,
      files: reviewData.files || [],
      issues: reviewData.issues || [],
      summary: reviewData.summary,
      score: reviewData.score,
      lint: reviewData.lint,
    });
  }

  loadCodeReview(reviewId) {
    return this.loadSession('code-review', reviewId);
  }

  // ── Test Result Sessions ───────────────────────────────────────────────────

  saveTestResult(testId, testData) {
    return this.saveSession('test-result', testId, {
      projectPath: testData.projectPath,
      framework: testData.framework,
      passed: testData.passed,
      failed: testData.failed,
      skipped: testData.skipped,
      duration: testData.duration,
      output: testData.output,
      tests: testData.tests || [],
    });
  }

  loadTestResult(testId) {
    return this.loadSession('test-result', testId);
  }

  // ── Task History ───────────────────────────────────────────────────────────

  saveTaskHistory(taskId, taskData) {
    return this.saveSession('task-history', taskId, {
      intent: taskData.intent,
      projectPath: taskData.projectPath,
      actions: taskData.actions || [],
      result: taskData.result,
      duration: taskData.duration,
      success: taskData.success,
    });
  }

  loadTaskHistory(taskId) {
    return this.loadSession('task-history', taskId);
  }

  // ── Project Snapshots ──────────────────────────────────────────────────────

  saveProjectSnapshot(projectPath, snapshotData) {
    const projectId = projectPath.replace(/[\/\\:]/g, '_');
    return this.saveSession('project-snapshot', projectId, {
      projectPath,
      detection: snapshotData.detection,
      git: snapshotData.git,
      files: snapshotData.files || [],
      lastCommit: snapshotData.lastCommit,
    });
  }

  loadProjectSnapshot(projectPath) {
    const projectId = projectPath.replace(/[\/\\:]/g, '_');
    return this.loadSession('project-snapshot', projectId);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  cleanupOldSessions(type, maxAgeDays = 30) {
    const dirPath = path.join(SESSION_DIR, type);
    if (!fs.existsSync(dirPath)) return { ok: true, deleted: 0 };

    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let deleted = 0;

    try {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const filePath = path.join(dirPath, f);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
      return { ok: true, deleted };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _getFilePath(type, id) {
    const safeId = id.replace(/[\/\\:*?"<>|]/g, '_');
    return path.join(SESSION_DIR, type, `${safeId}.json`);
  }

  _summarizeSession(session) {
    const data = session.data || {};
    if (data.summary) return data.summary;
    if (data.files) return `${data.files.length} files reviewed`;
    if (data.passed !== undefined) return `${data.passed} passed, ${data.failed} failed`;
    if (data.intent) return data.intent;
    return 'No summary';
  }
}

module.exports = new SessionPersistenceService();
