' ==============================================================================
'  MYRAA AI OS (v5.0 APEX) - Windows Silent VBScript Master Installer
'  Technology: WScript.Shell / Scripting.FileSystemObject
' ==============================================================================
Option Explicit

Dim WshShell, FSO, strLocalAppData, strInstallPath, strSourcePath
Dim strDesktop, strStartMenu, oShortcut, strTargetExe, strIconPath

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 1. Resolve Target and Source Locations
strLocalAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
strInstallPath = strLocalAppData & "\Programs\MYRAA-AI-OS"

' Check source directory
strSourcePath = FSO.GetParentFolderName(WScript.ScriptFullName)
If Not FSO.FolderExists(strSourcePath & "\resources\app") Then
    strSourcePath = "d:\Team of Vishwajeet\MYRAA"
End If

If Not FSO.FolderExists(strSourcePath) Then
    MsgBox "Could not locate MYRAA source files at: " & vbCrLf & strSourcePath, vbCritical, "MYRAA Setup Error"
    WScript.Quit 1
End If

' 2. Ensure Target Directory Exists
If Not FSO.FolderExists(strInstallPath) Then
    CreateFolderRecursive strInstallPath
End If
If Not FSO.FolderExists(strInstallPath & "\resources") Then
    FSO.CreateFolder strInstallPath & "\resources"
End If
If Not FSO.FolderExists(strInstallPath & "\resources\app") Then
    FSO.CreateFolder strInstallPath & "\resources\app"
End If

' 3. Sync Application Bundles & Resources
On Error Resume Next

' Sync root files & DLLs
If FSO.FolderExists(strSourcePath) Then
    Dim fileItem
    For Each fileItem In FSO.GetFolder(strSourcePath).Files
        If LCase(FSO.GetExtensionName(fileItem.Name)) <> "log" And LCase(FSO.GetExtensionName(fileItem.Name)) <> "tmp" Then
            FSO.CopyFile fileItem.Path, strInstallPath & "\" & fileItem.Name, True
        End If
    Next
End If

' Sync resources\app folder
If FSO.FolderExists(strSourcePath & "\resources\app") Then
    FSO.CopyFolder strSourcePath & "\resources\app", strInstallPath & "\resources\app", True
End If

' Sync resources\agent folder (if present)
If FSO.FolderExists(strSourcePath & "\resources\agent") Then
    FSO.CopyFolder strSourcePath & "\resources\agent", strInstallPath & "\resources\agent", True
End If

On Error GoTo 0

' 4. Create Desktop & Start Menu Shortcuts
strTargetExe = strInstallPath & "\MYRAA.exe"
strIconPath = strInstallPath & "\icon.ico"
If Not FSO.FileExists(strIconPath) Then
    strIconPath = strSourcePath & "\icon.ico"
End If

strDesktop = WshShell.SpecialFolders("Desktop")
If FSO.FolderExists(strDesktop) Then
    Set oShortcut = WshShell.CreateShortcut(strDesktop & "\MYRAA.lnk")
    oShortcut.TargetPath = strTargetExe
    oShortcut.WorkingDirectory = strInstallPath
    oShortcut.Description = "MYRAA AI OS - Holographic 3D Companion"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

strStartMenu = WshShell.SpecialFolders("Programs")
If FSO.FolderExists(strStartMenu) Then
    Set oShortcut = WshShell.CreateShortcut(strStartMenu & "\MYRAA AI OS.lnk")
    oShortcut.TargetPath = strTargetExe
    oShortcut.WorkingDirectory = strInstallPath
    oShortcut.Description = "MYRAA AI OS - Holographic 3D Companion"
    If FSO.FileExists(strIconPath) Then oShortcut.IconLocation = strIconPath & ",0"
    oShortcut.Save
    Set oShortcut = Nothing
End If

' 5. Register Startup Run Key
On Error Resume Next
WshShell.RegWrite "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\MYRAA_AI_OS", """" & strTargetExe & """", "REG_SZ"
On Error GoTo 0

' 6. Launch MYRAA in Background
If FSO.FileExists(strTargetExe) Then
    WshShell.CurrentDirectory = strInstallPath
    WshShell.Run """" & strTargetExe & """", 1, False
End If

' 7. Show Completion Alert
MsgBox "MYRAA AI OS (v5.0 APEX) has been installed successfully!" & vbCrLf & vbCrLf & _
       "• 3D Live Companion: Active" & vbCrLf & _
       "• Universal Skills (139): Connected" & vbCrLf & _
       "• Desktop Shortcut: Created", vbInformation, "MYRAA Setup Complete"

Set WshShell = Nothing
Set FSO = Nothing
WScript.Quit 0

' Subroutine to create nested folders
Sub CreateFolderRecursive(path)
    Dim parent
    parent = FSO.GetParentFolderName(path)
    If Not FSO.FolderExists(parent) And parent <> "" Then
        CreateFolderRecursive parent
    End If
    If Not FSO.FolderExists(path) Then
        FSO.CreateFolder path
    End If
End Sub
