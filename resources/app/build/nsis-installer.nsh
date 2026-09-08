; =============================================================================
; MYRAA AI — NSIS Installer Customization
; =============================================================================
; Professional installer: welcome page, upgrade detection, process management,
; data preservation, clean uninstall, repair support.
; =============================================================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "StrFunc.nsh"

; ── Custom Init ─────────────────────────────────────────────────────────────
!macro customInit
  ; Remove stale double-nested dirs from older installers (all known variants)
  RMDir /r "$PROGRAMFILES64\MYRAA AI OS\MYRAA AI OS"
  RMDir /r "$PROGRAMFILES64\MYRAA AI\MYRAA AI"
  RMDir /r "$PROGRAMFILES64\MYRAA\MYRAA"
  ; Also clean legacy portable-extracted-into-ProgramFiles case
  RMDir /r "$PROGRAMFILES64\MYRAA-Portable*"

  ; Detect running MYRAA processes before install/upgrade (both current + legacy names)
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq MYRAA.exe" /NH'
  Pop $0
  ${If} $0 == "0"
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "MYRAA is currently running.$\n$\nPlease close it before continuing the installation." \
      IDOK proceed_install IDCANCEL abort_install
    abort_install:
      Quit
    proceed_install:
      nsExec::ExecToStack 'taskkill /F /IM "MYRAA.exe" /T'
      Sleep 800
  ${Else}
    nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq MYRAA AI.exe" /NH'
    Pop $0
    ${If} $0 == "0"
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
        "MYRAA AI is currently running.$\n$\nPlease close it before continuing the installation." \
        IDOK proceed_install2 IDCANCEL abort_install2
      abort_install2:
        Quit
      proceed_install2:
        nsExec::ExecToStack 'taskkill /F /IM "MYRAA AI.exe" /T'
        Sleep 800
    ${EndIf}
  ${EndIf}

  ; Also check for the server process
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq node.exe" /NH | findstr /I "server.cjs"'
  Pop $0
  ${If} $0 == "0"
    nsExec::ExecToStack 'taskkill /F /IM "node.exe" /T /FI "WINDOWTITLE eq MYRAA*"'
    Sleep 500
  ${EndIf}
!macroend

; ── Custom Install (after files copied) ─────────────────────────────────────
!macro customInstall
  ; Create version marker for upgrade detection
  CreateDirectory "$INSTDIR"
  FileOpen $0 "$INSTDIR\.myraa-version" w
  FileWrite $0 "${VERSION}"
  FileClose $0

  ; Create data directory marker
  CreateDirectory "$APPDATA\MYRAA AI"
  CreateDirectory "$APPDATA\MYRAA AI\logs"

  ; Register application in Windows App Paths
  WriteRegStr HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\MYRAA AI.exe" "" "$INSTDIR\MYRAA AI.exe"
  WriteRegStr HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\MYRAA AI.exe" "Path" "$INSTDIR"

  ; Register in Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "DisplayName" "MYRAA AI"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "DisplayIcon" "$INSTDIR\MYRAA AI.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "Publisher" "MYRAA"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "URLInfoAbout" "https://github.com/vishwajeetsrk/Myraa"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "HelpLink" "https://github.com/vishwajeetsrk/Myraa/issues"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "NoRepair" 1

  ; Estimate install size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI" "EstimatedSize" "$0"

  ; Launch app after install (optional)
  MessageBox MB_YESNO "Installation complete! Launch MYRAA AI now?" IDNO skip_launch
    Exec '"$INSTDIR\MYRAA AI.exe"'
  skip_launch:
!macroend

; ── Custom UnInit (before uninstall) ────────────────────────────────────────
!macro customUnInit
  ; Kill running processes
  nsExec::ExecToStack 'taskkill /F /IM "MYRAA AI.exe" /T'
  nsExec::ExecToStack 'taskkill /F /IM "MYRAA-runtime.exe" /T'
  nsExec::ExecToStack 'taskkill /F /IM "node.exe" /T /FI "WINDOWTITLE eq MYRAA*"'
  Sleep 1000
!macroend

; ── Custom Uninstall (after files removed) ──────────────────────────────────
!macro customUnInstall
  ; Clean up registry
  DeleteRegKey HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\MYRAA AI.exe"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MYRAA AI"

  ; Remove version marker
  Delete "$INSTDIR\.myraa-version"

  ; Ask about user data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to keep your user data (settings, chat history, API keys)?" \
    IDYES keep_data IDNO remove_data

  keep_data:
    Goto done_uninstall

  remove_data:
    RMDir /r "$APPDATA\MYRAA AI"
    RMDir "$APPDATA\MYRAA AI"

  done_uninstall:

  ; Clean up Start Menu
  RMDir /r "$SMPROGRAMS\MYRAA AI"

  ; Clean up installation directory if empty
  RMDir "$INSTDIR"
!macroend
