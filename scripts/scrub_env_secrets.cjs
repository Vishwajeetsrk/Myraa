#!/usr/bin/env node
/*
 * scrub_env_secrets.cjs — P2: remove plaintext secret VALUES from .env files.
 *
 *   node scripts/scrub_env_secrets.cjs            # scrub values -> ""
 *   node scripts/scrub_env_secrets.cjs --restore  # restore values from SecureVault
 *   node scripts/scrub_env_secrets.cjs --report   # dry run (no writes)
 *
 * Public/build config (project ids, publishable keys, VITE_*, flags, PORT) is
 * intentionally left in place. Secrets live in SecureVault; loader-only .env
 * keeps boot/tooling working. Never prints secret values.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'resources', 'app');
const ENV_FILES_DEFAULT = [path.join(APP, '.env'), path.join(ROOT, '.env'), path.join(ROOT, '.env.local')];
const EXTRA = process.argv.slice(2).filter((a) => a.startsWith('--file=')).map((a) => a.slice('--file='.length));
const ENV_FILES = EXTRA.length ? EXTRA : ENV_FILES_DEFAULT;

const RESTORE = process.argv.includes('--restore');
const REPORT = process.argv.includes('--report');

const SCRUB_KEYS = (key) =>
  /(SERVICE_ROLE_KEY|SERVICE_ROLE|SECRET_KEY|DB_PASSWORD|DATABASE_URL)$/.test(key) ||
  /^(GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|COHERE_API_KEY|HUGGINGFACE_API_KEY|MISTRAL_API_KEY|FISH_AUDIO_API_KEY)$/.test(key);

function loadVault() {
  return require(path.join(APP, 'dist', 'secure_vault.cjs'));
}

function processFile(file, vault, mode) {
  if (!fs.existsSync(file)) return { file, lines: 0, changed: 0 };
  const txt = fs.readFileSync(file, 'utf8');
  const eol = txt.includes('\r\n') ? '\r\n' : '\n';
  const out = [];
  let changed = 0;
  const needsQuote = (val) => /[\s#"'\\]/.test(val);
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (m && SCRUB_KEYS(m[1])) {
      const key = m[1];
      if (mode === 'restore') {
        const val = vault.getSecret(key);
        if (val) {
          out.push(needsQuote(val) ? `${key}="${val}"` : `${key}=${val}`);
          changed++;
          continue;
        }
      }
      if (mode === 'scrub') { out.push(`${key}=""`); changed++; continue; }
      if (mode === 'report') { out.push(line); }
    } else {
      out.push(line);
    }
  }
  let wroteFile = false;
  if (!REPORT && changed > 0) {
    fs.writeFileSync(file, out.join(eol), 'utf8');
    wroteFile = true;
  }
  return { file, lines: out.length, changed, wroteFile };
}

(async (main) => {
  const mode = REPORT ? 'report' : (RESTORE ? 'restore' : 'scrub');
  const vault = REPORT ? null : loadVault();
  const results = ENV_FILES.map((f) => processFile(f, vault, mode));
  let total = 0;
  console.log(`=== .env secrets ${mode} ===`);
  for (const r of results) {
    console.log(`  ${r.changed ? r.changed : 0} key(s) ${mode === 'report' ? 'would change' : (mode === 'restore' ? 'restored' : 'scrubbed')}  ${r.file}`);
    total += r.changed;
  }
  // verify: no secret values left behind (scrub mode only)
  if (mode === 'scrub') {
    const bad = [];
    for (const f of ENV_FILES) {
      if (!fs.existsSync(f)) continue;
      const txt = fs.readFileSync(f, 'utf8');
      for (const rawLine of txt.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*"?(.*?)"?$/);
        if (m && SCRUB_KEYS(m[1]) && m[2] && m[2].length > 0) bad.push(`${f}: ${m[1]}`);
      }
    }
    if (bad.length) { console.error(`VERIFY FAILED — ${bad.length} secret(s) still present:`); bad.forEach((b) => console.log('  ' + b)); process.exit(1); }
    console.log(`Verified: no scrubbed secret values remain in .env files (${total} scrubbed).`);
  }
  process.exit(0);
})();