; MYRAA NSIS include — fixes double-nested directory from older installers.

!macro customInit
  ; Clean up stale double-nested dir left by older NSIS builds
  ; e.g. "C:\Program Files\MYRAA AI OS\MYRAA AI OS\" shouldn't exist
  RMDir /r "$PROGRAMFILES64\MYRAA AI OS\MYRAA AI OS"
!macroend
