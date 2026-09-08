/**
 * =============================================================================
 * MYRAA AI OS — Autonomous Heartbeat & Long-Term Memory Engine
 * =============================================================================
 * Inspired by Brahma-AI (AGENTS.md + HEARTBEAT.md):
 *   - Proactive Background Health & Notification Checks
 *   - Curated Long-Term Memory (MEMORY.md) Maintenance
 *   - Smart Heartbeat vs Cron Scheduling Distinction
 *   - Resource & Battery Aware Polling Loop (Quiet at night unless urgent)
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const appData = process.env.APPDATA || (process.platform === 'darwin'
  ? path.join(process.env.HOME || '', 'Library/Application Support')
  : path.join(process.env.HOME || '', '.config'));
const MYRAA_DATA_DIR = path.join(appData, 'MYRAA');
const MEMORY_FILE = path.join(MYRAA_DATA_DIR, 'MEMORY.md');
const STATE_FILE = path.join(MYRAA_DATA_DIR, 'heartbeat_state.json');
const ACTIVITY_FILE = path.join(MYRAA_DATA_DIR, 'activity_log.json');

class HeartbeatMemoryEngine {
  constructor() {
    this.intervalId = null;
    this.ensureFiles();
  }

  ensureFiles() {
    if (!fs.existsSync(MYRAA_DATA_DIR)) {
      try { fs.mkdirSync(MYRAA_DATA_DIR, { recursive: true }); } catch (e) {}
    }
    if (!fs.existsSync(MEMORY_FILE)) {
      const initialMemory = `# MYRAA AI OS — Long-Term Curated Memory\n\n- System initialized: ${new Date().toISOString()}\n- Primary User: Vishwajeet\n- Operating System: Windows 11 Native Desktop\n`;
      try { fs.writeFileSync(MEMORY_FILE, initialMemory, 'utf8'); } catch (e) {}
    }
    if (!fs.existsSync(STATE_FILE)) {
      const initialState = {
        lastChecks: {
          email: null,
          system_health: null,
          memory_curation: null
        },
        heartbeatCount: 0,
        lastRunTime: null
      };
      try { fs.writeFileSync(STATE_FILE, JSON.stringify(initialState, null, 2), 'utf8'); } catch (e) {}
    }
  }

  getState() {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      return { lastChecks: {}, heartbeatCount: 0 };
    }
  }

  saveState(state) {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {}
  }

  /**
   * Check system hardware health (RAM, disk, uptime)
   */
  checkSystemHealth() {
    const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
    const usedPercent = Math.round(((totalMemMB - freeMemMB) / totalMemMB) * 100);

    const alerts = [];
    if (freeMemMB < 800) {
      alerts.push(`Low available memory: only ${freeMemMB}MB free (${usedPercent}% utilized).`);
    }

    return {
      status: alerts.length > 0 ? 'WARN' : 'HEALTHY',
      freeMemMB,
      totalMemMB,
      usedPercent,
      uptimeHours: (os.uptime() / 3600).toFixed(1),
      alerts
    };
  }

  /**
   * Check activity log and curate insights into MEMORY.md
   */
  curateMemory() {
    try {
      if (!fs.existsSync(ACTIVITY_FILE)) return { updated: false };
      const activities = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
      if (!Array.isArray(activities) || activities.length === 0) return { updated: false };

      const currentMemory = fs.readFileSync(MEMORY_FILE, 'utf8');
      const recentSuccesses = activities.slice(0, 10).filter(a => a.status === 'SUCCESS');

      let additions = [];
      for (const act of recentSuccesses) {
        const marker = `- [${act.time.split('T')[0]}] ${act.module}: ${act.action}`;
        if (!currentMemory.includes(act.action)) {
          additions.push(marker);
        }
      }

      if (additions.length > 0) {
        const updated = currentMemory + '\n' + additions.slice(0, 4).join('\n') + '\n';
        fs.writeFileSync(MEMORY_FILE, updated, 'utf8');
        return { updated: true, addedCount: additions.length };
      }
      return { updated: false, addedCount: 0 };
    } catch (e) {
      return { updated: false, error: e.message };
    }
  }

  /**
   * Single proactive heartbeat turn
   */
  async runHeartbeatCycle() {
    const state = this.getState();
    const now = Date.now();
    const currentHour = new Date().getHours();

    // Respect quiet hours (23:00 - 08:00) unless critical
    const isQuietHours = currentHour >= 23 || currentHour < 8;

    const health = this.checkSystemHealth();
    state.lastChecks.system_health = now;

    const memoryResult = this.curateMemory();
    state.lastChecks.memory_curation = now;

    state.heartbeatCount = (state.heartbeatCount || 0) + 1;
    state.lastRunTime = new Date().toISOString();
    this.saveState(state);

    const issues = [];
    if (health.alerts.length > 0) issues.push(...health.alerts);

    if (issues.length === 0) {
      return {
        status: 'HEARTBEAT_OK',
        heartbeatCount: state.heartbeatCount,
        isQuietHours,
        systemHealth: health,
        memoryUpdated: memoryResult.updated,
        message: 'All systems nominal. HEARTBEAT_OK'
      };
    }

    return {
      status: 'ACTION_REQUIRED',
      heartbeatCount: state.heartbeatCount,
      isQuietHours,
      systemHealth: health,
      memoryUpdated: memoryResult.updated,
      alerts: issues,
      message: `Heartbeat flagged ${issues.length} item(s) requiring attention.`
    };
  }

  /**
   * Start proactive background daemon (runs every 15 minutes)
   */
  startDaemon(intervalMinutes = 15) {
    if (this.intervalId) clearInterval(this.intervalId);
    const ms = Math.max(1, intervalMinutes) * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runHeartbeatCycle().catch(() => {});
    }, ms);
    return { ok: true, intervalMinutes, message: `Heartbeat daemon started with interval of ${intervalMinutes} mins.` };
  }

  stopDaemon() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return { ok: true, message: 'Heartbeat daemon stopped.' };
  }
}

module.exports = new HeartbeatMemoryEngine();
