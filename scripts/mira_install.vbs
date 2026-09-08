' ==============================================================================
'  MIRA AI OS (v5.2 APEX) - Windows Silent VBScript Master Installer
' ==============================================================================
Option Explicit

Dim WshShell, FSO, strSourcePath, strDesktop, strStartMenu, oShortcut, strLauncherBat, strIconPath

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strSourcePath = "d:\Team of Vishwajeet"
strLauncherBat = strSourcePath & "\Start-Mira.bat"
strIconPath = strSourcePath & "\MYRAA\resources\app\dist\icon.ico"

strDesktop = WshShell.SpecialFolders("Desktop")
If FSO.FolderExists(strDesktop) Then
    Set oShortcut = WshShell.CreateShortcut(strDesktop & "\MIRA AI OS.lnk")
    oShortcut.TargetPath = strLauncherBat
    oShortcut.WorkingDirectory = strSourcePath
    oShortcut.Description = "MIRA AI OS - Autonomous 3D Companion & Neural Core"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

strStartMenu = WshShell.SpecialFolders("Programs")
If FSO.FolderExists(strStartMenu) Then
    Set oShortcut = WshShell.CreateShortcut(strStartMenu & "\MIRA AI OS.lnk")
    oShortcut.TargetPath = strLauncherBat
    oShortcut.WorkingDirectory = strSourcePath
    oShortcut.Description = "MIRA AI OS - Autonomous 3D Companion & Neural Core"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

Set WshShell = Nothing
Set FSO = Nothing
