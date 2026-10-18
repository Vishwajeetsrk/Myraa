const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outPath = 'C:/Users/Vishwajeet/.gemini/antigravity-ide/brain/58a6bf97-0377-465e-b453-a22355e48ceb/scratch/render_result.json';
const screenshotPath = 'C:/Users/Vishwajeet/.gemini/antigravity-ide/brain/58a6bf97-0377-465e-b453-a22355e48ceb/scratch/test_render.png';

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  const logs = [];
  win.webContents.on('console-message', (e, level, msg, line, src) => {
    logs.push({ level, msg, line, src });
    console.log(`[RENDERER LOG] ${msg}`);
  });

  try {
    console.log('Loading http://localhost:3000/...');
    await win.loadURL('http://localhost:3000/');

    // Poll every 1 second for 20 seconds to monitor canvas opacity and progress
    const snapshots = [];
    for (let sec = 1; sec <= 20; sec++) {
      await new Promise(r => setTimeout(r, 1000));
      const snap = await win.webContents.executeJavaScript(`(() => {
        const c = document.querySelector('canvas');
        const progressBar = document.querySelector('.bg-cyan-400\\\\/70');
        const phaseEl = document.querySelector('.text-cyan-200\\\\/70');
        return {
          sec: ${sec},
          canvasFound: Boolean(c),
          canvasOpacity: c ? window.getComputedStyle(c).opacity : null,
          progressWidth: progressBar ? progressBar.style.width : null,
          phase: phaseEl ? phaseEl.textContent : null
        };
      })()`);
      snapshots.push(snap);
      console.log(`[T+${sec}s]`, JSON.stringify(snap));
      if (snap.canvasOpacity === '1') {
        console.log('[SUCCESS] Canvas opacity reached 1 at second ' + sec);
        break;
      }
    }

    const image = await win.webContents.capturePage();
    fs.writeFileSync(screenshotPath, image.toPNG());

    fs.writeFileSync(outPath, JSON.stringify({ snapshots, logs }, null, 2));
  } catch (err) {
    fs.writeFileSync(outPath, JSON.stringify({ error: err.message, logs }, null, 2));
  } finally {
    app.quit();
  }
});
