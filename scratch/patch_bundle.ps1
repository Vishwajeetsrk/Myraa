$src = 'C:\Users\Vishwajeet\Music\Myraa\resources\app\dist\assets\index-qnLjC2CG.js'
$bak = 'C:\Users\Vishwajeet\Music\Myraa\resources\app\dist\assets\index-qnLjC2CG.js.bak'
$tmp = 'C:\Users\Vishwajeet\Music\Myraa\scratch\bundle_patched.js'

# Check if already patched
$content = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)
Write-Host "Read. Length: $($content.Length)"

if ($content.Contains('fetch("/api/chat"')) {
    Write-Host "[OK] Already patched."
    exit 0
}

$dq = [char]34
$old = "ea=async it=>{it.preventDefault();const q=I.trim(),gt=rn.current;!q||!gt||(vt(null),at($($dq)$($dq)),gt.sendText(q),a===$($dq)disconnected$($dq)&&await gt.connect(!1))}"
$new = "ea=async it=>{it.preventDefault();const q=I.trim(),gt=rn.current;if(!q)return;vt(null);at($($dq)$($dq));if(!gt||a===$($dq)disconnected$($dq)||a===$($dq)connecting$($dq)){fetch($($dq)/api/chat$($dq),{method:$($dq)POST$($dq),headers:{$($dq)Content-Type$($dq):$($dq)application/json$($dq)},body:JSON.stringify({message:q})}).then(r=>r.json()).then(d=>{J(q);O(d&&d.reply?d.reply:$($dq)...$($dq));dt($($dq)idle$($dq));setTimeout(()=>{J($($dq)$($dq));O($($dq)$($dq))},9000)}).catch(()=>{J(q);O($($dq)Network error.$($dq));dt($($dq)idle$($dq))});return;}gt.sendText(q);}"

Write-Host "Old found: $($content.Contains($old))"

$newContent = $content.Replace($old, $new)
Write-Host "Patched. New length: $($newContent.Length)"

# Write to scratch dir (writable)
[System.IO.File]::WriteAllText($tmp, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Written to scratch: $tmp (size: $((Get-Item $tmp).Length))"

# Now use robocopy to copy scratch -> assets folder
$result = robocopy 'C:\Users\Vishwajeet\Music\Myraa\scratch' 'C:\Users\Vishwajeet\Music\Myraa\resources\app\dist\assets' 'bundle_patched.js' /NJH /NJS /NC /NS /NFL
Write-Host "Robocopy result: $result"

# Rename in assets folder
$destPath = 'C:\Users\Vishwajeet\Music\Myraa\resources\app\dist\assets\bundle_patched.js'
if (Test-Path $destPath) {
    # Backup original
    if (Test-Path $bak) { Remove-Item $bak -Force }
    Rename-Item -Path $src -NewName 'index-qnLjC2CG.js.bak' -Force
    Rename-Item -Path $destPath -NewName 'index-qnLjC2CG.js' -Force
    Write-Host "[OK] Renamed complete! Final size: $((Get-Item $src).Length)"
} else {
    Write-Host "ERROR: robocopy did not copy file to assets."
    Write-Host "Manual step needed: copy $tmp to $src"
}
