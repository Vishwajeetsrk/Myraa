const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('resources/app/dist/assets/index-qnLjC2CG.js');
const backupFile = targetFile + '.pre_speaker_fix.bak';

let s = fs.readFileSync(targetFile, 'utf8');
console.log('Original bundle length:', s.length);

if (!fs.existsSync(backupFile)) {
  fs.writeFileSync(backupFile, s);
  console.log('[OK] Backup created at:', backupFile);
}

// Target 1: Fx constructor additions & window.myraaSpeak & gesture unlock
const t1 = 'this.onScreenVisionState=i.onScreenVisionState}';
const r1 = 'this.onScreenVisionState=i.onScreenVisionState;this.hasAudioInTurn=!1;this.turnModelText="";if(typeof window!=="undefined"&&!window.myraaSpeak){window.myraaSpeak=function(t){if(!t)return;const c=t.replace(/\\[[^\\]]*\\]/g,"").replace(/https?:\\/\\/\\S+/g,"").trim();if(!c)return;let ok=!1;try{if(window.speechSynthesis){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(c);u.rate=1.05;u.pitch=1.1;const vs=window.speechSynthesis.getVoices(),fv=vs.find(v=>/zira|jenny|samantha|victoria|female|natural|aria/i.test(v.name))||vs.find(v=>v.lang&&v.lang.startsWith("en"));if(fv)u.voice=fv;window.speechSynthesis.speak(u);ok=!0;}}catch(_){}if(!ok){try{fetch("/api/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:c})}).catch(()=>{});}catch(_){}}};["click","keydown","pointerdown","touchstart","focus"].forEach(e=>{window.addEventListener(e,()=>{try{window._myraaAudioCtx&&window._myraaAudioCtx.state==="suspended"&&window._myraaAudioCtx.resume().catch(()=>{});}catch(_){}},{passive:!0});});}}';

// Target 2: WS message router
const t2 = 'if(r.type==="audio"&&r.audio&&this.playAudioPCMChunk(r.audio),r.type==="interrupted"&&this.handleInterruption(),r.type==="turnComplete"&&setTimeout(()=>{this.activeSources.length===0&&this.currentState==="speaking"&&this.setState("listening")},100),r.type==="transcription"&&this.onTranscription(r.role,r.text)';
const r2 = 'if(r.type==="audio"&&r.audio&&(this.hasAudioInTurn=!0,this.playAudioPCMChunk(r.audio)),r.type==="interrupted"&&(this.hasAudioInTurn=!1,this.turnModelText="",this.handleInterruption()),r.type==="turnComplete"&&setTimeout(()=>{!this.hasAudioInTurn&&this.turnModelText&&window.myraaSpeak&&window.myraaSpeak(this.turnModelText),this.hasAudioInTurn=!1,this.turnModelText="",this.activeSources.length===0&&this.currentState==="speaking"&&this.setState("listening")},100),r.type==="transcription"&&(r.role==="model"&&(this.turnModelText=(this.turnModelText?(this.turnModelText+" "):"")+r.text),this.onTranscription(r.role,r.text))';

// Target 3: playAudioPCMChunk auto-resume
const t3 = 'playAudioPCMChunk(i){if(!(!this.outputAudioCtx||!this.outputGainNode))try{';
const r3 = 'playAudioPCMChunk(i){if(!(!this.outputAudioCtx||!this.outputGainNode))try{this.outputAudioCtx.state==="suspended"&&this.outputAudioCtx.resume().catch(()=>{});window._myraaAudioCtx=this.outputAudioCtx;';

// Target 4: ea submit handler (/api/chat)
const t4 = 'fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})}).then(r=>r.json()).then(d=>{J(q);const rep=d&&d.reply?d.reply:(d&&d.error?("Error: "+d.error):"No response received.");O(rep);dt("talking");setTimeout(()=>{dt("idle");},Math.min(8000,Math.max(2000,rep.length*60)));setTimeout(()=>{J("");O("");},12000);})';
const r4 = 'fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})}).then(r=>r.json()).then(d=>{J(q);const rep=d&&d.reply?d.reply:(d&&d.error?("Error: "+d.error):"No response received.");O(rep);dt("talking");try{window.myraaSpeak&&rep&&!rep.startsWith("Error:")&&window.myraaSpeak(rep);}catch(e){console.warn("[Voice]",e);}setTimeout(()=>{dt("idle");},Math.min(8000,Math.max(2000,rep.length*60)));setTimeout(()=>{J("");O("");},12000);})';

if (s.indexOf(t1) === -1) throw new Error('Target 1 not found');
if (s.indexOf(t2) === -1) throw new Error('Target 2 not found');
if (s.indexOf(t3) === -1) throw new Error('Target 3 not found');
if (s.indexOf(t4) === -1) throw new Error('Target 4 not found');

s = s.replace(t1, r1);
s = s.replace(t2, r2);
s = s.replace(t3, r3);
s = s.replace(t4, r4);

fs.writeFileSync(targetFile, s, 'utf8');
console.log('[SUCCESS] index-qnLjC2CG.js patched successfully! New length:', s.length);
