Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'MYRAA*' } | Select-Object ProcessId, Name, CommandLine | Format-List
