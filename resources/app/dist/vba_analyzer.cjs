'use strict';
/**
 * MYRAA VBA Intelligence — static analysis of VBA source.
 *
 * This is deliberately deterministic: no model call, no execution, no claim
 * that a macro was run or verified in Excel. It explains, reviews, and, for a
 * narrow and well-understood class of recorded header macros, generates a
 * cleaner replacement. Anything outside that class is reported as NOT
 * generated with a reason instead of producing a broken rewrite.
 *
 * Scope:
 *   - explain(code)  : plain-language summary from real statements
 *   - review(code)   : severity-ranked findings with line evidence
 *   - improve(code)  : conservative rewrite only when pattern-matched
 *   - analyze(code)  : all three plus limitations
 */

const TYPOS = [
  ['onwer', 'owner'], ['recieve', 'receive'], ['occured', 'occurred'],
  ['seperate', 'separate'], ['adress', 'address'], ['lenght', 'length'],
  ['definately', 'definitely'], ['wich', 'which'], ['teh', 'the'],
  ['acount', 'account'], ['amnt', 'amount'], ['desription', 'description'],
  ['transation', 'transaction'], ['payemnt', 'payment'], ['custmer', 'customer'],
  ['emial', 'email'], ['sucess', 'success'], ['faild', 'failed'],
  ['initalize', 'initialize'], ['paramter', 'parameter'], ['retrun', 'return'],
  ['calcuate', 'calculate'], ['totl', 'total'], ['amout', 'amount'],
  ['balnce', 'balance'], ['invoce', 'invoice'], ['delievery', 'delivery'],
];

const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };

function linesOf(code) {
  return String(code == null ? '' : code).replace(/\r\n?/g, '\n').split('\n');
}

function add(findings, f) {
  findings.push(f);
}

function procedures(lines) {
  const result = [];
  let current = null;
  lines.forEach((line, idx) => {
    const start = line.match(/^\s*(?:(?:Public|Private|Friend)\s+)?(?:Static\s+)?(Sub|Function|Property\s+(?:Get|Let|Set))\s+([A-Za-z_]\w*)\s*(\([^\]]*\))?/i);
    if (start && !current) {
      current = { kind: start[1].replace(/\s+/g, ' '), name: start[2], startLine: idx + 1, endLine: null, body: [] };
      result.push(current);
      return;
    }
    if (/^\s*End\s+(?:Sub|Function|Property)\b/i.test(line)) {
      if (current) current.endLine = idx + 1;
      current = null;
      return;
    }
    if (current) current.body.push({ line: idx + 1, text: line });
  });
  for (const p of result) if (!p.endLine) p.endLine = lines.length;
  return result;
}

function executable(body) {
  return body.filter((b) => {
    const t = b.text.trim();
    return t && !t.startsWith("'") && !t.startsWith('Rem ');
  });
}

function countMatches(lines, re) {
  const hits = [];
  lines.forEach((line, i) => {
    if (re.test(line)) hits.push(i + 1);
    re.lastIndex = 0;
  });
  return hits;
}

function matchCase(text, wrong, right) {
  const re = new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
  return text.replace(re, (m) => {
    if (m === m.toUpperCase()) return right.toUpperCase();
    if (m[0] === m[0].toUpperCase()) return right[0].toUpperCase() + right.slice(1);
    return right;
  });
}

function correctTypos(text) {
  let out = String(text || '');
  for (const [wrong, right] of TYPOS) out = matchCase(out, wrong, right);
  return out;
}

function findTypos(lines) {
  const found = [];
  lines.forEach((line, i) => {
    for (const [wrong, right] of TYPOS) {
      const re = new RegExp('\\b' + wrong + '\\b', 'gi');
      if (re.test(line)) {
        found.push({ line: i + 1, found: wrong, suggested: right, evidence: line.trim().slice(0, 160) });
      }
      re.lastIndex = 0;
    }
  });
  return found;
}

function review(code) {
  const lines = linesOf(code);
  const text = lines.join('\n');
  const procs = procedures(lines);
  const findings = [];

  if (!/^\s*Option\s+Explicit\b/im.test(text)) {
    add(findings, {
      type: 'OPTION_EXPLICIT_MISSING', severity: 'Medium', line: null,
      message: 'Option Explicit is missing. Undeclared or misspelled variables become silent Variants.',
      recommendation: 'Add Option Explicit as the first line of the module, then declare every variable with As <type>.',
    });
  }

  const selects = countMatches(lines, /\.Select\b/i);
  if (selects.length) {
    add(findings, {
      type: 'SELECT_USAGE', severity: 'Medium', line: selects[0], lines: selects.slice(0, 12), count: selects.length,
      message: `Found ${selects.length} .Select call${selects.length === 1 ? '' : 's'}. Selection state is global and changes when the user clicks, so the macro can write to the wrong cell.`,
      recommendation: 'Hold a Worksheet/Range object reference and operate on it directly. Remove .Select and .Activate.',
    });
  }

  const activates = countMatches(lines, /\.Activate\b/i);
  if (activates.length) {
    add(findings, {
      type: 'ACTIVATE_USAGE', severity: 'Medium', line: activates[0], count: activates.length,
      message: `Found ${activates.length} .Activate call${activates.length === 1 ? '' : 's'}. Activating sheets or windows steals focus and depends on UI state.`,
      recommendation: 'Use object references instead of activating sheets, workbooks or windows.',
    });
  }

  const activeContext = countMatches(lines, /\b(?:ActiveCell|ActiveSheet|ActiveWorkbook|ActiveWindow|Selection)\b/i);
  if (activeContext.length) {
    add(findings, {
      type: 'IMPLICIT_ACTIVE_CONTEXT', severity: 'Medium', line: activeContext[0], count: activeContext.length,
      message: `Found ${activeContext.length} reference${activeContext.length === 1 ? '' : 's'} to ActiveCell/ActiveSheet/ActiveWorkbook/Selection. The target is decided at runtime by user focus.`,
      recommendation: 'Resolve an explicit worksheet (for example ThisWorkbook.Worksheets("Data")) and pass it in.',
    });
  }

  const r1c1Texts = [];
  lines.forEach((line, i) => {
    const m = line.match(/FormulaR1C1\s*=\s*"([^"]*)"/i);
    if (m && !m[1].startsWith('=')) r1c1Texts.push({ line: i + 1, value: m[1] });
  });
  if (r1c1Texts.length) {
    add(findings, {
      type: 'FORMULA_R1C1_FOR_LITERAL_TEXT', severity: 'Medium', line: r1c1Texts[0].line,
      count: r1c1Texts.length, examples: r1c1Texts.slice(0, 6),
      message: `${r1c1Texts.length} literal text value${r1c1Texts.length === 1 ? '' : 's'} assigned through FormulaR1C1. This is a macro-recorder artifact: text is being routed through the formula parser.`,
      recommendation: 'Assign literal text with .Value (or a Variant array to a whole range) and reserve .Formula for real formulas.',
    });
  }

  const repeatedFormats = countMatches(lines, /Selection\.NumberFormat\s*=/i);
  if (repeatedFormats.length >= 2) {
    add(findings, {
      type: 'REPEATED_SELECTION_FORMAT', severity: 'Low', line: repeatedFormats[0], count: repeatedFormats.length,
      message: `The same Selection.NumberFormat assignment is repeated ${repeatedFormats.length} times.`,
      recommendation: 'Apply NumberFormat once to the whole target range.',
    });
  }

  const typos = findTypos(lines);
  for (const t of typos) {
    add(findings, {
      type: 'LIKELY_SPELLING', severity: 'Low', line: t.line, found: t.found, suggested: t.suggested,
      message: `Possible typo "${t.found}" on line ${t.line}; did you mean "${t.suggested}"?`,
      evidence: t.evidence,
      recommendation: `Replace with "${t.suggested}" if that is the intended label.`,
    });
  }

  const ranges = countMatches(lines, /Range\s*\(\s*"[^"]+"\s*\)/i);
  if (ranges.length >= 3) {
    add(findings, {
      type: 'HARDCODED_RANGE', severity: 'Low', line: ranges[0], count: ranges.length,
      message: `${ranges.length} hardcoded Range("...") addresses. Moving columns breaks the macro silently.`,
      recommendation: 'Use a named range, a Constant address, or discover the header row from the data.',
    });
  }

  const sheetIndex = countMatches(lines, /\b(?:Work sheets|Worksheets|Sheets)\s*\(\s*\d+\s*\)|\bSheets\s*\(\s*\d+\s*\)/i);
  if (sheetIndex.length) {
    add(findings, {
      type: 'SHEET_BY_INDEX', severity: 'Medium', line: sheetIndex[0], count: sheetIndex.length,
      message: 'A worksheet is addressed by numeric index. Reordering tabs changes the target.',
      recommendation: 'Address the sheet by name or by its CodeName.',
    });
  }

  const resumeNext = countMatches(lines, /On\s+Error\s+Resume\s+Next\b/i);
  const clearErrors = countMatches(lines, /On\s+Error\s+GoTo\s+0\b/i);
  if (resumeNext.length && !clearErrors.length) {
    add(findings, {
      type: 'BLIND_ERROR_SUPPRESSION', severity: 'High', line: resumeNext[0],
      message: 'On Error Resume Next has no matching On Error GoTo 0. Later failures will be hidden and the macro may report success after doing nothing.',
      recommendation: 'Use an error handler with a labelled exit, and re-enable errors with On Error GoTo 0 after the guarded statement.',
    });
  }

  const gotoLabels = countMatches(lines, /\bGoTo\s+[A-Za-z_]\w*/i);
  if (gotoLabels.length > 1) {
    add(findings, {
      type: 'GOTO_FLOW', severity: 'Low', line: gotoLabels[0], count: gotoLabels.length,
      message: `${gotoLabels.length} GoTo statements make the control flow harder to verify.`,
      recommendation: 'Prefer structured error handling and small helper procedures.',
    });
  }

  const msgboxes = countMatches(lines, /\bMsgBox\b/i);
  if (msgboxes.length) {
    add(findings, {
      type: 'MODAL_USER_INTERACTION', severity: 'Low', line: msgboxes[0], count: msgboxes.length,
      message: `${msgboxes.length} MsgBox call${msgboxes.length === 1 ? '' : 's'} can block an unattended run.`,
      recommendation: 'Log to Debug.Print or a worksheet log, and surface a message only when a person is expected to respond.',
    });
  }

  const external = countMatches(lines, /Workbooks\.Open\b|\[[^\]]+\.xlsm?\]/i);
  if (external.length) {
    add(findings, {
      type: 'EXTERNAL_WORKBOOK_LINK', severity: 'Medium', line: external[0], count: external.length,
      message: 'The macro touches an external workbook. Paths, availability and trust prompts can change.',
      recommendation: 'Validate the path, handle a missing workbook explicitly, and document the dependency.',
    });
  }

  const implicitVariants = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:Dim|Private|Public)\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*(?:'.*)?$/i);
    if (m) implicitVariants.push({ line: i + 1, declaration: m[1] });
  });
  if (implicitVariants.length) {
    add(findings, {
      type: 'IMPLICIT_VARIANT', severity: 'Low', line: implicitVariants[0].line, count: implicitVariants.length,
      examples: implicitVariants.slice(0, 5),
      message: `${implicitVariants.length} declaration${implicitVariants.length === 1 ? '' : 's'} have no As <type> clause and default to Variant.`,
      recommendation: 'Declare the concrete type so type errors surface at compile time.',
    });
  }

  for (const p of procs) {
    const stmts = executable(p.body);
    if (!stmts.length) continue;
    if (!p.body.some((b) => /On\s+Error\b/i.test(b.text))) {
      add(findings, {
        type: 'NO_ERROR_HANDLING', severity: 'Medium', line: p.startLine,
        message: `${p.kind} ${p.name} has no error handler. A failure leaves the sheet in a partially updated state.`,
        recommendation: 'Add On Error GoTo Fail, log Err.Number/Err.Description, and exit cleanly before the handler label.',
      });
    }
    if (!p.body.some((b) => /Debug\.Print|Log[A-Z]?\w*|WriteLine/i.test(b.text))) {
      add(findings, {
        type: 'NO_LOGGING', severity: 'Low', line: p.startLine,
        message: `${p.kind} ${p.name} produces no log entry, so a silent or partial run is hard to diagnose.`,
        recommendation: 'Record start, finish and failures with Debug.Print or a small logging helper.',
      });
    }
    const hasParams = /\([^)]*\S[^)]*\)/.test(p.body.length ? (lines[p.startLine - 1] || '') : '');
    if (hasParams && !p.body.some((b) => /^\s*If\b|\bIsMissing\b|\bIsNumeric\b|\bLen\s*\(/i.test(b.text))) {
      add(findings, {
        type: 'NO_INPUT_VALIDATION', severity: 'Low', line: p.startLine,
        message: `${p.kind} ${p.name} accepts arguments but does not validate them.`,
        recommendation: 'Check inputs before touching the workbook and fail with a clear message.',
      });
    }
  }

  findings.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (a.line || 0) - (b.line || 0));
  return {
    ok: true,
    method: 'deterministic static analysis (source not executed)',
    procedureCount: procs.length,
    procedures: procs.map((p) => ({ kind: p.kind, name: p.name, startLine: p.startLine, endLine: p.endLine, executableLines: executable(p.body).length })),
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {}),
    findings,
    typos,
  };
}

function explain(code) {
  const lines = linesOf(code);
  const procs = procedures(lines);
  const text = lines.join('\n');

  const labelMatches = [];
  lines.forEach((line, i) => {
    const m = line.match(/ActiveCell\.FormulaR1C1\s*=\s*"([^"]*)"/i) || line.match(/\.Value\s*=\s*"([^"]*)"/i);
    if (m) labelMatches.push({ line: i + 1, value: m[1] });
  });
  const rangeSelects = [];
  lines.forEach((line, i) => {
    const m = line.match(/Range\s*\(\s*"([^"]+)"\s*\)\s*\.Select/i);
    if (m) rangeSelects.push({ line: i + 1, address: m[1] });
  });
  const formats = countMatches(lines, /NumberFormat\s*=\s*"([^"]*)"/i);

  const clauses = [];
  if (rangeSelects.length) {
    clauses.push(`selects ${rangeSelects.length} cell range${rangeSelects.length === 1 ? '' : 's'} (${rangeSelects.slice(0, 6).map((r) => r.address).join(', ')}${rangeSelects.length > 6 ? ', ...' : ''})`);
  }
  if (labelMatches.length) {
    const labels = labelMatches.map((l) => correctTypos(l.value));
    clauses.push(`writes ${labels.length} text value${labels.length === 1 ? '' : 's'}: ${labels.map((v) => '"' + v + '"').join(', ')}`);
  }
  if (formats.length) clauses.push(`sets the number format ${formats.length} time${formats.length === 1 ? '' : 's'}`);
  if (/\bFor\s+Each\b|\bFor\s+\w+\s*=|Do\s+While|Do\s+Until/i.test(text)) clauses.push('loops over data');
  if (/\bIf\b/i.test(text)) clauses.push('makes conditional decisions');
  if (/\bWorkbooks\.Open\b/i.test(text)) clauses.push('opens another workbook');
  if (/\.Save\b|\.SaveAs\b/i.test(text)) clauses.push('saves the workbook');

  const summary = procs.length
    ? `${procs.map((p) => `${p.kind} ${p.name}`).join(' and ')} ${clauses.length ? clauses.join(', and ') : 'contains no recognised data-writing statements'}.`
    : (clauses.length ? `This snippet ${clauses.join(', and ')}.` : 'No VBA procedure was found in this snippet.');

  const targetNote = rangeSelects.length || /\bSelection\b|\bActiveCell\b/i.test(text)
    ? 'It targets whatever worksheet and cell happen to be active when it runs; it does not select an explicit workbook or sheet.'
    : 'No implicit active-sheet target was detected.';

  return {
    ok: true,
    summary,
    targetNote,
    evidence: { ranges: rangeSelects.slice(0, 12), labels: labelMatches.slice(0, 20), formatAssignments: formats.length },
    confidence: clauses.length >= 2 ? 'moderate' : 'low',
    method: 'rule-based reading of real statements; no execution',
  };
}

function columnOf(address) {
  const m = String(address || '').match(/^([A-Za-z]{1,3})(\d+)$/);
  if (!m) return null;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return { col: n, letters: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

function improve(code) {
  const lines = linesOf(code);
  const procs = procedures(lines);
  const rev = review(code);
  const reason = (r) => ({ ok: true, generated: false, code: null, reason: r, policy: 'A rewrite is generated only when the macro shape is fully understood. No broken or speculative code is emitted.' });

  if (procs.length !== 1 || procs[0].kind !== 'Sub') {
    return reason('Rewrite requires exactly one Sub with no other procedures.');
  }
  const p = procs[0];
  const stmts = executable(p.body).map((b) => ({ line: b.line, text: b.text.trim() }));
  if (stmts.length < 3) return reason('Too few statements to identify a recorded header macro.');
  if (stmts.some((s) => /^\s*(?:If|For|Do|While|Select\s+Case|On\s+Error|GoTo|Call|Set|With|End\s+With|Dim|Const)\b/i.test(s.text))) {
    return reason('The procedure contains control flow, declarations or object setup that a safe mechanical rewrite cannot preserve.');
  }

  const allowed = /^(?:Range\("[^"]+"\)\.Select|Selection\.NumberFormat\s*=\s*"[^"]*"|ActiveCell\.FormulaR1C1\s*=\s*"[^"]*")$/i;
  if (!stmts.every((s) => allowed.test(s.text))) {
    return reason('Statements outside the recognised Range/Selection/ActiveCell pattern were found; generating code would risk changing behaviour.');
  }

  const labels = [];
  const cells = [];
  let pendingCell = null;
  for (const s of stmts) {
    const sel = s.text.match(/^Range\("([^"]+)"\)\.Select$/i);
    if (sel) { pendingCell = columnOf(sel[1]); continue; }
    const lab = s.text.match(/^ActiveCell\.FormulaR1C1\s*=\s*"([^"]*)"$/i);
    if (lab && pendingCell) {
      labels.push(correctTypos(lab[1]));
      cells.push(pendingCell);
      pendingCell = null;
    }
  }
  if (labels.length < 2 || cells.length !== labels.length) {
    return reason('Could not identify a contiguous set of header cells and labels.');
  }
  const sameRow = cells.every((c) => c.row === cells[0].row);
  const contiguous = cells.every((c, i) => c.col === cells[0].col + i);
  if (!sameRow || !contiguous) {
    return reason('Header cells are not a single contiguous horizontal range; a one-shot array write would not be equivalent.');
  }
  const first = cells[0].letters + cells[0].row;
  const last = cells[cells.length - 1].letters + cells[cells.length - 1].row;
  const headerRange = first === last ? first : `${first}:${last}`;
  const safeName = p.name.replace(/[^A-Za-z0-9_]/g, '_');
  const corrected = rev.typos.map((t) => `${t.found} to ${t.suggested}`);

  const codeOut = [
    'Option Explicit',
    '',
    `Public Sub ${safeName}()`,
    `    Const HEADER_RANGE As String = "${headerRange}"`,
    '',
    '    Dim ws As Worksheet',
    '    Dim headers As Variant',
    '',
    '    On Error GoTo Fail',
    '',
    '    Set ws = ActiveSheet',
    '    headers = Array(',
    ...labels.map((v, i) => `        "${v.replace(/"/g, '""')}"${i < labels.length - 1 ? ',' : ''}`),
    '    )',
    '',
    '    With ws.Range(HEADER_RANGE)',
    '        .NumberFormat = "@"',
    '        .Value = headers',
    '    End With',
    '',
    `    Debug.Print "[" & Now & "] " & "${safeName}" & ": headers written to " & HEADER_RANGE`,
    '    Exit Sub',
    '',
    'Fail:',
    `    Debug.Print "[" & Now & "] ${safeName} failed: " & Err.Number & " - " & Err.Description`,
    'End Sub',
  ].join('\r\n');

  const whyImproved = [
    'Removed every .Select and the ActiveCell dependency, so the macro no longer writes to whichever cell the user last clicked.',
    `Replaced ${stmts.filter((s) => /NumberFormat/i.test(s.text)).length} repeated Selection.NumberFormat assignments with one assignment on the full range ${headerRange}.`,
    `Replaced ${labels.length} separate ActiveCell writes with one Variant array assigned to .Value, which is both faster and atomic from the caller's point of view.`,
    'Literal text now goes through .Value rather than FormulaR1C1, so Excel does not route labels through the formula parser.',
    'Added Option Explicit, typed declarations and an error handler with a Debug.Print log line, making failures visible instead of silent.',
    'Kept the rewrite inside a standard module using only core VBA statements and Array(), so it remains compatible with older .xls/.xlsm workbooks.',
  ];
  if (corrected.length) whyImproved.push(`Corrected spelling: ${corrected.join(', ')}.`);

  return {
    ok: true,
    generated: true,
    code: codeOut,
    source: 'recorded header macro',
    matchedRange: headerRange,
    labels,
    correctedSpelling: corrected,
    whyImproved,
    assumptions: [
      'The active worksheet is the intended target; pass a specific Worksheet explicitly if the target must be fixed.',
      'The header row is contiguous and starts at the first Range(...).Select in the macro.',
    ],
    verification: 'NOT_VERIFIED — generated source was statically checked here but was not executed in Excel.',
    compatibility: 'Core VBA only; no external references, no Office Scripts, no add-ins.',
  };
}

function analyze(code) {
  const summary = explain(code);
  const assessment = review(code);
  const rewrite = improve(code);
  return {
    ok: true,
    ...summary,
    review: {
      findingCount: assessment.findingCount,
      bySeverity: assessment.bySeverity,
      procedures: assessment.procedures,
      findings: assessment.findings,
      typos: assessment.typos,
    },
    improvement: rewrite,
    limitations: [
      'Static source analysis only: the macro was not executed, debugged or verified in Excel.',
      'The spelling dictionary is finite; a correction is a suggestion, not a confirmed error.',
      'Line references are from the supplied text; indentation and comments are preserved as evidence.',
      'This tool does not execute VBA, enable macros, change security settings, or open workbooks.',
    ],
  };
}

const STATUS = {
  ok: true,
  service: 'vba-intelligence',
  method: 'deterministic static analysis; no macro execution',
  capabilities: ['explain', 'review', 'improve', 'analyze'],
  rewritePolicy: 'Conservative: only a fully recognised recorded header macro is rewritten.',
  neverDoes: ['execute VBA', 'enable macros', 'change macro security', 'open or save workbooks'],
};

module.exports = { STATUS, explain, review, improve, analyze, correctTypos };
