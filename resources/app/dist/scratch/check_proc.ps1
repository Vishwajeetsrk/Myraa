Get-Process | Where-Object { $_.ProcessName -like '*MYRAA*' -or $_.ProcessName -like '*electron*' } | Select-Object Id, ProcessName, SessionId, MainWindowTitle | Format-Table -AutoSize
