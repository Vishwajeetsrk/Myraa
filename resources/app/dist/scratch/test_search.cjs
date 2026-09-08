const { execSync } = require('child_process');

function runPowerShell(script, timeoutMs = 12000) {
  const fullScript = `$ProgressPreference = 'SilentlyContinue';\n` + script;
  const b64 = Buffer.from(fullScript, 'utf16le').toString('base64');
  const out = execSync(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${b64}`, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true
  }).trim();
  return out.replace(/#<\s*CLIXML[\s\S]*?<\/Objs>/g, '').trim();
}

function searchFilesFuzzy(query, maxResults = 10) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Empty query', results: [] };

  const stopWords = new Set([
    'find', 'search', 'get', 'locate', 'show', 'open', 'my', 'me', 'the', 'a', 'an',
    'file', 'files', 'document', 'documents', 'doc', 'docx', 'pdf', 'please', 'folder', 'where', 'is'
  ]);
  const tokens = q.toLowerCase().replace(/[^a-z0-9\s_-]/g, ' ').split(/\s+/).filter(w => w && !stopWords.has(w));
  const effectiveTokens = tokens.length > 0 ? tokens : [q.toLowerCase().trim()];
  const primaryToken = effectiveTokens[0];

  const script = `
$searchRoots = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:USERPROFILE 'OneDrive\\Desktop'),
  [Environment]::GetFolderPath('MyDocuments'),
  (Join-Path $env:USERPROFILE 'Downloads'),
  'D:\\Team of Vishwajeet'
)
$results = @()
foreach ($root in $searchRoots) {
  if (Test-Path $root) {
    $found = Get-ChildItem -Path $root -Filter '*${primaryToken}*' -Recurse -Depth 4 -ErrorAction SilentlyContinue |
      Select-Object -First ${maxResults} FullName, Name, Length, LastWriteTime
    if ($found) { $results += $found }
  }
}
$results | Select-Object -First ${maxResults} | ConvertTo-Json -Compress
`;

  const res = runPowerShell(script, 15000);
  try {
    const parsed = JSON.parse(res);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const results = list.map(f => {
      let score = 50;
      const lowerName = (f.Name || '').toLowerCase();
      if (lowerName === q.toLowerCase()) score = 100;
      else if (lowerName.includes(primaryToken)) score = 80;
      else score = 60;
      return {
        path: f.FullName,
        name: f.Name,
        size: f.Length,
        modified: f.LastWriteTime,
        score
      };
    }).sort((a, b) => b.score - a.score);

    return {
      ok: true,
      query: q,
      matchedToken: primaryToken,
      count: results.length,
      isAmbiguous: results.length > 1,
      results
    };
  } catch (err) {
    return { ok: true, query: q, count: 0, results: [] };
  }
}

const r = searchFilesFuzzy('find my portfolio file');
console.log('SEARCH RESULTS:', JSON.stringify(r, null, 2));
