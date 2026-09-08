#!/usr/bin/env node
/*
 * env_to_vault.cjs — P0: move plaintext .env secrets into the encrypted
 * SecureVault store (AES-256-GCM) + Windows Credential Manager.
 *
 *   node scripts/env_to_vault.cjs            # migrate + verify
 *   node scripts/env_to_vault.cjs --report   # only show what would be stored (dry run)
 *
 * It never prints secret values and never modifies the .env files.
 * After migration, runtime key resolvers fall back to SecureVault, so .env
 * values can be scrubbed later without breaking chat.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'resources', 'app');
const ENV_CANDIDATES = [
  path.join(APP, '.env'),
  path.join(ROOT, '.env'),
  path.join(ROOT, '.env.local'),
];

const DRY_RUN = process.argv.includes('--report');

const IS_SECRET_KEY = (key) =>
  /(KEY|TOKEN|PASSWORD|SECRET|DATABASE_URL)/i.test(key) && !/PUBLISHABLE/i.test(key);
const IS_CONFIG_KEY = (key) =>
  /^(PORT|AI_PROVIDER|AI_MODEL|ENABLE_[A-Z_]+|NODE_ENV|VITE_.*ENABLE)/.test(key);

function parseEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
    if (key) out[key] = val;
  }
  return out;
}

const SERVICE_LABEL = {
  GEMINI_API_KEY: 'Gemini AI', GOOGLE_GENERATIVE_AI_API_KEY: 'Gemini AI',
  GROQ_API_KEY: 'Groq AI', OPENROUTER_API_KEY: 'OpenRouter',
  COHERE_API_KEY: 'Cohere', HUGGINGFACE_API_KEY: 'Hugging Face',
  MISTRAL_API_KEY: 'Mistral', FISH_AUDIO_API_KEY: 'Fish Audio',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase', SUPABASE_SECRET_KEY: 'Supabase',
  SUPABASE_DB_PASSWORD: 'Supabase', DATABASE_URL: 'Supabase DB',
};

function friendly(key) {
  const f = SERVICE_LABEL[key];
  if (f) return f;
  const pretty = /DATABASE_URL/.test(key) ? 'Database' : key.replace(/_/g, ' ').toLowerCase();
  return pretty.replace(/\b\w/g, (c) => c.toUpperCase());
}

function load() {
  const envs = {};
  for (const f of ENV_CANDIDATES) if (fs.existsSync(f)) Object.assign(envs, parseEnv(f));
  return envs;
}

(async function main() {
  const env = load();
  const targets = Object.entries(env)
    .filter(([k, v]) => v && IS_SECRET_KEY(k) && !IS_CONFIG_KEY(k));

  const vault = require(path.join(APP, 'dist', 'secure_vault.cjs'));

  const rows = [];
  for (const [key, value] of targets) {
    if (DRY_RUN) {
      rows.push({ id: key, service: friendly(key), status: 'would-store' });
      continue;
    }
    vault.saveAccount({
      id: key,
      service: friendly(key),
      domain: '',
      email: 'vishwajeetsrk@gmail.com',
      authMethod: 'api_key',
      secret: value,
    });
    const check = vault.getSecret(key) === value.trim();
    rows.push({ id: key, service: friendly(key), status: check ? 'stored+verified' : 'STORED?VERIFY-FAILED' });
  }

  console.log(`=== env → SecureVault migration (${DRY_RUN ? 'DRY RUN' : 'applied'}) ===`);
  for (const r of rows) console.log(`  ${r.status.padEnd(20)} ${r.id.padEnd(34)} ${r.service}`);
  const ok = rows.every((r) => r.status === 'stored+verified');
  console.log(ok || DRY_RUN
    ? `Done — ${rows.length} secret(s) safe in vault (${vault.getStatus().backend}).`
    : `WARNING: ${rows.filter((r) => r.status !== 'stored+verified').length} entry(ies) failed verification.`);
  process.exit(ok || DRY_RUN ? 0 : 1);
})().catch((e) => {
  console.error('env_to_vault failed:', e.message);
  process.exit(2);
});