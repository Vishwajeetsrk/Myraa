$wsh = New-Object -ComObject WScript.Shell
$target = "C:\Users\Vishwajeet\AppData\Local\Programs\MYRAA-AI-OS\MYRAA.exe"
$icon = "C:\Users\Vishwajeet\AppData\Local\Programs\MYRAA-AI-OS\icon.ico,0"

$destinations = @(
  "C:\Users\Vishwajeet\OneDrive\Desktop\MYRAA.lnk",
  "C:\Users\Vishwajeet\OneDrive\Desktop\MYRAA AI OS.lnk",
  "C:\Users\Vishwajeet\Desktop\MYRAA.lnk",
  "C:\Users\Vishwajeet\Desktop\MYRAA AI OS.lnk",
  "C:\Users\Vishwajeet\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\MYRAA AI OS\MYRAA AI OS.lnk",
  "C:\Users\Vishwajeet\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\MYRAA AI OS\MYRAA.lnk"
)

foreach ($dst in $destinations) {
  $dir = [System.IO.Path]::GetDirectoryName($dst)
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $sc = $wsh.CreateShortcut($dst)
  $sc.TargetPath = $target
  $sc.WorkingDirectory = "C:\Users\Vishwajeet\AppData\Local\Programs\MYRAA-AI-OS"
  $sc.Description = "MYRAA AI OS"
  $sc.IconLocation = $icon
  $sc.Save()
  Write-Output "Created: $dst"
}

