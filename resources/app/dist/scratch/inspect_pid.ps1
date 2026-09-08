try {
  $p = [System.Diagnostics.Process]::GetProcessById(16760)
  Write-Output "Path: $($p.MainModule.FileName)"
  Write-Output "Title: $($p.MainWindowTitle)"
} catch {
  Write-Output "Error: $($_.Exception.Message)"
}
