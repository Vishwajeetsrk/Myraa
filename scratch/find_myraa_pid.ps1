$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'"
foreach ($p in $procs) {
    $cmd = $p.CommandLine
    if ($cmd -and ($cmd -match 'myraa|Myraa|server|dist')) {
        $shortCmd = $cmd.Substring(0, [Math]::Min(300, $cmd.Length))
        Write-Host "PID=$($p.ProcessId) CMD=$shortCmd"
        Write-Host "---"
    }
}
Write-Host "Done checking node processes."
