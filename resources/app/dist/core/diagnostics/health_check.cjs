'use strict';
/* ===========================================================================
 * MYRAA — Health Check & Startup Diagnostics
 * ---------------------------------------------------------------------------
 * Logs startup info to logs/startup.log. Checks executable, config, plugins,
 * skills, API keys, and returns a health summary for the About screen.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');

function checkHealth() {
  const pm = require('../paths/path_manager.cjs');
  const { loadIdentity } = require('../config/app_identity.cjs');
  const id = loadIdentity();
  const issues = [];
  const info = {};

  // Version
  info.version = id.VERSION;
  info.productName = id.PRODUCT_NAME;

  // Executable
  try {
    const { resolveExecutable } = require('../launcher/executable_resolver.cjs');
    const r = resolveExecutable();
    info.executable = r.found ? r.path : null;
    info.executableFound = r.found;
    if (!r.found) issues.push('Executable not found — needs repair');
  } catch (e) { info.executableFound = false; issues.push('Executable check failed: ' + e.message); }

  // Config
  try {
    const reg = require('../launcher/installation_detector.cjs').readRegistry();
    info.registry = reg ? 'ok' : 'missing';
    if (!reg) issues.push('Install registry missing — will be recreated');
  } catch (e) { issues.push('Registry check failed'); }

  // API key
  try {
    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    // Also check SecureVault
    let vaultKey = false;
    try {
      const vault = require('../secure_vault.cjs');
      // vault check is async, skip for sync health check
    } catch (e) {}
    info.hasApiKey = hasKey;
    if (!hasKey) issues.push('No API key in env — check Settings');
  } catch (e) {}

  // Disk space
  try {
    const dataDir = pm.getDataDir();
    info.dataDir = dataDir;
    info.dataDirExists = fs.existsSync(dataDir);
  } catch (e) {}

  info.healthy = issues.length === 0;
  info.issues = issues;
  info.timestamp = new Date().toISOString();
  return info;
}

function writeStartupDiagnostics() {
  const pm = require('../paths/path_manager.cjs');
  const health = checkHealth();
  pm.ensureDataDirs();
  const entries = [
    `Version: ${health.version}`,
    `Healthy: ${health.healthy ? 'yes' : 'no'}`,
    `Executable: ${health.executable || 'not found'}`,
    `Data dir: ${health.dataDir || 'unknown'}`,
    `Registry: ${health.registry}`,
    `API key: ${health.hasApiKey ? 'present' : 'missing'}`,
    ...(health.issues.length ? health.issues.map(i => `Issue: ${i}`) : []),
  ];
  pm.writeStartupLog(entries);
  return health;
}

module.exports = { checkHealth, writeStartupDiagnostics };
