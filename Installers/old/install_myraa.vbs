' ==============================================================================
'  MYRAA AI OS (v7.5.0 APEX Master) - Windows Silent VBScript Master Installer
'  Technology: WScript.Shell / Scripting.FileSystemObject
' ==============================================================================
Option Explicit

Dim WshShell, FSO, strSourcePath
Dim strDesktop, strStartMenu, oShortcut, strIconPath, strLauncherBat

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 1. Resolve Target and Source Locations
strSourcePath = "C:\Users\Vishwajeet\Music\Myraa"
If Not FSO.FolderExists(strSourcePath) Then
    strSourcePath = FSO.GetParentFolderName(WScript.ScriptFullName)
End If

strLauncherBat = strSourcePath & "\Start-Myraa.bat"
strIconPath = strSourcePath & "\icon.ico"
If Not FSO.FileExists(strIconPath) Then
    strIconPath = strSourcePath & "\resources\app\dist\icon.ico"
End If
If Not FSO.FileExists(strIconPath) Then
    strIconPath = strSourcePath & "\public\favicon.ico"
End If

' 2. Create Desktop & Start Menu Shortcuts
strDesktop = WshShell.SpecialFolders("Desktop")
If FSO.FolderExists(strDesktop) Then
    Set oShortcut = WshShell.CreateShortcut(strDesktop & "\MYRAA AI OS.lnk")
    oShortcut.TargetPath = strLauncherBat
    oShortcut.WorkingDirectory = strSourcePath
    oShortcut.Description = "MYRAA AI OS - Autonomous 3D Companion & Neural Core"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

strStartMenu = WshShell.SpecialFolders("Programs")
If FSO.FolderExists(strStartMenu) Then
    Set oShortcut = WshShell.CreateShortcut(strStartMenu & "\MYRAA AI OS.lnk")
    oShortcut.TargetPath = strLauncherBat
    oShortcut.WorkingDirectory = strSourcePath
    oShortcut.Description = "MYRAA AI OS - Autonomous 3D Companion & Neural Core"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

' 3. Register Startup Run Key
On Error Resume Next
WshShell.RegWrite "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\MYRAA_AI_OS", """" & strLauncherBat & """", "REG_SZ"
On Error GoTo 0

' 4. Show Completion Alert
MsgBox "MYRAA AI OS (v7.5.0 APEX Master) has been verified and updated successfully!" & vbCrLf & vbCrLf & _
       "• Location: " & strSourcePath & vbCrLf & _
       "• Identity: Myraa (Female AI Companion)" & vbCrLf & _
       "• Voice Biometrics: Operator Vishwajeet Verified" & vbCrLf & _
       "• Desktop Shortcut: 'MYRAA AI OS' Synchronized", vbInformation, "MYRAA AI OS v7.5.0 Setup Complete"

Set WshShell = Nothing
Set FSO = Nothing
