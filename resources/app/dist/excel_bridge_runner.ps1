param(
  [Parameter(Mandatory = $true)][string]$Command,
  [string]$ArgsB64 = ''
)

# =============================================================================
# MYRAA Excel COM Bridge
# =============================================================================
# Live control of a RUNNING Microsoft Excel instance through COM.
#
# Safety contract:
#   - Never starts Excel silently for a write. Missing state is reported.
#   - Every operation targets a resolved workbook; ambiguous names fail closed.
#   - delete-sheet / delete-rows / close require confirm = true.
#   - DisplayAlerts and ScreenUpdating are restored in a finally block.
#   - Never calls Excel.Quit(); the user's other workbooks stay open.
#   - Arguments arrive as base64 JSON, so no value is interpolated into code.
#
# This complements excel_intelligence.cjs (openpyxl file analysis). It does
# not replace it: that engine reads/writes .xlsx files offline, this one drives
# the live application the user is looking at.
# =============================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Result($obj) {
  $obj | ConvertTo-Json -Depth 12 -Compress
}

function Write-Failure($code, $message, $extra = $null) {
  $out = @{ ok = $false; code = $code; error = $message }
  if ($extra -ne $null) {
    foreach ($k in $extra.Keys) { $out[$k] = $extra[$k] }
  }
  Write-Result $out
  exit 0
}

$argsObj = $null
if ($ArgsB64) {
  try {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ArgsB64))
    if ($json.Trim()) { $argsObj = $json | ConvertFrom-Json }
  } catch {
    Write-Failure 'VALIDATION' ('Invalid arguments payload: ' + $_.Exception.Message)
  }
}

function Arg($name, $default = $null) {
  if ($argsObj -ne $null) {
    $props = $argsObj.PSObject.Properties.Name
    if ($props -contains $name) {
      $v = $argsObj.$name
      if ($v -ne $null) { return $v }
    }
  }
  return $default
}

function ArgBool($name, $default = $false) {
  $v = Arg $name $null
  if ($v -eq $null) { return $default }
  if ($v -is [bool]) { return $v }
  return ([string]$v).ToLowerInvariant() -in @('1', 'true', 'yes', 'on')
}

function Get-ExcelApp([bool]$allowStart = $false) {
  $excel = $null
  try {
    $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
  } catch {
    $excel = $null
  }
  if ($excel -eq $null -and $allowStart) {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $true
  }
  if ($excel -ne $null) {
    # Suppress modal prompts for the duration of this call, then restore the
    # user's original setting in the finally block. A prompt left unanswered
    # would hang the whole automation call.
    try { $script:originalAlerts = [bool]$excel.DisplayAlerts } catch { }
    try { $excel.DisplayAlerts = $false } catch { }
  }
  return $excel
}

function Resolve-Workbook($excel, $name) {
  $count = 0
  try { $count = [int]$excel.Workbooks.Count } catch {
    return @{ ok = $false; code = 'EXCEL_BUSY'; error = 'Excel did not answer. Close any open dialog and retry.' }
  }
  if ($count -eq 0) {
    return @{ ok = $false; code = 'NO_WORKBOOK'; error = 'Excel is running but no workbook is open.' }
  }

  $list = @()
  foreach ($wb in $excel.Workbooks) { $list += $wb }

  if ([string]::IsNullOrWhiteSpace($name)) {
    try { return @{ ok = $true; workbook = $excel.ActiveWorkbook; resolvedBy = 'active' } }
    catch { return @{ ok = $false; code = 'NO_ACTIVE_WORKBOOK'; error = 'Excel has no active workbook.' } }
  }

  $needle = ([string]$name).ToLowerInvariant()
  $exact = @()
  foreach ($wb in $list) {
    if (([string]$wb.Name).ToLowerInvariant() -eq $needle -or ([string]$wb.FullName).ToLowerInvariant() -eq $needle) { $exact += $wb }
  }
  if ($exact.Count -eq 1) { return @{ ok = $true; workbook = $exact[0]; resolvedBy = 'exact' } }
  if ($exact.Count -gt 1) {
    return @{ ok = $false; code = 'AMBIGUOUS'; error = 'Multiple workbooks match exactly.'; candidates = @($exact | ForEach-Object { $_.Name }) }
  }

  $partial = @()
  foreach ($wb in $list) {
    $n = ([string]$wb.Name).ToLowerInvariant()
    $f = ([string]$wb.FullName).ToLowerInvariant()
    if ($n.Contains($needle) -or $f.Contains($needle)) { $partial += $wb }
  }
  if ($partial.Count -eq 1) { return @{ ok = $true; workbook = $partial[0]; resolvedBy = 'partial' } }
  if ($partial.Count -gt 1) {
    return @{ ok = $false; code = 'AMBIGUOUS'; error = 'Multiple workbooks match that name.'; candidates = @($partial | ForEach-Object { $_.Name }) }
  }
  return @{
    ok = $false
    code = 'WORKBOOK_NOT_FOUND'
    error = ('No open workbook matches "' + [string]$name + '".')
    candidates = @($list | ForEach-Object { $_.Name })
  }
}

function Resolve-Sheet($wb, $name) {
  if ([string]::IsNullOrWhiteSpace($name)) {
    try { return @{ ok = $true; sheet = $wb.ActiveSheet; resolvedBy = 'active' } }
    catch { return @{ ok = $false; code = 'NO_ACTIVE_SHEET'; error = 'Workbook has no active sheet.' } }
  }
  $needle = ([string]$name).ToLowerInvariant()
  $list = @()
  foreach ($ws in $wb.Worksheets) { $list += $ws }

  foreach ($ws in $list) {
    if (([string]$ws.Name).ToLowerInvariant() -eq $needle) { return @{ ok = $true; sheet = $ws; resolvedBy = 'exact' } }
  }
  $partial = @()
  foreach ($ws in $list) {
    if (([string]$ws.Name).ToLowerInvariant().Contains($needle)) { $partial += $ws }
  }
  if ($partial.Count -eq 1) { return @{ ok = $true; sheet = $partial[0]; resolvedBy = 'partial' } }
  if ($partial.Count -gt 1) {
    return @{ ok = $false; code = 'AMBIGUOUS'; error = 'Multiple sheets match that name.'; candidates = @($partial | ForEach-Object { $_.Name }) }
  }
  return @{
    ok = $false
    code = 'SHEET_NOT_FOUND'
    error = ('No sheet matches "' + [string]$name + '".')
    candidates = @($list | ForEach-Object { $_.Name })
  }
}

function Workbook-Info($wb) {
  $sheets = @()
  foreach ($ws in $wb.Worksheets) {
    $used = ''
    try { $used = [string]$ws.UsedRange.Address($false, $false) } catch { $used = '' }
    $sheets += @{ name = [string]$ws.Name; visible = ([int]$ws.Visible -eq -1); usedRange = $used }
  }
  $path = ''
  try { $path = [string]$wb.FullName } catch { $path = '' }
  $saved = $true
  try { $saved = [bool]$wb.Saved } catch { $saved = $true }
  $activeName = ''
  try { $activeName = [string]$wb.ActiveSheet.Name } catch { $activeName = '' }
  return @{
    name = [string]$wb.Name
    fullName = $path
    saved = $saved
    sheetCount = $sheets.Count
    activeSheet = $activeName
    sheets = $sheets
  }
}

function Set-2DProperty($target, $key, $range, $raw) {
  # PowerShell unrolls a single-element array returned from a function, so the
  # grid is built with ArrayList and assigned directly into the hashtable key.
  $rows = [int]$range.Rows.Count
  $cols = [int]$range.Columns.Count
  $grid = New-Object System.Collections.ArrayList
  $isArray = ($raw -is [System.Array])
  for ($r = 1; $r -le $rows; $r++) {
    $row = New-Object System.Collections.ArrayList
    if ($rows -eq 1 -and $cols -eq 1) {
      [void]$row.Add($raw)
    } elseif (-not $isArray) {
      # Excel returns a scalar when every cell in the range has the same value
      # or format (for example NumberFormat = "General"). Propagate it.
      for ($c = 1; $c -le $cols; $c++) { [void]$row.Add($raw) }
    } else {
      for ($c = 1; $c -le $cols; $c++) { [void]$row.Add(($raw[$r, $c])) }
    }
    [void]$grid.Add($row)
  }
  $target[$key] = $grid
}

function Set-CellPropertyGrid($target, $key, $range, $property) {
  # Excel returns System.DBNull for Range.Text and Range.NumberFormat when the
  # range has more than one cell. Read those properties cell by cell so the
  # optional flags return real values instead of silent nulls.
  $rows = [int]$range.Rows.Count
  $cols = [int]$range.Columns.Count
  $grid = New-Object System.Collections.ArrayList
  for ($r = 1; $r -le $rows; $r++) {
    $row = New-Object System.Collections.ArrayList
    for ($c = 1; $c -le $cols; $c++) {
      $cell = $range.Cells.Item($r, $c)
      [void]$row.Add([string]$cell.$property)
    }
    [void]$grid.Add($row)
  }
  $target[$key] = $grid
}

function Hex-ToOleColor($hex) {
  $h = ([string]$hex).Trim().TrimStart('#')
  if ($h.Length -ne 6) { return $null }
  try {
    $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
    return ($r + ($g * 256) + ($b * 65536))
  } catch { return $null }
}

function File-Format($path) {
  $ext = [IO.Path]::GetExtension([string]$path).ToLowerInvariant()
  switch ($ext) {
    '.xlsx' { return 51 }
    '.xlsm' { return 52 }
    '.xlsb' { return 50 }
    '.xls' { return 56 }
    '.csv' { return 6 }
    default { return 51 }
  }
}

function Resolve-Target($excel, [bool]$requireSheet = $true) {
  $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
  if (-not $wbr.ok) { return $wbr }
  $wb = $wbr.workbook
  if (-not $requireSheet) {
    return @{ ok = $true; workbook = $wb; resolvedBy = $wbr.resolvedBy }
  }
  $sr = Resolve-Sheet $wb (Arg 'sheet' '')
  if (-not $sr.ok) {
    $sr['workbook'] = [string]$wb.Name
    return $sr
  }
  return @{ ok = $true; workbook = $wb; sheet = $sr.sheet; resolvedBy = $wbr.resolvedBy; sheetResolvedBy = $sr.resolvedBy }
}

$excel = $null
$startedExcel = $false
$originalAlerts = $null
$originalScreenUpdating = $null

try {
  switch ($Command) {

    'status' {
      $procCount = @(Get-Process -Name EXCEL -ErrorAction SilentlyContinue).Count
      $excel = Get-ExcelApp $false
      $attached = ($excel -ne $null)
      $result = @{
        ok = $true
        command = 'status'
        excelProcessCount = $procCount
        comAttached = $attached
        canControl = $false
      }
      if ($attached) {
        try {
          $result.version = [string]$excel.Version
          $result.workbookCount = [int]$excel.Workbooks.Count
          $result.visible = [bool]$excel.Visible
          if ($result.workbookCount -gt 0) {
            $result.activeWorkbook = [string]$excel.ActiveWorkbook.Name
            $result.activeSheet = [string]$excel.ActiveSheet.Name
          }
          $result.canControl = $true
        } catch {
          $result.code = 'EXCEL_BUSY'
          $result.error = 'Excel is running but did not answer a basic query.'
        }
      } else {
        $result.code = 'EXCEL_NOT_ATTACHED'
        $result.error = if ($procCount -gt 0) {
          'Excel is running but is not registered for COM automation. It may be running elevated or busy in a dialog.'
        } else {
          'Microsoft Excel is not running.'
        }
        $result.hint = 'Open a workbook in Excel, or POST /api/excel/workbook/open with a file path.'
      }
      Write-Result $result
      exit 0
    }

    'workbooks' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) {
        Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.'
      }
      $list = @()
      foreach ($wb in $excel.Workbooks) { $list += (Workbook-Info $wb) }
      Write-Result @{ ok = $true; command = 'workbooks'; count = $list.Count; workbooks = $list }
      exit 0
    }

    'info' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $wb = $t.workbook
      $ws = $t.sheet
      $info = Workbook-Info $wb
      $used = ''
      try { $used = [string]$ws.UsedRange.Address($false, $false) } catch { $used = '' }
      $sel = ''
      try { $sel = [string]$excel.Selection.Address($false, $false) } catch { $sel = '' }
      $info['activeSheet'] = [string]$ws.Name
      $info['activeSheetUsedRange'] = $used
      $info['selection'] = $sel
      $info['resolvedBy'] = $t.resolvedBy
      $info['sheetResolvedBy'] = $t.sheetResolvedBy
      Write-Result (@{ ok = $true; command = 'info' } + $info)
      exit 0
    }

    'sheets' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $wb = $wbr.workbook
      $list = @()
      foreach ($ws in $wb.Worksheets) {
        $used = ''
        try { $used = [string]$ws.UsedRange.Address($false, $false) } catch { $used = '' }
        $list += @{ name = [string]$ws.Name; index = [int]$ws.Index; visible = ([int]$ws.Visible -eq -1); usedRange = $used }
      }
      $activeName = ''
      try { $activeName = [string]$wb.ActiveSheet.Name } catch { $activeName = '' }
      Write-Result @{ ok = $true; command = 'sheets'; workbook = [string]$wb.Name; count = $list.Count; activeSheet = $activeName; sheets = $list }
      exit 0
    }

    'read' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' 'A1')
      $range = $null
      try { $range = $ws.Range($addr) } catch {
        Write-Failure 'VALIDATION' ('Invalid range "' + $addr + '": ' + $_.Exception.Message)
      }
      $cells = [int]$range.Rows.Count * [int]$range.Columns.Count
      if ($cells -gt 20000) {
        Write-Failure 'RANGE_TOO_LARGE' ('Range has ' + $cells + ' cells; the limit is 20000. Narrow the range.')
      }
      $result = @{
        ok = $true
        command = 'read'
        workbook = [string]$t.workbook.Name
        sheet = [string]$ws.Name
        address = [string]$range.Address($false, $false)
        rows = [int]$range.Rows.Count
        cols = [int]$range.Columns.Count
      }
      Set-2DProperty $result 'values' $range $range.Value2
      if (ArgBool 'formulas' $false) { Set-2DProperty $result 'formulas' $range $range.Formula }
      if (ArgBool 'text' $false) { Set-CellPropertyGrid $result 'text' $range 'Text' }
      if (ArgBool 'formats' $false) { Set-CellPropertyGrid $result 'numberFormats' $range 'NumberFormat' }
      Write-Result $result
      exit 0
    }

    'write' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' 'A1')
      $vals = Arg 'values' $null
      if ($vals -eq $null) { Write-Failure 'VALIDATION' 'values is required.' }
      $asFormula = ArgBool 'asFormula' $false

      $range = $null
      try { $range = $ws.Range($addr) } catch {
        Write-Failure 'VALIDATION' ('Invalid range "' + $addr + '": ' + $_.Exception.Message)
      }

      if ($vals -is [System.Array]) {
        $rows = $vals.Count
        $cols = 0
        foreach ($r in $vals) {
          if ($r -is [System.Array]) { if ($r.Count -gt $cols) { $cols = $r.Count } }
          elseif ($cols -lt 1) { $cols = 1 }
        }
        if ($rows -lt 1 -or $cols -lt 1) { Write-Failure 'VALIDATION' 'values must be a non-empty array.' }
        $arr = New-Object 'object[,]' $rows, $cols
        for ($i = 0; $i -lt $rows; $i++) {
          $row = $vals[$i]
          if ($row -is [System.Array]) {
            for ($j = 0; $j -lt $row.Count; $j++) { $arr[$i, $j] = $row[$j] }
            for ($j = $row.Count; $j -lt $cols; $j++) { $arr[$i, $j] = $null }
          } else {
            $arr[$i, 0] = $row
          }
        }
        $target = $range.Resize($rows, $cols)
        if ($asFormula) { $target.Formula = $arr } else { $target.Value2 = $arr }
        Write-Result @{
          ok = $true; command = 'write'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name
          address = [string]$target.Address($false, $false); rows = $rows; cols = $cols; asFormula = $asFormula
        }
        exit 0
      }

      if ($asFormula) { $range.Formula = $vals } else { $range.Value2 = $vals }
      Write-Result @{
        ok = $true; command = 'write'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name
        address = [string]$range.Address($false, $false); rows = [int]$range.Rows.Count; cols = [int]$range.Columns.Count; asFormula = $asFormula
      }
      exit 0
    }

    'formula' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' 'A1')
      $f = [string](Arg 'formula' '')
      if (-not $f) { Write-Failure 'VALIDATION' 'formula is required.' }
      $range = $null
      try { $range = $ws.Range($addr) } catch {
        Write-Failure 'VALIDATION' ('Invalid range "' + $addr + '": ' + $_.Exception.Message)
      }
      $range.Formula = $f
      Write-Result @{ ok = $true; command = 'formula'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name; address = [string]$range.Address($false, $false); formula = [string]$range.Formula }
      exit 0
    }

    'format' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' 'A1')
      $range = $null
      try { $range = $ws.Range($addr) } catch {
        Write-Failure 'VALIDATION' ('Invalid range "' + $addr + '": ' + $_.Exception.Message)
      }
      $applied = @()

      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'bold') {
        $range.Font.Bold = [bool](ArgBool 'bold' $false); $applied += 'bold'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'italic') {
        $range.Font.Italic = [bool](ArgBool 'italic' $false); $applied += 'italic'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'fontSize') {
        $range.Font.Size = [double](Arg 'fontSize' 11); $applied += 'fontSize'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'fontName') {
        $range.Font.Name = [string](Arg 'fontName' 'Calibri'); $applied += 'fontName'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'numberFormat') {
        $range.NumberFormat = [string](Arg 'numberFormat' 'General'); $applied += 'numberFormat'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'wrapText') {
        $range.WrapText = [bool](ArgBool 'wrapText' $false); $applied += 'wrapText'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'columnWidth') {
        $range.ColumnWidth = [double](Arg 'columnWidth' 8.43); $applied += 'columnWidth'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'rowHeight') {
        $range.RowHeight = [double](Arg 'rowHeight' 15); $applied += 'rowHeight'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'fillColor') {
        $c = Hex-ToOleColor (Arg 'fillColor' '')
        if ($c -eq $null) { Write-Failure 'VALIDATION' 'fillColor must be a hex colour like #1F3864.' }
        $range.Interior.Color = $c; $applied += 'fillColor'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'fontColor') {
        $c = Hex-ToOleColor (Arg 'fontColor' '')
        if ($c -eq $null) { Write-Failure 'VALIDATION' 'fontColor must be a hex colour like #FFFFFF.' }
        $range.Font.Color = $c; $applied += 'fontColor'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'horizontalAlignment') {
        $a = ([string](Arg 'horizontalAlignment' 'general')).ToLowerInvariant()
        $map = @{ general = 1; left = -4131; center = -4108; right = -4152; fill = 5; justify = -4130 }
        if (-not $map.ContainsKey($a)) { Write-Failure 'VALIDATION' 'horizontalAlignment must be general, left, center, right, fill or justify.' }
        $range.HorizontalAlignment = $map[$a]; $applied += 'horizontalAlignment'
      }
      if ($argsObj -ne $null -and $argsObj.PSObject.Properties.Name -contains 'verticalAlignment') {
        $a = ([string](Arg 'verticalAlignment' 'center')).ToLowerInvariant()
        $map = @{ top = -4160; center = -4108; bottom = -4109; justify = -4130 }
        if (-not $map.ContainsKey($a)) { Write-Failure 'VALIDATION' 'verticalAlignment must be top, center, bottom or justify.' }
        $range.VerticalAlignment = $map[$a]; $applied += 'verticalAlignment'
      }
      if (ArgBool 'borders' $false) {
        foreach ($edge in @(7, 8, 9, 10, 11, 12)) {
          $b = $range.Borders.Item($edge)
          $b.LineStyle = 1
          $b.Weight = 2
        }
        $applied += 'borders'
      }

      if ($applied.Count -eq 0) {
        Write-Failure 'VALIDATION' 'No formatting option supplied. Pass at least one of: bold, italic, fontSize, fontName, numberFormat, wrapText, columnWidth, rowHeight, fillColor, fontColor, horizontalAlignment, verticalAlignment, borders.'
      }
      Write-Result @{ ok = $true; command = 'format'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name; address = [string]$range.Address($false, $false); applied = $applied }
      exit 0
    }

    'add-sheet' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $wb = $wbr.workbook
      $name = [string](Arg 'name' '')
      $after = Arg 'after' $null
      if ($after -ne $null) {
        $target = $null
        try { $target = $wb.Worksheets.Item([string]$after) } catch {
          Write-Failure 'SHEET_NOT_FOUND' ('No sheet named "' + [string]$after + '" to insert after.')
        }
        $ws = $wb.Worksheets.Add([Type]::Missing, $target)
      } else {
        $ws = $wb.Worksheets.Add()
      }
      if ($name) { $ws.Name = $name }
      Write-Result @{ ok = $true; command = 'add-sheet'; workbook = [string]$wb.Name; sheet = [string]$ws.Name; index = [int]$ws.Index }
      exit 0
    }

    'rename-sheet' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $newName = [string](Arg 'name' '')
      if (-not $newName) { Write-Failure 'VALIDATION' 'name is required.' }
      $old = [string]$t.sheet.Name
      try { $t.sheet.Name = $newName } catch {
        Write-Failure 'VALIDATION' ('Cannot rename sheet: ' + $_.Exception.Message)
      }
      Write-Result @{ ok = $true; command = 'rename-sheet'; workbook = [string]$t.workbook.Name; from = $old; to = [string]$t.sheet.Name }
      exit 0
    }

    'delete-sheet' {
      if (-not (ArgBool 'confirm' $false)) {
        Write-Failure 'APPROVAL_REQUIRED' 'Deleting a sheet requires confirm = true.'
      }
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $wb = $t.workbook
      $name = [string]$t.sheet.Name
      try { $t.sheet.Delete() } catch {
        Write-Failure 'DELETE_FAILED' ('Excel refused to delete the sheet: ' + $_.Exception.Message)
      }
      Write-Result @{ ok = $true; command = 'delete-sheet'; workbook = [string]$wb.Name; deleted = $name; sheetCount = [int]$wb.Worksheets.Count }
      exit 0
    }

    'insert-rows' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $at = [int](Arg 'at' 1)
      $count = [int](Arg 'count' 1)
      if ($at -lt 1 -or $count -lt 1) { Write-Failure 'VALIDATION' 'at and count must be positive integers.' }
      $end = $at + $count - 1
      $t.sheet.Rows("${at}:${end}").Insert() | Out-Null
      Write-Result @{ ok = $true; command = 'insert-rows'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; at = $at; count = $count }
      exit 0
    }

    'delete-rows' {
      if (-not (ArgBool 'confirm' $false)) {
        Write-Failure 'APPROVAL_REQUIRED' 'Deleting rows requires confirm = true.'
      }
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $at = [int](Arg 'at' 1)
      $count = [int](Arg 'count' 1)
      if ($at -lt 1 -or $count -lt 1) { Write-Failure 'VALIDATION' 'at and count must be positive integers.' }
      $end = $at + $count - 1
      $t.sheet.Rows("${at}:${end}").Delete() | Out-Null
      Write-Result @{ ok = $true; command = 'delete-rows'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; at = $at; count = $count }
      exit 0
    }

    'chart' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' '')
      if (-not $addr) { Write-Failure 'VALIDATION' 'range is required (the source data, e.g. A1:B10).' }
      $typeName = ([string](Arg 'type' 'column')).ToLowerInvariant()
      $types = @{ column = 51; bar = 57; line = 4; pie = 5; doughnut = -4120; area = 1; scatter = -4169; radar = -4151 }
      if (-not $types.ContainsKey($typeName)) {
        Write-Failure 'VALIDATION' 'type must be one of: column, bar, line, pie, doughnut, area, scatter, radar.'
      }
      $left = [double](Arg 'left' 320)
      $top = [double](Arg 'top' 20)
      $width = [double](Arg 'width' 520)
      $height = [double](Arg 'height' 320)
      $title = [string](Arg 'title' '')
      $shape = $ws.Shapes.AddChart2(-1, $types[$typeName], $left, $top, $width, $height)
      $chart = $shape.Chart
      $chart.SetSourceData($ws.Range($addr))
      if ($title) {
        $chart.HasTitle = $true
        $chart.ChartTitle.Text = $title
      }
      Write-Result @{ ok = $true; command = 'chart'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name; range = $addr; type = $typeName; chartName = [string]$shape.Name }
      exit 0
    }

    'selection' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $sel = $excel.Selection
      $addr = ''
      try {
        $addr = [string]$sel.Address($false, $false)
        [void]$sel.Value2
      } catch {
        Write-Failure 'NOT_A_RANGE' 'The current selection is not a cell range.'
      }
      $sheetName = ''
      try { $sheetName = [string]$sel.Worksheet.Name } catch { $sheetName = '' }
      $wbName = ''
      try { $wbName = [string]$excel.ActiveWorkbook.Name } catch { $wbName = '' }
      $result = @{
        ok = $true; command = 'selection'; workbook = $wbName; sheet = $sheetName; address = $addr
      }
      Set-2DProperty $result 'values' $sel $sel.Value2
      Write-Result $result
      exit 0
    }

    'recalculate' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $excel.Calculate()
      Write-Result @{ ok = $true; command = 'recalculate' }
      exit 0
    }

    'save' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $wb = $wbr.workbook
      $target = [string](Arg 'path' '')
      $wasSaved = $false
      try { $wasSaved = [bool]$wb.Saved } catch { $wasSaved = $false }
      if (-not $target) {
        if (-not $wasSaved) {
          $current = ''
          try { $current = [string]$wb.FullName } catch { $current = '' }
          if (-not $current) {
            Write-Failure 'NEEDS_PATH' 'This workbook has never been saved. Provide path to save it.'
          }
        }
        $wb.Save()
        Write-Result @{ ok = $true; command = 'save'; workbook = [string]$wb.Name; path = [string]$wb.FullName; saveAs = $false }
        exit 0
      }
      $fmt = File-Format $target
      $wb.SaveAs($target, $fmt)
      Write-Result @{ ok = $true; command = 'save'; workbook = [string]$wb.Name; path = [string]$wb.FullName; saveAs = $true; fileFormat = $fmt }
      exit 0
    }

    'open' {
      $target = [string](Arg 'path' '')
      if (-not $target) { Write-Failure 'VALIDATION' 'path is required.' }
      if (-not (Test-Path -LiteralPath $target)) { Write-Failure 'FILE_NOT_FOUND' ('No file at ' + $target) }
      $excel = Get-ExcelApp $true
      $readOnly = ArgBool 'readOnly' $false
      $wb = $excel.Workbooks.Open($target, 0, $readOnly)
      Write-Result @{ ok = $true; command = 'open'; workbook = [string]$wb.Name; path = [string]$wb.FullName; readOnly = $readOnly }
      exit 0
    }

    'create-workbook' {
      $target = [string](Arg 'path' '')
      $excel = Get-ExcelApp $true
      $wb = $excel.Workbooks.Add()
      if ($target) {
        $fmt = File-Format $target
        $wb.SaveAs($target, $fmt)
      }
      Write-Result @{ ok = $true; command = 'create-workbook'; workbook = [string]$wb.Name; path = [string]$wb.FullName; saved = [bool]$wb.Saved }
      exit 0
    }

    'close' {
      if (-not (ArgBool 'confirm' $false)) {
        Write-Failure 'APPROVAL_REQUIRED' 'Closing a workbook requires confirm = true.'
      }
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $wb = $wbr.workbook
      $saveChanges = ArgBool 'save' $false
      if ($saveChanges) {
        $current = ''
        try { $current = [string]$wb.FullName } catch { $current = '' }
        if (-not $current) { Write-Failure 'NEEDS_PATH' 'save = true needs a saved workbook, or use the save command with a path first.' }
      }
      $name = [string]$wb.Name
      $wb.Close($saveChanges)
      $remaining = 0
      try { $remaining = [int]$excel.Workbooks.Count } catch { $remaining = 0 }
      Write-Result @{ ok = $true; command = 'close'; closed = $name; saveChanges = $saveChanges; remainingWorkbooks = $remaining }
      exit 0
    }

    'sort' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' '')
      $key = [string](Arg 'key' '')
      if (-not $addr -or -not $key) { Write-Failure 'VALIDATION' 'range and key are required.' }
      $desc = ArgBool 'descending' $false
      $hasHeader = ArgBool 'header' $true
      $sort1 = $ws.Sort
      $sort1.SortFields.Clear()
      [void]$sort1.SortFields.Add($ws.Range($key), 0, $(if ($desc) { 2 } else { 1 }), [Type]::Missing, 0)
      $sort1.SetRange($ws.Range($addr))
      $sort1.Header = $(if ($hasHeader) { 1 } else { 2 })
      $sort1.Apply()
      Write-Result @{ ok = $true; command = 'sort'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name; range = $addr; key = $key; descending = $desc; header = $hasHeader }
      exit 0
    }

    'autofilter' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $ws = $t.sheet
      $addr = [string](Arg 'range' '')
      if (-not $addr) { Write-Failure 'VALIDATION' 'range is required.' }
      $rng = $ws.Range($addr)
      $field = Arg 'field' $null
      $criteria = [string](Arg 'criteria' '')
      if ($criteria -ne '' -and $field -ne $null) {
        [void]$rng.AutoFilter([int]$field, $criteria)
        $mode = 'applied'
      } else {
        [void]$rng.AutoFilter()
        $mode = 'cleared-or-toggled'
      }
      Write-Result @{ ok = $true; command = 'autofilter'; workbook = [string]$t.workbook.Name; sheet = [string]$ws.Name; range = $addr; criteria = $criteria; mode = $mode }
      exit 0
    }

    'tables' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $wb = $wbr.workbook
      $list = @()
      foreach ($ws in $wb.Worksheets) {
        foreach ($lo in $ws.ListObjects) {
          $list += @{ name = [string]$lo.Name; sheet = [string]$ws.Name; range = [string]$lo.Range.Address($false, $false); rows = [int]$lo.ListRows.Count; columns = [int]$lo.ListColumns.Count }
        }
      }
      Write-Result @{ ok = $true; command = 'tables'; workbook = [string]$wb.Name; count = $list.Count; tables = $list }
      exit 0
    }

    'create-table' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $addr = [string](Arg 'range' '')
      if (-not $addr) { Write-Failure 'VALIDATION' 'range is required.' }
      $name = [string](Arg 'name' '')
      $hasHeader = ArgBool 'header' $true
      $lo = $t.sheet.ListObjects.Add(1, $t.sheet.Range($addr), [Type]::Missing, $(if ($hasHeader) { 1 } else { 2 }))
      if ($name -ne '') { $lo.Name = $name }
      Write-Result @{ ok = $true; command = 'create-table'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; name = [string]$lo.Name; range = [string]$lo.Range.Address($false, $false) }
      exit 0
    }

    'named-ranges' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $wbr = Resolve-Workbook $excel (Arg 'workbook' '')
      if (-not $wbr.ok) { Write-Failure $wbr.code $wbr.error $wbr }
      $list = @()
      foreach ($n in $wbr.workbook.Names) { $list += @{ name = [string]$n.Name; refersTo = [string]$n.RefersTo } }
      Write-Result @{ ok = $true; command = 'named-ranges'; workbook = [string]$wbr.workbook.Name; count = $list.Count; names = $list }
      exit 0
    }

    'add-named-range' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $name = [string](Arg 'name' '')
      $addr = [string](Arg 'range' '')
      if (-not $name -or -not $addr) { Write-Failure 'VALIDATION' 'name and range are required.' }
      [void]$t.workbook.Names.Add($name, $t.sheet.Range($addr))
      Write-Result @{ ok = $true; command = 'add-named-range'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; name = $name; range = $addr }
      exit 0
    }

    'data-validation' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $addr = [string](Arg 'range' '')
      $values = [string](Arg 'values' '')
      if (-not $addr -or -not $values) { Write-Failure 'VALIDATION' 'range and values (comma separated list) are required.' }
      $v = $t.sheet.Range($addr).Validation
      $v.Delete()
      [void]$v.Add(3, 1, 1, $values, [Type]::Missing)
      $v.IgnoreBlank = $true
      Write-Result @{ ok = $true; command = 'data-validation'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; range = $addr; values = $values; type = 'list' }
      exit 0
    }

    'conditional-format' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $addr = [string](Arg 'range' '')
      if (-not $addr) { Write-Failure 'VALIDATION' 'range is required.' }
      $threshold = [string](Arg 'value' '0')
      $op = ([string](Arg 'operator' 'greater')).ToLowerInvariant()
      $opConst = $(if ($op -eq 'less') { 6 } else { 5 })
      $cf = $t.sheet.Range($addr).FormatConditions.Add(1, $opConst, $threshold)
      $color = Hex-ToOleColor (Arg 'fillColor' '#FFC7CE')
      if ($color -ne $null) { $cf.Interior.Color = $color }
      Write-Result @{ ok = $true; command = 'conditional-format'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; range = $addr; operator = $op; value = $threshold }
      exit 0
    }

    'activate-sheet' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      [void]$t.sheet.Activate()
      Write-Result @{ ok = $true; command = 'activate-sheet'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name }
      exit 0
    }

    'insert-columns' {
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $at = [int](Arg 'at' 1)
      $count = [int](Arg 'count' 1)
      if ($at -lt 1 -or $count -lt 1) { Write-Failure 'VALIDATION' 'at and count must be positive integers.' }
      for ($col = $at + $count - 1; $col -ge $at; $col--) {
        [void]$t.sheet.Columns.Item($col).Insert()
      }
      Write-Result @{ ok = $true; command = 'insert-columns'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; at = $at; count = $count }
      exit 0
    }

    'delete-columns' {
      if (-not (ArgBool 'confirm' $false)) { Write-Failure 'APPROVAL_REQUIRED' 'Deleting columns requires confirm = true.' }
      $excel = Get-ExcelApp $false
      if ($excel -eq $null) { Write-Failure 'EXCEL_NOT_ATTACHED' 'Microsoft Excel is not running or not registered for COM automation.' }
      $t = Resolve-Target $excel $true
      if (-not $t.ok) { Write-Failure $t.code $t.error $t }
      $at = [int](Arg 'at' 1)
      $count = [int](Arg 'count' 1)
      if ($at -lt 1 -or $count -lt 1) { Write-Failure 'VALIDATION' 'at and count must be positive integers.' }
      for ($col = $at + $count - 1; $col -ge $at; $col--) {
        [void]$t.sheet.Columns.Item($col).Delete()
      }
      Write-Result @{ ok = $true; command = 'delete-columns'; workbook = [string]$t.workbook.Name; sheet = [string]$t.sheet.Name; at = $at; count = $count }
      exit 0
    }

    default {
      Write-Failure 'UNKNOWN_COMMAND' ('Unknown command "' + $Command + '".')
    }
  }
} catch {
  Write-Failure 'COM_ERROR' ($_.Exception.Message) @{ command = $Command }
} finally {
  if ($excel -ne $null) {
    if ($originalAlerts -ne $null) { try { $excel.DisplayAlerts = $originalAlerts } catch { } }
  }
}
