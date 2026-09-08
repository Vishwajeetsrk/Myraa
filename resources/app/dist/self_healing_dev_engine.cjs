/**
 * =============================================================================
 * MYRAA AI OS — Self-Healing Developer & Project Builder Engine
 * =============================================================================
 * Inspired by Brahma-AI (actions/dev_agent.py + actions/code_helper.py):
 *   - Autonomous Multi-File Architecture Planning & Generation
 *   - Auto-spawns VS Code editor workspace
 *   - Native Interpreter Execution (Node, Python, TS, PowerShell)
 *   - Automated Traceback Analysis & Culprit File Isolation
 *   - Iterative Self-Healing Repair Loop (Up to 4 fix attempts)
 *   - Integrated with Graft AST blast-radius checking
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const modelRouter = require('./model_router.cjs');
let graftEngine = null;
try { graftEngine = require('./graft_engine.cjs'); } catch (e) {}

const PROJECTS_ROOT = path.resolve(__dirname, '..', '..', 'Projects');

class SelfHealingDevEngine {
  constructor() {
    if (!fs.existsSync(PROJECTS_ROOT)) {
      try { fs.mkdirSync(PROJECTS_ROOT, { recursive: true }); } catch (e) {}
    }
  }

  /**
   * Determine interpreter for a file extension
   */
  getInterpreter(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        return { cmd: 'node', args: [filePath] };
      case '.py':
        return { cmd: 'python', args: [filePath] };
      case '.ts':
        return { cmd: 'npx', args: ['ts-node', filePath] };
      case '.ps1':
        return { cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', filePath] };
      default:
        return null;
    }
  }

  /**
   * Checks if process stdout/stderr contains error signals
   */
  hasError(output) {
    const signals = [
      'error', 'exception', 'traceback', 'syntaxerror', 'typeerror',
      'referenceerror', 'cannot find module', 'failed', 'fatal', 'modulenotfounderror'
    ];
    const lower = output.toLowerCase();
    return signals.some(s => lower.includes(s));
  }

  /**
   * Identifies which project file threw the exception from traceback text
   */
  identifyErrorFile(errorText, fileList) {
    for (const f of fileList) {
      const base = path.basename(f);
      if (errorText.includes(base) || errorText.includes(f)) {
        return f;
      }
    }
    return fileList[0] || null;
  }

  /**
   * Plan and scaffold project architecture via Gemini / ModelRouter
   */
  async planProject(goal, options = {}) {
    const prompt = `You are the MYRAA Master Developer Agent.
Plan a complete, production-ready, self-contained multi-file software project to fulfill this goal:
"${goal}"

Return ONLY valid JSON with this exact schema:
{
  "projectName": "sanitized_project_name",
  "entryPoint": "index.js",
  "files": [
    {
      "path": "index.js",
      "content": "...full runnable code..."
    },
    {
      "path": "utils.js",
      "content": "...full runnable code..."
    }
  ]
}`;

    const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
      temperature: 0.2
    });

    let plan;
    try {
      const jsonMatch = res.text.match(/\{[\s\S]*\}/);
      plan = JSON.parse(jsonMatch[0]);
    } catch (err) {
      // Fallback simple plan
      plan = {
        projectName: `myraa_app_${Date.now()}`,
        entryPoint: 'index.js',
        files: [
          {
            path: 'index.js',
            content: `// ${goal}\nconsole.log("App initialized for: ${goal}");\n`
          }
        ]
      };
    }
    return plan;
  }

  /**
   * Executes a file with timeout and captures output
   */
  executeFile(filePath, cwd, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const inter = this.getInterpreter(filePath);
      if (!inter) {
        return resolve({ ok: true, output: 'No execution runtime configured for this file type' });
      }

      let stdout = '';
      let stderr = '';
      let finished = false;

      const proc = spawn(inter.cmd, inter.args, {
        cwd,
        shell: true,
        windowsHide: true
      });

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try { proc.kill(); } catch (e) {}
          resolve({ ok: false, timedOut: true, output: (stdout + '\n' + stderr).trim() || 'Execution timed out' });
        }
      }, timeoutMs);

      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('close', code => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          const fullOut = (stdout + '\n' + stderr).trim();
          resolve({ ok: code === 0, code, output: fullOut });
        }
      });

      proc.on('error', err => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve({ ok: false, output: err.message });
        }
      });
    });
  }

  /**
   * Ask AI to fix culprit file based on traceback error
   */
  async fixBrokenFile(filePath, content, errorOutput, blastContext = '') {
    const prompt = `You are the MYRAA Self-Healing Developer.
The file "${path.basename(filePath)}" produced an error during test execution:

=== ERROR TRACEBACK ===
${errorOutput.slice(0, 1200)}

=== EXISTING FILE CONTENT ===
${content}
${blastContext ? `\n=== CODEBASE BLAST RADIUS (DO NOT BREAK THESE CALLERS) ===\n${blastContext}` : ''}

Fix the issue cleanly so the file runs with 0 errors.
Return ONLY the raw updated code of the file. Do not include markdown blocks or conversational preamble.`;

    const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
      temperature: 0.1
    });

    let fixedCode = res.text.trim();
    fixedCode = fixedCode.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    return fixedCode;
  }

  /**
   * Full Brahma-style Dev Loop:
   * Plan -> Write Files -> Open VSCode -> Run Entrypoint -> Catch Error -> Fix -> Retry
   */
  async buildAndSelfHeal(goal, options = {}) {
    const maxAttempts = options.maxAttempts || 4;
    const plan = await this.planProject(goal, options);
    const projectName = options.projectName || plan.projectName || `project_${Date.now()}`;
    const projectDir = path.join(PROJECTS_ROOT, projectName);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // 1. Write initial files
    const writtenFiles = [];
    for (const f of plan.files) {
      const fullPath = path.join(projectDir, f.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, f.content, 'utf8');
      writtenFiles.push(fullPath);
    }

    // 2. Open in VS Code
    if (options.openEditor !== false) {
      try {
        exec(`code "${projectDir}"`, () => {});
      } catch (e) {}
    }

    const entryPath = path.join(projectDir, plan.entryPoint || 'index.js');
    const logs = [];
    let currentAttempt = 1;
    let success = false;

    // 3. Self-healing loop
    while (currentAttempt <= maxAttempts) {
      logs.push(`Attempt ${currentAttempt}/${maxAttempts}: Executing ${plan.entryPoint}...`);
      const runResult = await this.executeFile(entryPath, projectDir);

      if (runResult.ok && !this.hasError(runResult.output)) {
        logs.push(`✅ Execution verified with 0 errors on attempt ${currentAttempt}! Output:\n${runResult.output}`);
        success = true;
        break;
      }

      logs.push(`⚠️ Error encountered on attempt ${currentAttempt}:\n${runResult.output.slice(0, 400)}`);

      if (currentAttempt === maxAttempts) {
        logs.push(`❌ Reached maximum repair attempts (${maxAttempts}).`);
        break;
      }

      // Identify which file broke
      const culpritPath = this.identifyErrorFile(runResult.output, writtenFiles) || entryPath;
      logs.push(`🔍 Isolated culprit file: ${path.basename(culpritPath)}. Applying AI self-healing fix...`);

      let culpritContent = '';
      try { culpritContent = fs.readFileSync(culpritPath, 'utf8'); } catch (e) {}

      // Optional Graft blast-radius analysis
      let blastContext = '';
      if (graftEngine) {
        try {
          const symName = path.basename(culpritPath, path.extname(culpritPath));
          const trace = graftEngine.traceCalls(symName, { depth: 1, repoPath: projectDir });
          if (trace.affectedFiles.length > 0) {
            blastContext = `Callers depending on this module: ${trace.affectedFiles.join(', ')}`;
          }
        } catch (e) {}
      }

      const repairedCode = await this.fixBrokenFile(culpritPath, culpritContent, runResult.output, blastContext);
      fs.writeFileSync(culpritPath, repairedCode, 'utf8');
      logs.push(`🔧 Applied repair to ${path.basename(culpritPath)}. Re-running...`);

      currentAttempt++;
    }

    return {
      ok: success,
      projectName,
      projectDir,
      entryPoint: plan.entryPoint,
      filesCreated: plan.files.map(f => f.path),
      attempts: currentAttempt,
      status: success ? 'SUCCESS' : 'FAILED_AFTER_RETRIES',
      logs
    };
  }
}

module.exports = new SelfHealingDevEngine();
