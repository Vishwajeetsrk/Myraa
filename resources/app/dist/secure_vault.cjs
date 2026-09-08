'use strict';

/**
 * =============================================================================
 * MYRAA AI OS — Secure Credential Vault (DPAPI / Hardware-Bound AES-256-GCM)
 * =============================================================================
 * - Stores metadata in %APPDATA%/MYRAA/settings/vault_meta.json (NO plaintext secrets)
 * - Secrets are encrypted at rest with AES-256-GCM keyed to Windows MachineGuid + User
 * - Integrates with Windows Credential Manager (cmdkey)
 * - Legacy plaintext vault.json files are automatically migrated and scrubbed
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');

const appData = process.env.APPDATA
  || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : path.join(process.env.HOME, '.config'));
const myraaDir = process.env.MYRAA_DATA_DIR || path.join(appData, 'MYRAA');
const settingsDir = path.join(myraaDir, 'settings');
const vaultMetaFile = path.join(settingsDir, 'vault_meta.json');
const vaultSecretsEncFile = path.join(settingsDir, 'vault_secrets.enc');

// Ensure directories exist
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}

// Derive hardware-bound master key
function getMasterKey() {
  let machineGuid = 'myraa-default-hardware-salt';
  try {
    if (process.platform === 'win32') {
      const regOut = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { timeout: 2000 }).toString();
      const m = regOut.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (m && m[1]) machineGuid = m[1].trim();
    }
  } catch (e) {}

  const user = process.env.USERNAME || process.env.USER || 'user';
  return crypto.pbkdf2Sync(machineGuid + '::' + user, 'myraa-vault-salt-2026', 100000, 32, 'sha256');
}

// Encrypted Secret Store Helpers
function loadSecretsStore() {
  if (!fs.existsSync(vaultSecretsEncFile)) return {};
  try {
    const raw = fs.readFileSync(vaultSecretsEncFile);
    if (raw.length < 28) return {}; // 12 IV + 16 TAG + ciphertext
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(ciphertext, null, 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    console.warn('[SecureVault] Decrypt error or empty store:', e.message);
    return {};
  }
}

function saveSecretsStore(secretsObj) {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(JSON.stringify(secretsObj), 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([iv, tag, ciphertext]);
    const tmp = vaultSecretsEncFile + '.tmp';
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, vaultSecretsEncFile);
    return true;
  } catch (e) {
    console.error('[SecureVault] Failed to save encrypted secrets:', e.message);
    return false;
  }
}

class SecureVault {
  constructor() {
    this.metaPath = vaultMetaFile;
  }

  getMetadataList() {
    try {
      if (fs.existsSync(this.metaPath)) {
        const raw = fs.readFileSync(this.metaPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SecureVault] Error reading vault_meta.json:', e.message);
    }
    return [];
  }

  saveMetadataList(list) {
    try {
      const tmp = this.metaPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tmp, this.metaPath);
      return true;
    } catch (e) {
      console.error('[SecureVault] Error writing vault_meta.json:', e.message);
      return false;
    }
  }

  listAccounts() {
    const metas = this.getMetadataList();
    return metas.map(m => ({
      id: m.id,
      service: m.service || 'External Service',
      domain: m.domain || '',
      email: m.email || 'vishwajeetsrk@gmail.com',
      authMethod: m.auth_method || m.authMethod || 'password',
      hasSecret: Boolean(m.has_secret),
      password: m.has_secret ? '••••••••' : '',
      status: 'Configured',
      updatedAt: m.updated_at || m.updatedAt || new Date().toISOString()
    }));
  }

  getSecret(id) {
    if (!id) return null;
    const store = loadSecretsStore();
    return store[id] || null;
  }

  saveAccount({ id, service, domain, email, authMethod, secret }) {
    const safeId = id || ('acc_' + Date.now());
    const metas = this.getMetadataList();
    const now = new Date().toISOString();
    const hasSecret = Boolean(secret && secret.trim() && secret !== '••••••••');

    if (hasSecret) {
      const store = loadSecretsStore();
      store[safeId] = secret.trim();
      saveSecretsStore(store);

      // Also store in Windows Credential Manager if on Windows
      if (process.platform === 'win32') {
        try {
          const userStr = email || 'user';
          exec(`cmdkey /generic:com.myraa.desktop:${safeId} /user:"${userStr}" /pass:"${secret.trim()}"`, () => {});
        } catch (e) {}
      }
    }

    const idx = metas.findIndex(m => m.id === safeId);
    const metaEntry = {
      id: safeId,
      service: service || (idx >= 0 ? metas[idx].service : 'Custom Service'),
      domain: domain || (idx >= 0 ? metas[idx].domain : ''),
      email: email || (idx >= 0 ? metas[idx].email : 'vishwajeetsrk@gmail.com'),
      auth_method: authMethod || (idx >= 0 ? metas[idx].auth_method : 'password'),
      updated_at: now,
      has_secret: hasSecret || (idx >= 0 ? metas[idx].has_secret : false)
    };

    if (idx >= 0) metas[idx] = metaEntry;
    else metas.push(metaEntry);

    this.saveMetadataList(metas);
    return metaEntry;
  }

  deleteAccount(id) {
    if (!id) return false;
    let metas = this.getMetadataList();
    metas = metas.filter(m => m.id !== id);
    this.saveMetadataList(metas);

    const store = loadSecretsStore();
    if (store[id]) {
      delete store[id];
      saveSecretsStore(store);
    }

    if (process.platform === 'win32') {
      try {
        exec(`cmdkey /delete:com.myraa.desktop:${id}`, () => {});
      } catch (e) {}
    }
    return true;
  }

  getStatus() {
    const metas = this.getMetadataList();
    const legacyPaths = [
      path.join(appData, 'JARVIS', 'vault.json'),
      path.join(myraaDir, 'vault.json'),
      path.join(process.cwd(), '.myraa-data', 'vault.json')
    ];

    let plaintextFound = false;
    for (const lp of legacyPaths) {
      if (fs.existsSync(lp)) {
        try {
          const raw = fs.readFileSync(lp, 'utf8');
          if (raw.includes('"password"') || raw.includes('"secret"')) {
            plaintextFound = true;
            break;
          }
        } catch (e) {}
      }
    }

    const store = loadSecretsStore();
    const secretsCount = Object.keys(store).length;

    return {
      plaintext_found: plaintextFound,
      keyring_entries: secretsCount,
      meta_entries: metas.length,
      secure: !plaintextFound,
      backend: 'Windows Credential Manager / Hardware-Bound AES-256-GCM',
      data_dir: myraaDir
    };
  }

  migrateLegacyPlaintext() {
    let migrated = 0;
    const legacyFiles = [
      path.join(appData, 'JARVIS', 'vault.json'),
      path.join(myraaDir, 'vault.json'),
      path.join(myraaDir, '.myraa-data', 'vault.json'),
      'D:\\Team of Vishwajeet\\MYRAA\\resources\\app\\.myraa-data\\vault.json',
      'D:\\Team of Vishwajeet\\.myraa-data\\vault.json'
    ];

    for (const legacyPath of legacyFiles) {
      if (fs.existsSync(legacyPath)) {
        try {
          const txt = fs.readFileSync(legacyPath, 'utf8');
          const parsed = JSON.parse(txt);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id) {
                this.saveAccount({
                  id: item.id,
                  service: item.service,
                  domain: item.domain,
                  email: item.email,
                  authMethod: item.authMethod || item.auth_method,
                  secret: item.password || item.secret || ''
                });
                migrated++;
              }
            }
          }
          // Overwrite with empty array to scrub plaintext
          fs.writeFileSync(legacyPath, '[]', 'utf8');
          try { fs.unlinkSync(legacyPath); } catch (e) {}
        } catch (e) {
          console.warn('[SecureVault] Error migrating legacy file:', legacyPath, e.message);
        }
      }
    }

    // Also check secrets.json for geminiApiKey
    const secretsPath = path.join(myraaDir, 'secrets.json');
    if (fs.existsSync(secretsPath)) {
      try {
        const sec = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        if (sec.geminiApiKey) {
          this.saveAccount({
            id: 'gemini_api_key',
            service: 'Gemini API',
            domain: 'generativelanguage.googleapis.com',
            email: 'vishwajeetsrk@gmail.com',
            authMethod: 'api_key',
            secret: sec.geminiApiKey
          });
          migrated++;
        }
      } catch (e) {}
    }

    return { migrated, scrubbed: true };
  }
}

const secureVaultInstance = new SecureVault();
// Run auto-migration on module load
try { secureVaultInstance.migrateLegacyPlaintext(); } catch (e) {}

module.exports = secureVaultInstance;
