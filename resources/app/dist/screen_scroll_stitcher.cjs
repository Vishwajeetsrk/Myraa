/**
 * =============================================================================
 * MYRAA AI OS — Screen Scroll Stitcher (v1.0)
 * =============================================================================
 * Extends screen vision to handle content taller than one viewport:
 *  1. captureScrolled()    : screenshot -> scroll -> screenshot -> ... (N frames)
 *  2. stitchToDocument()   : vertically concat frames via Pillow -> combined PNG
 *  3. describeStitched()   : send combined image to vision model, return answer
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const AGENT_PORT = 8765;
const SCREENSHOT_PAUSE_MS = 600;
const SCROLL_PAUSE_MS = 800;

function agentPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: '127.0.0.1', port: AGENT_PORT, path: endpoint,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = http.request(opts, res => {
      let out = '';
      res.on('data', d => out += d);
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch(_) { resolve({ ok: true, raw: out }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const tmpDir = path.join(process.cwd(), 'Projects', 'ScreenCaptures');
try { if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true }); } catch(_) {}

const ScreenScrollStitcher = {

  async captureScrolled({ maxFrames = 5, scrollPx = 800, windowTitle } = {}) {
    const frames = [];
    const ts = Date.now();

    for (let i = 0; i < maxFrames; i++) {
      await sleep(SCREENSHOT_PAUSE_MS);
      try {
        // Call agent screenshot endpoint
        const ssResult = await agentPost('/screenshot', {});
        if (ssResult && ssResult.base64) {
          frames.push({ index: i, base64: ssResult.base64, format: ssResult.format || 'png' });
        } else if (ssResult && ssResult.path) {
          const imgData = fs.readFileSync(ssResult.path);
          frames.push({ index: i, base64: imgData.toString('base64'), format: 'png' });
        }
      } catch(_) {
        // Agent screenshot failed; try PowerShell fallback
        try {
          const framePath = path.join(tmpDir, `frame_${ts}_${i}.png`);
          const psCmd = `Add-Type -AssemblyName System.Windows.Forms; $s=[System.Windows.Forms.Screen]::PrimaryScreen; $bmp=New-Object System.Drawing.Bitmap($s.Bounds.Width,$s.Bounds.Height); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($s.Bounds.Location,[System.Drawing.Point]::Empty,$s.Bounds.Size); $bmp.Save('${framePath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $bmp.Dispose()`;
          require('child_process').execSync(`powershell -NoProfile -Command "${psCmd}"`, { timeout: 5000 });
          if (fs.existsSync(framePath)) {
            const imgData = fs.readFileSync(framePath);
            frames.push({ index: i, base64: imgData.toString('base64'), format: 'png', path: framePath });
          }
        } catch(__) {}
      }

      // Scroll down (except after last frame)
      if (i < maxFrames - 1) {
        try {
          await agentPost('/execute', { tool: 'scroll', params: { direction: 'down', amount: scrollPx } });
        } catch(_) {
          // PowerShell scroll fallback via SendKeys
          try {
            require('child_process').execSync(`powershell -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('{PGDN}')"`, { timeout: 2000 });
          } catch(__) {}
        }
        await sleep(SCROLL_PAUSE_MS);
      }
    }

    return { ok: frames.length > 0, frameCount: frames.length, frames };
  },

  async stitchToDocument(frames) {
    if (!frames || frames.length === 0) return { ok: false, error: 'No frames to stitch' };

    const ts = Date.now();
    const framePaths = [];

    // Write base64 frames to temp PNG files
    for (const frame of frames) {
      if (frame.path && fs.existsSync(frame.path)) {
        framePaths.push(frame.path);
      } else if (frame.base64) {
        const fp = path.join(tmpDir, `stitch_${ts}_${frame.index}.png`);
        fs.writeFileSync(fp, Buffer.from(frame.base64, 'base64'));
        framePaths.push(fp);
      }
    }

    if (framePaths.length === 0) return { ok: false, error: 'Could not write frame files' };
    if (framePaths.length === 1) return { ok: true, combinedPath: framePaths[0], frameCount: 1 };

    const combinedPath = path.join(tmpDir, `stitched_${ts}.png`);
    const pathsJson = JSON.stringify(framePaths);

    const pythonScript = `
import sys, json
from PIL import Image

paths = json.loads(sys.argv[1])
out_path = sys.argv[2]

images = []
for p in paths:
    try:
        img = Image.open(p)
        images.append(img)
    except Exception as e:
        print(f"Skip {p}: {e}", file=sys.stderr)

if not images:
    print(json.dumps({"ok": False, "error": "No images loaded"}))
    sys.exit(1)

total_w = max(img.width for img in images)
total_h = sum(img.height for img in images)
combined = Image.new("RGB", (total_w, total_h), (0,0,0))

y_offset = 0
for img in images:
    combined.paste(img, (0, y_offset))
    y_offset += img.height

combined.save(out_path)
print(json.dumps({"ok": True, "path": out_path, "width": total_w, "height": total_h, "frameCount": len(images)}))
`;

    return new Promise(resolve => {
      const scriptPath = path.join(tmpDir, `stitch_script_${ts}.py`);
      fs.writeFileSync(scriptPath, pythonScript, 'utf8');
      exec(`python "${scriptPath}" "${pathsJson.replace(/"/g, '\\"')}" "${combinedPath}"`, { timeout: 30000 }, (err, stdout) => {
        try { fs.unlinkSync(scriptPath); } catch(_) {}
        if (err) return resolve({ ok: false, error: err.message });
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch(_) {
          resolve({ ok: true, combinedPath, frameCount: framePaths.length });
        }
      });
    });
  },

  async describeStitched(combinedPath, question, modelClient) {
    if (!combinedPath || !fs.existsSync(combinedPath)) return { ok: false, error: 'Combined image not found' };
    const imageData = fs.readFileSync(combinedPath).toString('base64');

    // Use modelClient if provided (Gemini Vision), otherwise return raw base64 path for caller
    if (modelClient && typeof modelClient.describeImage === 'function') {
      try {
        const answer = await modelClient.describeImage({ base64: imageData, mimeType: 'image/png', question });
        return { ok: true, answer, combinedPath, model: 'gemini-vision' };
      } catch(e) {
        return { ok: false, error: e.message, combinedPath };
      }
    }

    // Fallback: return the image path so the calling route can forward to LLM
    return { ok: true, combinedPath, base64: imageData, mimeType: 'image/png', question, model: 'raw' };
  },

  /**
   * Full pipeline: scroll-capture -> stitch -> describe
   */
  async scrollAndDescribe({ question, maxFrames = 5, scrollPx = 800, modelClient } = {}) {
    const captureResult = await this.captureScrolled({ maxFrames, scrollPx });
    if (!captureResult.ok) return { ok: false, error: 'Screen capture failed', ...captureResult };

    const stitchResult = await this.stitchToDocument(captureResult.frames);
    if (!stitchResult.ok) return { ok: false, error: 'Frame stitching failed', ...stitchResult };

    const descResult = await this.describeStitched(stitchResult.path || stitchResult.combinedPath, question, modelClient);
    return {
      ok: descResult.ok,
      frameCount: captureResult.frameCount,
      combinedPath: stitchResult.path || stitchResult.combinedPath,
      answer: descResult.answer,
      base64: descResult.base64,
      mimeType: descResult.mimeType,
      question,
      model: descResult.model
    };
  }
};

module.exports = ScreenScrollStitcher;
