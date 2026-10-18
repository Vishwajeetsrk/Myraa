$file = "C:\Users\Vishwajeet\Music\Myraa\resources\app\dist\assets\index-qnLjC2CG.js"

$s = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# The Web Speech API patch block to remove (from !window.myraaSpeak to the closing of the listeners block)
$old = '!window.myraaSpeak){window.myraaSpeak=function(t){if(!t)return;const c=t.replace(/\[[^\]]*\]/g,"").replace(/https?:\/\/\S+/g,"").trim();if(!c)return;let ok=!1;try{if(window.speechSynthesis){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(c);u.rate=1.05;u.pitch=1.1;const vs=window.speechSynthesis.getVoices(),fv=vs.find(v=>/zira|jenny|samantha|victoria|female|natural|aria/i.test(v.name))||vs.find(v=>v.lang&&v.lang.startsWith("en"));if(fv)u.voice=fv;window.speechSynthesis.speak(u);ok=!0;}}catch(_){}if(!ok){try{fetch("/api/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:c})}).catch(()=>{});}catch(_){}}};["click","keydown","pointerdown","touchstart","focus"].forEach(e=>{window.addEventListener(e,()=>{try{window._myraaAudioCtx&&window._myraaAudioCtx.state==="suspended"&&window._myraaAudioCtx.resume().catch(()=>{});}catch(_){}},{passive:!0});});}'

# Replace with only the AudioContext unlock (no Web Speech, no Windows SAPI)
$new = '!window._myraaAudioUnlocked){window._myraaAudioUnlocked=!0;["click","keydown","pointerdown","touchstart","focus"].forEach(e=>{window.addEventListener(e,()=>{try{window._myraaAudioCtx&&window._myraaAudioCtx.state==="suspended"&&window._myraaAudioCtx.resume().catch(()=>{});}catch(_){}},{passive:!0});});}'

if ($s.Contains($old)) {
    $s = $s.Replace($old, $new)
    [System.IO.File]::WriteAllText($file, $s, [System.Text.Encoding]::UTF8)
    Write-Host "[OK] Voice patch reverted. Original Gemini Live voice restored."
    Write-Host "     Web Speech API (Zira/Jenny) override removed."
    Write-Host "     AudioContext unlock listeners kept active."
} else {
    Write-Host "[!] Patch string not found exactly."
    $idx = $s.IndexOf("window.myraaSpeak")
    Write-Host "window.myraaSpeak at: $idx"
}
