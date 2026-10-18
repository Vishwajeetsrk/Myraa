const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

// Target 1: playAudioPCMChunk
const pcmTarget = 'playAudioPCMChunk(i){if(!(!this.outputAudioCtx||!this.outputGainNode))try{';
const pcmIdx = s.indexOf(pcmTarget);
console.log('pcmTarget index:', pcmIdx);

// Target 2: ea submit handler
const eaTarget = 'fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})}).then(r=>r.json()).then(d=>{J(q);const rep=d&&d.reply?d.reply:(d&&d.error?("Error: "+d.error):"No response received.");O(rep);dt("talking");setTimeout(()=>{dt("idle");},Math.min(8000,Math.max(2000,rep.length*60)));setTimeout(()=>{J("");O("");},12000);})';
const eaIdx = s.indexOf(eaTarget);
console.log('eaTarget index:', eaIdx);

// Target 3: WS message router
const wsTarget = 'if(r.type==="audio"&&r.audio&&this.playAudioPCMChunk(r.audio),r.type==="interrupted"&&this.handleInterruption(),r.type==="turnComplete"&&setTimeout(()=>{this.activeSources.length===0&&this.currentState==="speaking"&&this.setState("listening")},100),r.type==="transcription"&&this.onTranscription(r.role,r.text)';
const wsIdx = s.indexOf(wsTarget);
console.log('wsTarget index:', wsIdx);
