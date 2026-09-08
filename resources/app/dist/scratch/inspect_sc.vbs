
Set ws = CreateObject("WScript.Shell")
Set sc1 = ws.CreateShortcut("C:\Users\Vishwajeet\OneDrive\Desktop\MYRAA AI OS.lnk")
Set sc2 = ws.CreateShortcut("C:\Users\Vishwajeet\Desktop\MYRAA AI OS.lnk")
WScript.Echo "OneDrive: " & sc1.TargetPath & " | " & sc1.WorkingDirectory
WScript.Echo "Standard: " & sc2.TargetPath & " | " & sc2.WorkingDirectory
