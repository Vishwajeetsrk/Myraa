const { exec } = require('child_process');

function nativeSpeak(text) {
  const safeText = text.replace(/["'`$\\]/g, ' ').slice(0, 500);
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; try { $s.SelectVoice('Microsoft Zira Desktop'); } catch {} $s.Speak('${safeText}');`;
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${ps}"`, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
  });
}

nativeSpeak('MYRAA audio output is now active.').then(res => {
  console.log('[OK] Spoken:', res);
});
