const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve('resources/app/dist/assets/index-qnLjC2CG.js');
let s = fs.readFileSync(bundlePath, 'utf8');

// The patched block we need to revert - from !window.myraaSpeak to }}setState
const PATCH_START = '!window.myraaSpeak){window.myraaSpeak=function(t){if(!t)return;const c=t.replace(/\\[[^\\]]*\\]/g,"").replace(/https?:\\/\\/\\S+/g,"").trim();if(!c)return;let ok=!1;try{if(window.speechSynthesis){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(c);u.rate=1.05;u.pitch=1.1;const vs=window.speechSynthesis.getVoices(),fv=vs.find(v=>/zira|jenny|samantha|victoria|female|natural|aria/i.test(v.name))||vs.find(v=>v.lang&&v.lang.startsWith("en"));if(fv)u.voice=fv;window.speechSynthesis.speak(u);ok=!0;}}catch(_){}if(!ok){try{fetch("/api/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:c})}).catch(()=>{});}catch(_){}}};["click","keydown","pointerdown","touchstart","focus"].forEach(e=>{window.addEventListener(e,()=>{try{window._myraaAudioCtx&&window._myraaAudioCtx.state==="suspended"&&window._myraaAudioCtx.resume().catch(()=>{});}catch(_){}},{passive:!0});});}';

// What to replace it with - keep only the AudioContext resume listener, remove Web Speech API override entirely
const PATCH_REPLACEMENT = '!window._myraaAudioUnlocked){window._myraaAudioUnlocked=!0;["click","keydown","pointerdown","touchstart","focus"].forEach(e=>{window.addEventListener(e,()=>{try{window._myraaAudioCtx&&window._myraaAudioCtx.state==="suspended"&&window._myraaAudioCtx.resume().catch(()=>{});}catch(_){}},{passive:!0});});}';

if (s.includes(PATCH_START)) {
  s = s.replace(PATCH_START, PATCH_REPLACEMENT);
  fs.writeFileSync(bundlePath, s);
  console.log('[OK] Reverted myraaSpeak Web Speech patch. Original Gemini Live voice restored.');
} else {
  console.log('[!] Patch block not found exactly - checking...');
  const idx = s.indexOf('window.myraaSpeak');
  console.log('window.myraaSpeak at:', idx);
  if (idx !== -1) {
    console.log(s.slice(idx - 50, idx + 400));
  }
}
