const fs = require('fs');
const s = fs.readFileSync('resources/app/dist/assets/index-qnLjC2CG.js', 'utf8');

function findLine(target) {
  const idx = s.indexOf(target);
  if (idx === -1) return null;
  const line = s.slice(0, idx).split('\n').length;
  return { line, idx };
}

console.log('t1:', findLine('this.onScreenVisionState=i.onScreenVisionState}'));
console.log('t2:', findLine('if(r.type==="audio"&&r.audio&&this.playAudioPCMChunk(r.audio)'));
console.log('t3:', findLine('playAudioPCMChunk(i){if(!(!this.outputAudioCtx||!this.outputGainNode))try{'));
console.log('t4:', findLine('fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})}).then(r=>r.json()).then(d=>{J(q);const rep=d&&d.reply?d.reply:(d&&d.error?("Error: "+d.error):"No response received.");O(rep);dt("talking");setTimeout(()=>{dt("idle");},Math.min(8000,Math.max(2000,rep.length*60)));setTimeout(()=>{J("");O("");},12000);})'));
