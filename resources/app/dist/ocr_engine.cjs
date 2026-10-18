'use strict';
/**
 * MYRAA OCR engine (Phase 4) — local-first text recognition.
 * Uses tesseract.js (WASM, no native build). First use downloads the English
 * traineddata once (~15 MB) and caches it; afterwards it works offline.
 * Chain position: local OCR first, vision-model OCR only when local fails
 * or is not installed. Never throws — returns {ok:false,...} honestly.
 */

const fs = require('fs');
const path = require('path');

function cacheDir() {
  const base = process.env.APPDATA
    || (process.platform === 'darwin'
      ? path.join(process.env.HOME || '', 'Library/Application Support')
      : path.join(process.env.HOME || '', '.config'));
  return path.join(process.env.MYRAA_DATA_DIR || path.join(base, 'MYRAA'), 'tesseract-cache');
}

function loadTesseract() {
  try {
    const mod = require('tesseract.js');
    if (mod && typeof mod.createWorker === 'function') return { ok: true, mod };
    return { ok: false, error: 'tesseract.js present but createWorker missing (unexpected version).' };
  } catch (e) {
    return { ok: false, error: 'NOT_CONFIGURED: tesseract.js is not installed. Run: npm install tesseract.js (in resources/app).' };
  }
}

function toInput(imageBase64, imagePath) {
  if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.length > 100) {
    const clean = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    try {
      const buf = Buffer.from(clean, 'base64');
      if (buf.length > 100) return { ok: true, input: buf };
    } catch (e) { /* fall through */ }
  }
  if (imagePath && typeof imagePath === 'string' && fs.existsSync(imagePath)) {
    return { ok: true, input: imagePath };
  }
  return { ok: false, error: 'No usable image supplied (need base64 PNG/JPEG or an existing file path).' };
}

// recognize({imageBase64?, imagePath?, lang?}) -> {ok, text, confidence, method} | {ok:false, error, code?}
async function recognize(opts) {
  const o = opts || {};
  const prep = toInput(o.imageBase64, o.imagePath);
  if (!prep.ok) return { ok: false, error: prep.error };
  const t = loadTesseract();
  if (!t.ok) return { ok: false, error: t.error, code: 'NOT_CONFIGURED' };
  const lang = (o.lang || 'eng').trim() || 'eng';
  let worker = null;
  try {
    try { fs.mkdirSync(cacheDir(), { recursive: true }); } catch (e) {}
    worker = await t.mod.createWorker(lang, { cachePath: cacheDir() });
  } catch (e) {
    // Older/newer signature: retry with language only.
    try {
      worker = await t.mod.createWorker(lang);
    } catch (e2) {
      return { ok: false, error: 'OCR worker failed to start: ' + String((e2 && e2.message) || e2).slice(0, 200) };
    }
  }
  try {
    const { data } = await worker.recognize(prep.input);
    const text = String((data && data.text) || '').trim();
    const confidence = data && typeof data.confidence === 'number' ? Math.round(data.confidence) : null;
    return { ok: true, text, confidence, method: 'local-tesseract', lang };
  } catch (e) {
    return { ok: false, error: 'OCR_FAILED: ' + String((e && e.message) || e).slice(0, 300) };
  } finally {
    try { if (worker) await worker.terminate(); } catch (e) {}
  }
}

function status() {
  const t = loadTesseract();
  return {
    ok: true,
    installed: t.ok,
    method: t.ok ? 'local-tesseract' : 'unavailable',
    cacheDir: cacheDir(),
    detail: t.ok ? 'Ready.' : t.error,
  };
}

module.exports = { recognize, status, cacheDir };
