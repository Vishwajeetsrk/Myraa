'use strict';
/**
 * coding_orchestrator.cjs — Master Coding Agent Orchestrator
 * MYRAA Coding Agent — Phase 5-7
 *
 * The unified coding loop: VOICE → INTENT → PROJECT DETECTION → MEMORY →
 * PLAN → SKILL SELECTION → TOOL SELECTION → CODE → RUN → TEST → OBSERVE →
 * DEBUG → PATCH → RETEST → REVIEW → MEMORY UPDATE → REPORT
 */

const fs = require('fs');
const path = require('path');

let gitService, projectDetection, testRunner, terminalRunner, modelRouter;
let graftEngine, memoryCore, developerEngine, selfHealingEngine;
let desktopAutomation, visualComputerControl;

function _lazyLoad() {
  const dist = path.join(__dirname);
  try { gitService = require(path.join(dist, 'git_service.cjs')); } catch {}
  try { projectDetection = require(path.join(dist, 'project_detection_service.cjs')); } catch {}
  try { testRunner = require(path.join(dist, 'test_runner_service.cjs')); } catch {}
  try { terminalRunner = require(path.join(dist, 'terminal_runner.cjs')); } catch {}
  try { modelRouter = require(path.join(dist, 'model_router.cjs')); } catch {}
  try { graftEngine = require(path.join(dist, 'graft_engine.cjs')); } catch {}
  try { memoryCore = require(path.join(dist, 'memory_core_service.cjs')); } catch {}
  try { developerEngine = require(path.join(dist, 'developer_engine.cjs')); } catch {}
  try { selfHealingEngine = require(path.join(dist, 'self_healing_dev_engine.cjs')); } catch {}
  try { desktopAutomation = require(path.join(dist, 'desktopAutomation.cjs')); } catch {}
  try { visualComputerControl = require(path.join(dist, 'visual_computer_control.cjs')); } catch {}
}
_lazyLoad();

// ── Intent Classification ────────────────────────────────────────────────────

const CODING_INTENTS = {
  create_project: /(?:create|build|make|scaffold|generate|new)\s+(?:a\s+)?(?:new\s+)?(?:project|website|app|application|page|component|service|api|backend|frontend)/i,
  open_project: /(?:open|load|show|go to)\s+(?:my\s+)?(?:project|folder|workspace)/i,
  run_project: /(?:run|start|launch|dev|serve)\s+(?:the\s+)?(?:project|app|server|dev|development)/i,
  build_project: /(?:build|compile|bundle)\s+(?:the\s+)?(?:project|app)/i,
  routine_create: /\b(?:every|each)\s+(?:day|weekday|week|morning|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^?!]*\b(?:at|by)\s+\d{1,2}[:.]\d{2}\b|\b(?:at|by)\s+\d{1,2}[:.]\d{2}\b[^?!]*\b(?:every|each|daily)\b/i,
  routine_list: /(?:my|list|show)\s+(?:routines?|schedules?|automations?)|what are (?:my|the) routines?/i,
  routine_control: /(?:pause|resume|unpause|delete|remove|cancel)\s+(?:the\s+)?(?:routine|schedule|automation)\s+[a-z0-9_\-.]/i,
  approvals_check: /(?:pending|waiting|open)\s+approvals?|approvals?\s+(?:status|pending|waiting)|anything waiting for (?:my )?(?:approval|ok)|show approvals?/i,
  approvals_decide: /^(?:approve|deny|reject)\b/i,
      broker_status: /(?:safety|action)\s+broker\b|\bbroker\s+(?:status|report|state)\b|\b(?:show|any)\s+pending\s+actions?\b|\bwhat(?:'s| is)\s+waiting\s+on\s+my\s+ok\b/i,
      broker_sync: /\b(?:sync|refresh|recheck|re-check)\s+(?:the\s+)?(?:broker|approvals?|pending\s+actions?)\b|\bbroker\s+(?:sync|refresh)\b/i, // Phase 21
      activity_status: /\b(?:activity|event)\s+(?:log|bus|tail|status)\b|\bshow\s+(?:recent\s+|the\s+latest\s+)?events\b|\bwhat(?:'s| has)\s+(?:happened|going on)\s*(?:lately|recently|just\s+now)?\b/i, // Phase 22
      timeline_today: /\btimeline\b|\bwhat\s+happened\s+today\b|\bsummari[sz]e\s+(?:my|today'?s)\s+day\b|\btoday'?s\s+(?:activity|work|timeline)\b|\bmy\s+day\b/i, // Phase 23
      permissions_status: /\b(?:tool|agent)\s+permissions?\b|\bpermissions?\s+(?:status|list|show|report)\b|\bwho\s+can\s+use\s+what\b/i, // Phase 24
      permissions_grant: /\b(?:allow|grant)\s+(?:agent\s+)?[a-z0-9_-]+\s+(?:to\s+(?:use|access)|use|access|tool)\s+[a-z0-9_*.-]+/i, // Phase 24
      permissions_revoke: /\b(?:revoke|deny|block)\s+(?:agent\s+)?[a-z0-9_-]+\s+(?:from\s+)?(?:tool\s+|access\s+to\s+|use\s+of\s+)?[a-z0-9_*.-]+/i, // Phase 24
      mcp_status: /\bmcp\b|\bmodel\s+context\s+protocol\b/i, // Phase 24
  test_project: /(?:test|run test|check|verify|validate)\s+(?:the\s+)?(?:project|app|code|tests?|build|website|files?)\b|\brun\s+tests?\b|^test$|^check$/i,
  lint_project: /(?:lint|check code|style check|format check)\s*(?:the\s+)?(?:project|code|files?)?/i,
  install_deps: /(?:install|npm install|yarn install|pnpm install|setup dependencies|install packages)/i,
  git_status: /(?:git status|show status|what changed|any changes|uncommitted)/i,
  git_commit: /(?:commit|git commit|save changes|checkpoint)\s*(?:these|this|the)?\s*(?:changes|files)?/i,
  git_push: /(?:push|git push|upload|sync)\s*(?:to\s+)?(?:remote|origin|github)?/i,
      connector_search_find: /connector\s+(?:for|about|with|covering)\s+\w|(?:find|look\s+up)\s+(?:a\s+)?connector\b|(?:what)\s+(?:data|info)\s+(?:can|could)\s+you\s+(?:fetch|pull|get)\b/i,
      connector_invoke: /(?:use|invoke|call|via|through|with)\s+(?:the\s+)?(?:wikipedia|wiki|hacker\s?news|\bhn\b|dictionary|exchange\s?rates?|\bfx\b|crypto|github|openweather|weather|free\s+(?:models|endpoints))(?:\s+connector)?\b|(?:fetch|pull|get)\s+[^?!]*(?:from|via)\s+(?:the\s+)?(?:wikipedia|wiki|hacker\s?news|\bhn\b|dictionary|exchange\s?rates?|\bfx\b|crypto|github|openweather|weather)\b|\bprice\s+of\s+[a-z0-9]+\b|\bweather\s+(?:in|at|f[oO]r)\s+[a-z]/i,
      gateway_status: /(?:model\s+)?gateway\s+status|\bollama\b\s+(?:up|running|online|alive|status)|which\s+(?:models|lanes?|chat\s+providers)/i,
      gateway_chat: /(?:via|through|with|using)\s+(?:the\s+)?(?:ollama|\bllama\b|local\s+(?:llama|model)|openrouter|openai|groq)(?:\s+(?:connector|model|gateway))?\b/i, // Phase 20
      connector_list: /(?:^|\b)(?:what|which|list|show)\s+(?:local\s+)?connectors?\b|(?:what|which)\s+(?:online\s+)?(?:sources|data)/i,
      // Phase 19 connectors precede git intents: "fetch X from wikipedia" is a connector, not git
  git_pull: /(?:pull|git pull|fetch|sync from|download)/i,
  git_log: /(?:git log|show commits|commit history|what changed|recent changes)/i,
  git_branch: /(?:create branch|new branch|switch branch|checkout branch|git branch)/i,
  git_diff: /(?:git diff|show diff|what changed|show changes|diff files)/i,
  fix_error: /(?:fix|repair|patch|debug|resolve)\s+(?:the\s+)?(?:error|bug|issue|problem|failure|crash)/i,
  inspect_error: /(?:inspect|analyze|examine|look at|read)\s+(?:the\s+)?(?:error|bug|issue|stacktrace|traceback|output)/i,
  refactor: /(?:refactor|clean up|restructure|reorganize|improve)\s+(?:the\s+)?(?:code|function|file|component)/i,
  review_code: /(?:review|audit|check|analyze)\s+(?:my\s+)?(?:code|files?|project)/i,
  create_file: /(?:create|make|new|add)\s+(?:a\s+)?(?:new\s+)?(?:file|component|module|service|class|function)/i,
  edit_file: /(?:edit|modify|update|change|fix)\s+(?:the\s+)?(?:file|code|component)/i,
  read_file: /(?:read|open|show|view|inspect|look at)\s+(?:the\s+)?(?:file|code)/i,
  search_files: /(?:search|find|grep|look for|locate)\s+(?:in\s+)?(?:files?|code|project)/i,
  explain_code: /(?:explain|describe|what does|how does|walk through)\s+(?:this|the|this code)/i,
  screenshot: /(?:take\s+)?(?:a\s+)?screenshot|screen capture|capture screen|screen le lo/i,
  look_at_screen: /(?:look at|inspect|see|read|analyze)\s+(?:my\s+)?(?:screen|vs\s?code|terminal|browser|editor)/i,
  open_vscode: /(?:open|launch|start)\s+(?:vs\s?code|vscode|visual studio code|code)/i,
  run_command: /(?:run|execute|type|enter)\s+(?:the\s+)?(?:command|terminal|shell|powershell)/i,
  fix_build: /(?:fix|repair|patch)\s+(?:the\s+)?(?:build|compilation|compile error)/i,
  deploy: /(?:deploy|ship|publish|release|push to production)/i,
  create_website: /(?:create|build|make)\s+(?:a\s+)?(?:website|landing page|web app|portfolio|blog)/i,
  remember_project: /(?:remember|save|store|track)\s+(?:this\s+)?(?:project|code|decision|architecture)/i,
  what_changed: /(?:what|show me)\s+(?:did|has)\s+(?:i|we|you)\s+change(?:d)?|recent changes|changes (?:today|yesterday|this week)/i,
  stop: /^stop$|^myraa,?\s+stop$|^halt$|^cancel$/i,
  undo: /(?:undo|revert|rollback|go back|undo last)\s*(?:change|action|edit|commit)?/i,  gesture_select: /(?:pinch to select|tap to open|select (?:this|that|it)|open (?:this|that) on the board)/i,
  gesture_clear: /(?:clap to clear|clear the board|sweep the board clean)/i,
  gesture_dismiss: /(?:throw (?:this|that|it) away|flick (?:this|that|it) aside|dismiss (?:this|that))/i,
  gesture_present: /(?:show me|put (?:this|that|it) up|put it on the glass|pull up .* on the board)/i,
  gesture_status: /(?:gesture status|board status|are my hands tracked|is the board (?:on|running|alive))/i,
  gpu_cancel: /(?:cancel|stop) (?:the )?(?:gpu|kaggle)(?: job)?/i,
  gpu_status: /(?:gpu|vram|video memory|kaggle worker|gpu job|compute worker|compute status|gpu status|how much (?:gpu|vram|video memory)|what(?:'s| is) running on (?:the )?(?:gpu|kaggle)|gpu memory do i have)/i,
  gpu_submit: /(?:use (?:the )?gpu|run (?:this|it|that|the model) on (?:the )?(?:gpu|kaggle)|train (?:this|that|it|the model)|gpu for this|benchmark this model|process .* using (?:the )?gpu)/i,
  compute_local: /(?:use local|local compute|local instead|don't use cloud|do not use cloud|no cloud|without cloud|keep (?:it|this) local|use local compute instead)/i,  analyze_artifact: /(?:analyze|investigate|recon|tear down)\s+(?:the\s+)?(?:binary|exe|dll|apk|asar|artifact|sample|package|installer)/i,
  compare_artifacts: /(?:compare|diff)\s+(?:the\s+)?(?:(?:two|both)\s+)?(?:builds?|versions?|artifacts?|sessions?|releases?)/i,
  evidence_status: /(?:evidence|investigation|findings)\s+status|what (?:do|have) (?:we|you) (?:found|learned)/i,  investigate_feature: /where\s+is\s+[a-z0-9_\-.]+\s+implemented|find\s+where\s+[a-z0-9_\-.]+|how\s+does\s+(?:myraa|the\s+app|this\s+app|the\s+application)\s+implement/i,
  trace_crash: /(?:analyze|inspect|look at|investigate|examine|trace)\s+(?:the\s+)?(?:crash|dump|dmp|minidump|core dump|traceback)/i,
  verify_reconstruction: /(?:does|is)\s+my\s+(?:rewrite|reimplementation|reconstruction|port|clone)[^?!]*\bmatch|verify_reconstruct/i,



};

function classifyIntent(message) {
  const lower = message.toLowerCase().trim();
  for (const [intent, pattern] of Object.entries(CODING_INTENTS)) {
    if (pattern.test(lower)) return intent;
  }
  if (/(?:create|build|make|generate)\s+(?:a\s+)?(?:new\s+)?\w+/.test(lower)) return 'create_project';
  if (/(?:fix|repair|patch)\s+\w+/.test(lower)) return 'fix_error';
  if (/(?:open|show)\s+\w+/.test(lower)) return 'read_file';
  return null;
}

// ── Orchestrator State ───────────────────────────────────────────────────────

const _state = {
  activeProject: null,
  lastAction: null,
  taskHistory: [],
  errors: [],
  fixes: [],
  running: false,
  stopRequested: false,
};

// ── Core Orchestration Loop ──────────────────────────────────────────────────

async function executeCodingTask(userMessage, opts = {}) {
  _state.running = true;
  _state.stopRequested = false;

  const startTime = Date.now();
  const result = {
    intent: null,
    project: null,
    plan: [],
    actions: [],
    output: null,
    errors: [],
    fixes: [],
    tests: null,
    review: null,
    memoryUpdated: false,
    duration: 0,
    success: false,
  };

  try {
    // 1. Classify intent
    result.intent = classifyIntent(userMessage);
    if (!result.intent) {
      result.output = { message: 'I could not determine the coding task. Please be more specific.' };
      return result;
    }
    result.actions.push({ step: 'intent', detail: `Detected intent: ${result.intent}` });
    _emitBus('task.recognized', { intent: result.intent, message: String(userMessage || '').slice(0, 120) });

    if (result.intent === 'stop') {
      _state.stopRequested = true;
      result.output = { message: 'Stopping current task.' };
      return result;
    }

    // 2. Detect project
    const projectDir = opts.projectDir || _state.activeProject?.path || process.cwd();
    try {
      result.project = projectDetection.detectProject(projectDir);
      _state.activeProject = result.project;
      result.actions.push({ step: 'project_detection', detail: `Project: ${result.project.name} (${result.project.language}, ${result.project.frameworks.join(', ')})` });
    } catch (e) {
      result.actions.push({ step: 'project_detection', detail: `Could not detect project: ${e.message}` });
    }

    // 3. Execute based on intent
    switch (result.intent) {
      case 'create_project': result.output = await _createProject(userMessage, projectDir, result); break;
      case 'open_project': result.output = await _openProject(userMessage, projectDir, result); break;
      case 'run_project': result.output = await _runProject(projectDir, result); break;
      case 'build_project': result.output = await _buildProject(projectDir, result); break;
      case 'test_project': result.output = await _testProject(projectDir, result); break;
      case 'lint_project': result.output = await _lintProject(projectDir, result); break;
      case 'install_deps': result.output = await _installDeps(projectDir, result); break;
      case 'git_status': result.output = await _gitStatus(projectDir, result); break;
      case 'git_commit': result.output = await _gitCommit(userMessage, projectDir, result); break;
      case 'git_push': result.output = await _gitPush(projectDir, result); break;
      case 'git_pull': result.output = await _gitPull(projectDir, result); break;
      case 'git_log': result.output = await _gitLog(projectDir, result); break;
      case 'git_branch': result.output = await _gitBranch(userMessage, projectDir, result); break;
      case 'git_diff': result.output = await _gitDiff(projectDir, result); break;
      case 'fix_error': result.output = await _fixError(userMessage, projectDir, result); break;
      case 'inspect_error': result.output = await _inspectError(userMessage, projectDir, result); break;
      case 'refactor': result.output = await _refactor(userMessage, projectDir, result); break;
      case 'review_code': result.output = await _reviewCode(projectDir, result); break;
      case 'create_file': result.output = await _createFile(userMessage, projectDir, result); break;
      case 'edit_file': result.output = await _editFile(userMessage, projectDir, result); break;
      case 'read_file': result.output = await _readFile(userMessage, projectDir, result); break;
      case 'search_files': result.output = await _searchFiles(userMessage, projectDir, result); break;
      case 'explain_code': result.output = await _explainCode(userMessage, projectDir, result); break;
      case 'screenshot': result.output = await _takeScreenshot(result); break;
      case 'look_at_screen': result.output = await _lookAtScreen(result); break;
      case 'open_vscode': result.output = await _openVSCode(projectDir, result); break;
      case 'run_command': result.output = await _runCommand(userMessage, projectDir, result); break;
      case 'fix_build': result.output = await _fixBuild(projectDir, result); break;
      case 'remember_project': result.output = await _rememberProject(projectDir, result); break;
      case 'what_changed': result.output = await _whatChanged(projectDir, result); break;
      case 'undo': result.output = await _undoChange(projectDir, result); break;      case 'gesture_select': result.output = await _gestureSelect(userMessage, result); break;
      case 'gesture_clear': result.output = await _gestureClear(result); break;
      case 'gesture_dismiss': result.output = await _gestureDismiss(userMessage, result); break;
      case 'gesture_present': result.output = await _gesturePresent(userMessage, result); break;
      case 'gesture_status': result.output = await _gestureStatus(result); break;
      case 'gpu_status': result.output = await _gpuStatus(result); break;
      case 'gpu_submit': result.output = await _gpuSubmit(userMessage, result); break;
      case 'gpu_cancel': result.output = await _gpuCancel(userMessage, result); break;
      case 'compute_local': result.output = await _computeLocal(result); break;      case 'analyze_artifact': result.output = await _analyzeArtifact(userMessage, projectDir, result); break;
      case 'compare_artifacts': result.output = await _compareArtifacts(result); break;
      case 'evidence_status': result.output = await _evidenceStatus(result); break;      case 'investigate_feature': result.output = await _investigateFeature(userMessage, projectDir, result); break;
      case 'trace_crash': result.output = await _traceCrash(userMessage, result); break;
      case 'verify_reconstruction': result.output = await _verifyReconstruction(userMessage, result); break;      case 'routine_create': result.output = await _routineCreate(userMessage, result); break;
        case 'connector_list': _connectorList(result); break;
        case 'connector_search_find': _connectorFind(userMessage, result); break;
        case 'connector_invoke': await _connectorInvoke(userMessage, result); break; // Phase 19
        case 'gateway_status': await _gatewayStatus(result); break; // Phase 20
        case 'gateway_chat': await _gatewayChat(userMessage, result); break; // Phase 20
        case 'broker_status': result.output = _brokerStatus(result); break; // Phase 21
        case 'broker_sync': result.output = await _brokerSync(userMessage, result); break; // Phase 21
        case 'activity_status': result.output = _activityStatus(userMessage, result); break; // Phase 22
        case 'timeline_today': result.output = await _timelineToday(userMessage, result); break; // Phase 23
        case 'permissions_status': result.output = _permissionsStatus(result); break; // Phase 24
        case 'permissions_grant': result.output = _permissionChange(userMessage, result); break; // Phase 24
        case 'permissions_revoke': result.output = _permissionChange(userMessage, result); break; // Phase 24
        case 'mcp_status': result.output = _mcpStatus(result); break; // Phase 24
      case 'routine_list': result.output = _routineList(result); break;
      case 'routine_control': result.output = await _routineControl(userMessage, result); break;
      case 'approvals_check': result.output = _approvalsCheck(result); break;
      case 'approvals_decide': { const apRes = await _approvalsDecide(userMessage, result); if (apRes && apRes.approvalId) await _brokerAfterDecide(apRes); result.output = apRes; break; } // Phase 21




      default: result.output = { message: `Intent "${result.intent}" recognized but not yet implemented.` };
    }

    result.success = true;
  } catch (err) {
    result.errors.push(err.message);
    result.output = { error: err.message };
  } finally {
    result.duration = Date.now() - startTime;
    _emitBus('task.finished', { intent: result.intent, success: result.success, durationMs: result.duration, errorCount: result.errors.length });
    _state.running = false;
    _state.taskHistory.push({
      timestamp: new Date().toISOString(),
      intent: result.intent,
      duration: result.duration,
      success: result.success,
      project: result.project?.name,
    });
  }

  return result;
}

// ── Task Implementations ─────────────────────────────────────────────────────

async function _createProject(msg, dir, result) {
  if (!developerEngine) return { error: 'Developer engine not available' };
  const goal = msg.replace(/create|build|make|scaffold|generate|new/gi, '').trim();
  result.plan.push('Generate project structure', 'Write files', 'Open in VS Code', 'Run dev server');
  try {
    const planResult = await developerEngine.generateProject({ goal, targetDir: dir });
    result.actions.push({ step: 'generate', detail: `Generated ${planResult.files?.length || 0} files` });
    if (desktopAutomation) {
      try { desktopAutomation.openApplication('code'); } catch {}
    }
    return { message: `Project created. ${planResult.files?.length || 0} files generated. Opening VS Code.`, files: planResult.files };
  } catch (e) {
    return { error: `Failed to create project: ${e.message}` };
  }
}

async function _openProject(msg, dir, result) {
  const projectDir = _extractPath(msg) || dir;
  if (desktopAutomation) {
    desktopAutomation.openFolder(projectDir);
  }
  return { message: `Opened project at ${projectDir}`, path: projectDir };
}

async function _runProject(dir, result) {
  const setup = testRunner ? testRunner.detectTestSetup(dir) : {};
  const scripts = result.project?.scripts || {};
  if (scripts.dev) {
    result.actions.push({ step: 'run', detail: `Running: npm run dev` });
    if (terminalRunner) {
      const r = terminalRunner.startDevServer(dir);
      return { message: `Dev server started.`, port: r?.port, command: 'npm run dev' };
    }
    return { message: `Dev script found: ${scripts.dev}. Run it manually.` };
  }
  return { message: 'No dev script found in project.', scripts };
}

async function _buildProject(dir, result) {
  if (!testRunner) return { error: 'Test runner not available' };
  result.actions.push({ step: 'build', detail: 'Running build...' });
  const r = await testRunner.runBuild(dir);
  result.actions.push({ step: 'build_result', detail: r.ok ? 'Build succeeded' : `Build failed: ${r.error}` });
  return r;
}

async function _testProject(dir, result) {
  if (!testRunner) return { error: 'Test runner not available' };
  result.actions.push({ step: 'test', detail: 'Running tests...' });
  const r = await testRunner.runTests(dir);
  result.tests = r;
  result.actions.push({ step: 'test_result', detail: `${r.passed || 0} passed, ${r.failed || 0} failed` });
  return r;
}

async function _lintProject(dir, result) {
  if (!testRunner) return { error: 'Test runner not available' };
  result.actions.push({ step: 'lint', detail: 'Running linter...' });
  const r = await testRunner.runLint(dir);
  result.actions.push({ step: 'lint_result', detail: r.ok ? 'No issues' : `${r.errors} errors, ${r.warnings} warnings` });
  return r;
}

async function _installDeps(dir, result) {
  if (!testRunner) return { error: 'Test runner not available' };
  result.actions.push({ step: 'install', detail: 'Installing dependencies...' });
  const r = await testRunner.runInstall(dir);
  result.actions.push({ step: 'install_result', detail: r.ok ? 'Dependencies installed' : `Install failed: ${r.error}` });
  return r;
}

async function _gitStatus(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const info = gitService.detectProject(dir);
  result.actions.push({ step: 'git_status', detail: `Branch: ${info.branch}, Clean: ${info.clean}` });
  return {
    branch: info.branch,
    remote: info.remote,
    clean: info.clean,
    uncommitted: info.uncommitted,
    untracked: info.untracked,
  };
}

async function _gitCommit(msg, dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const messageMatch = msg.match(/commit\s+(?:these|this|the)?\s*(?:changes|files)?\s*(?:with message|as|saying|:)\s*["']?(.+?)["']?\s*$/i);
  const message = messageMatch ? messageMatch[1] : `MYRAA: ${msg.replace(/commit|these|changes|files/gi, '').trim()}`;
  result.actions.push({ step: 'git_add', detail: 'git add .' });
  gitService.add(dir, '.');
  result.actions.push({ step: 'git_commit', detail: `git commit -m "${message}"` });
  const r = gitService.commit(dir, message);
  return { ok: r.ok, message: r.ok ? `Committed: "${message}"` : `Commit failed: ${r.stderr}`, output: r.stdout || r.stderr };
}

async function _gitPush(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  result.actions.push({ step: 'git_push', detail: 'git push' });
  const r = gitService.push(dir);
  return { ok: r.ok, message: r.ok ? 'Pushed to remote.' : `Push failed: ${r.stderr}`, output: r.stdout || r.stderr };
}

async function _gitPull(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  result.actions.push({ step: 'git_pull', detail: 'git pull' });
  const r = gitService.pull(dir);
  return { ok: r.ok, message: r.ok ? 'Pulled from remote.' : `Pull failed: ${r.stderr}`, output: r.stdout || r.stderr };
}

async function _gitLog(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const r = gitService.logDetailed(dir, 10);
  return { ok: r.ok, commits: r.commits || [], raw: r.raw };
}

async function _gitBranch(msg, dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const nameMatch = msg.match(/(?:create|new|switch to|checkout)\s+(?:branch\s+)?(\S+)/i);
  if (nameMatch) {
    const branchName = nameMatch[1];
    if (msg.match(/switch|checkout/i)) {
      const r = gitService.checkout(dir, branchName);
      return { ok: r.ok, message: r.ok ? `Switched to branch: ${branchName}` : r.stderr };
    }
    const r = gitService.createAndCheckout(dir, branchName);
    return { ok: r.ok, message: r.ok ? `Created and switched to branch: ${branchName}` : r.stderr };
  }
  const r = gitService.branch(dir);
  return { ok: r.ok, branches: r.stdout };
}

async function _gitDiff(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const staged = gitService.diffStaged(dir);
  const unstaged = gitService.diff(dir, { stat: true });
  return { staged: staged.stdout, unstaged: unstaged.stdout };
}

async function _fixError(msg, dir, result) {
  if (!selfHealingEngine) return { error: 'Self-healing engine not available' };
  result.plan.push('Read error', 'Find root cause', 'Patch code', 'Verify fix');
  result.actions.push({ step: 'fix', detail: 'Initiating self-healing...' });
  try {
    const r = await selfHealingEngine.fixBrokenFile({
      error: msg,
      projectDir: dir,
    });
    result.fixes.push(r);
    return r;
  } catch (e) {
    return { error: `Fix failed: ${e.message}` };
  }
}

async function _inspectError(msg, dir, result) {
  result.actions.push({ step: 'inspect', detail: 'Analyzing error...' });
  if (modelRouter) {
    try {
      const analysis = await modelRouter.executeWithFallback({
        task: 'coding',
        prompt: `Analyze this error and suggest a fix:\n\n${msg}`,
      });
      return { analysis };
    } catch { /* fallback */ }
  }
  return { message: 'Error analysis requires model router.', error: msg };
}

async function _refactor(msg, dir, result) {
  if (!developerEngine) return { error: 'Developer engine not available' };
  const goal = msg.replace(/refactor|clean up|restructure|reorganize|improve/gi, '').trim();
  result.plan.push('Analyze code', 'Identify improvements', 'Apply refactor', 'Verify');
  try {
    const r = await developerEngine.refactorCode({ code: '', goal });
    return r;
  } catch (e) {
    return { error: `Refactor failed: ${e.message}` };
  }
}

async function _reviewCode(dir, result) {
  if (!testRunner) return { error: 'Test runner not available' };
  const lintResult = await testRunner.runLint(dir);
  const gitInfo = gitService ? gitService.detectProject(dir) : null;
  return {
    lint: lintResult,
    git: gitInfo,
    project: result.project,
    message: lintResult.ok ? 'Code looks clean.' : `${lintResult.errors} lint errors found.`,
  };
}

async function _createFile(msg, dir, result) {
  const nameMatch = msg.match(/(?:create|make|new|add)\s+(?:a\s+)?(?:new\s+)?(?:file|component|module|service|class|function)\s+(?:called?|named?|for)?\s*["']?(\S+?)["']?\s*$/i);
  if (!nameMatch) return { message: 'Please specify the file name.' };
  const fileName = nameMatch[1];
  const filePath = path.join(dir, fileName);
  const ext = path.extname(fileName).toLowerCase();
  const templates = {
    '.js': `'use strict';\n\nmodule.exports = {};\n`,
    '.ts': `export {};\n`,
    '.jsx': `import React from 'react';\n\nexport default function Component() {\n  return <div></div>;\n}\n`,
    '.tsx': `import React from 'react';\n\nexport default function Component() {\n  return <div></div>;\n}\n`,
    '.py': `#!/usr/bin/env python3\n\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()\n`,
    '.css': `/* ${fileName} */\n\n`,
    '.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${fileName}</title>\n</head>\n<body></body>\n</html>\n`,
  };
  const content = templates[ext] || `// ${fileName}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  result.actions.push({ step: 'create_file', detail: `Created: ${fileName}` });
  return { message: `Created file: ${fileName}`, path: filePath };
}

async function _editFile(msg, dir, result) {
  const nameMatch = msg.match(/(?:edit|modify|update|change|fix)\s+(?:the\s+)?(?:file|code|component)\s+(?:called?|named?|for)?\s*["']?(\S+?)["']?\s*$/i);
  if (!nameMatch) return { message: 'Please specify the file to edit.' };
  const fileName = nameMatch[1];
  const filePath = path.resolve(dir, fileName);
  if (!fs.existsSync(filePath)) return { error: `File not found: ${fileName}` };
  const content = fs.readFileSync(filePath, 'utf-8');
  return { message: `File loaded: ${fileName}`, path: filePath, content: content.substring(0, 5000) };
}

async function _readFile(msg, dir, result) {
  const nameMatch = msg.match(/(?:read|open|show|view|inspect|look at)\s+(?:the\s+)?(?:file|code)\s+(?:called?|named?|for)?\s*["']?(\S+?)["']?\s*$/i);
  if (!nameMatch) return { message: 'Please specify the file name.' };
  const fileName = nameMatch[1];
  const filePath = path.resolve(dir, fileName);
  if (!fs.existsSync(filePath)) return { error: `File not found: ${fileName}` };
  const content = fs.readFileSync(filePath, 'utf-8');
  return { message: `Contents of ${fileName}:`, path: filePath, content: content.substring(0, 10000) };
}

async function _searchFiles(msg, dir, result) {
  const queryMatch = msg.match(/(?:search|find|grep|look for|locate)\s+(?:in\s+)?(?:files?|code|project)\s+(?:for)?\s*["']?(.+?)["']?\s*$/i);
  if (!queryMatch) return { message: 'Please specify what to search for.' };
  const query = queryMatch[1];
  try {
    const r = execSync(`findstr /s /i /n "${query}" "${dir}\\*"`, { cwd: dir, encoding: 'utf-8', timeout: 10000, maxBuffer: 1024 * 1024 });
    return { query, results: r.substring(0, 5000) };
  } catch {
    return { query, results: 'No matches found.' };
  }
}

async function _explainCode(msg, dir, result) {
  if (!modelRouter) return { error: 'Model router not available' };
  try {
    const analysis = await modelRouter.executeWithFallback({
      task: 'coding',
      prompt: `Explain what this code does:\n\n${msg}`,
    });
    return { explanation: analysis };
  } catch {
    return { message: 'Could not analyze code.' };
  }
}

async function _takeScreenshot(result) {
  if (!desktopAutomation) return { error: 'Desktop automation not available' };
  try {
    const screenshot = desktopAutomation.takeScreenshot();
    result.actions.push({ step: 'screenshot', detail: 'Screenshot captured' });
    return { message: 'Screenshot captured.', screenshot };
  } catch (e) {
    return { error: `Screenshot failed: ${e.message}` };
  }
}

async function _lookAtScreen(result) {
  if (!desktopAutomation) return { error: 'Desktop automation not available' };
  try {
    const analysis = desktopAutomation.analyzeScreenshot();
    return { message: 'Screen analyzed.', analysis };
  } catch (e) {
    return { error: `Screen analysis failed: ${e.message}` };
  }
}

async function _openVSCode(dir, result) {
  if (desktopAutomation) {
    try {
      desktopAutomation.openApplication('code');
      return { message: 'VS Code opened.' };
    } catch (e) {
      return { error: `Failed to open VS Code: ${e.message}` };
    }
  }
  return { error: 'Desktop automation not available' };
}

async function _runCommand(msg, dir, result) {
  const cmdMatch = msg.match(/(?:run|execute|type|enter)\s+(?:the\s+)?(?:command|terminal|shell)?\s*["']?(.+?)["']?\s*$/i);
  if (!cmdMatch) return { message: 'Please specify the command.' };
  const cmd = cmdMatch[1];
  if (!terminalRunner) return { error: 'Terminal runner not available' };
  result.actions.push({ step: 'run_command', detail: cmd });
  const r = terminalRunner.runCommand ? terminalRunner.runCommand(cmd, { cwd: dir }) : { ok: false, error: 'runCommand not available' };
  return { command: cmd, ...r };
}

async function _fixBuild(dir, result) {
  if (!testRunner || !selfHealingEngine) return { error: 'Services not available' };
  result.plan.push('Run build', 'Read error', 'Find root cause', 'Patch', 'Rebuild');
  const buildResult = await testRunner.runBuild(dir);
  if (buildResult.ok) return { message: 'Build already succeeds.' };
  result.actions.push({ step: 'build_failed', detail: buildResult.error });
  try {
    const fix = await selfHealingEngine.fixBrokenFile({ error: buildResult.error, projectDir: dir });
    result.fixes.push(fix);
    const rebuild = await testRunner.runBuild(dir);
    return { buildFailed: buildResult.error, fixApplied: fix, rebuildResult: rebuild };
  } catch (e) {
    return { error: `Could not auto-fix build: ${e.message}`, buildError: buildResult.error };
  }
}

async function _rememberProject(dir, result) {
  if (!projectDetection) return { error: 'Project detection not available' };
  const state = projectDetection.getProjectState(dir);
  if (memoryCore) {
    try {
      memoryCore.save(`project:${state.project}`, JSON.stringify(state));
      result.memoryUpdated = true;
      return { message: `Remembered project: ${state.project}`, state };
    } catch (e) {
      return { error: `Memory save failed: ${e.message}` };
    }
  }
  return { message: 'Project state computed (memory not available)', state };
}

async function _whatChanged(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const log = gitService.logDetailed(dir, 5);
  const diff = gitService.diffSummary(dir);
  return { commits: log.commits || [], diff: diff.stdout };
}

async function _undoChange(dir, result) {
  if (!gitService) return { error: 'Git service not available' };
  const r = gitService.undoLastCommit(dir, true);
  return { ok: r.ok, message: r.ok ? 'Last commit undone (changes preserved).' : `Undo failed: ${r.stderr}` };
}

function _computeStore() {
  const { csDb } = require('./course_studio_store.cjs');
  return {
    saveJob: async (j) => { const r = csDb('cp_job_save', j); if (!r || r.ok !== true) throw new Error('cp_job_save failed'); },
    loadJob: async (id) => { const r = csDb('cp_job_get', { id: String(id) }); return (r && r.ok === true) ? (r.job || null) : null; },
    listJobs: async () => { const r = csDb('cp_job_list', {}); return (r && r.ok === true) ? (r.jobs || []) : []; },
    saveWorker: async (w) => { const r = csDb('cp_worker_save', w); if (!r || r.ok !== true) throw new Error('cp_worker_save failed'); },
    loadWorker: async (id) => { const r = csDb('cp_worker_get', { id: String(id) }); return (r && r.ok === true) ? (r.worker || null) : null; },
    listWorkers: async () => { const r = csDb('cp_worker_list', {}); return (r && r.ok === true) ? (r.workers || []) : []; },
    addEvent: async (e) => { csDb('cp_event_add', e); },
    listEvents: async (jobId) => { const r = csDb('cp_event_list', { jobId: jobId || '' }); return (r && r.ok === true) ? (r.events || []) : []; },
  };
}

function _computeManager() {
  const m = require('./compute_manager.cjs');
  return m.createComputeManager(_computeStore());
}

async function _gpuStatus(result) {
  try {
    const mgr = _computeManager();
    const providers = mgr.getProviders();
    const workers = await mgr.getWorkers();
    const q = mgr.getQuota();
    const lines = providers.map((p) => {
      const gpu = p.gpu_count ? p.gpus.map((g) => `${g.model} ${g.vram_gb}GB`).join(' + ') : 'CPU only';
      return `- ${p.provider}: ${p.status} (${gpu})`;
    });
    for (const w of workers) {
      const c = w.caps || {};
      lines.push(`- kaggle worker ${w.id}: ${mgr.workerOnline(w) ? 'online' : 'offline/stale'} (${c.gpu_count || '?'} GPUs, single ${c.single_gpu_vram_gb || '?'}GB, aggregate ${c.aggregate_vram_gb || '?'}GB)`);
    }
    lines.push(`- Kaggle quota: used ${q.gpu_hours_used}, remaining ${q.gpu_hours_remaining} (UNKNOWN by design)`);
    return { message: 'Compute status:\n' + lines.join('\n') };
  } catch (e) {
    return { message: 'Compute status unavailable (Phase 7 not applied?): ' + (e.message || e) };
  }
}

async function _gpuSubmit(userMessage, result) {
  try {
    const mgr = _computeManager();
    const out = await mgr.submitJob({ jobType: 'LLM_INFERENCE', route: 'KAGGLE', priority: 'normal', input: { prompt: String(userMessage || '') } });
    if (out.ok) return { message: `GPU job ${out.jobId} queued via ${out.transport || out.route}. ${out.detail || ''}` };
    return { message: `GPU job not started [${out.code || 'error'}]: ${out.error || ''}${out.jobId ? ` (recorded as ${out.jobId})` : ''}` };
  } catch (e) {
    return { message: 'GPU submit failed (Phase 7 not applied?): ' + (e.message || e) };
  }
}

async function _gpuCancel(userMessage, result) {
  try {
    const mgr = _computeManager();
    const { csDb } = require('./course_studio_store.cjs');
    const r = csDb('cp_job_list', {});
    const jobs = (r && r.ok === true) ? (r.jobs || []) : [];
    const active = jobs.filter((j) => ['CREATED', 'QUEUED', 'RUNNING'].includes(j.status));
    if (!active.length) return { message: 'No active GPU jobs to cancel.' };
    active.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const done = await mgr.cancelJob(active[0].id);
    return { message: done ? `Cancelled GPU job ${done.id} (was ${active[0].status}).` : 'Cancel failed: job not found.' };
  } catch (e) {
    return { message: 'GPU cancel failed (Phase 7 not applied?): ' + (e.message || e) };
  }
}

async function _computeLocal(result) {
  try {
    const mgr = _computeManager();
    const local = mgr.getProviders().find((p) => p.provider === 'local');
    const gpu = local && local.gpu_count ? local.gpus.map((g) => `${g.model} ${g.vram_gb}GB`).join(' + ') : 'no local GPU (CPU only)';
    return { message: `Local compute: ${local ? local.status : 'unknown'} (${gpu}). Trivial work already routes locally under AUTO; say "use the GPU" for GPU jobs.` };
  } catch (e) {
    return { message: 'Local compute info unavailable (Phase 7 not applied?): ' + (e.message || e) };
  }
}

function _gestureBoard() {
  return require('./gesture_board.cjs');
}

async function _gestureStatus(result) {
  try {
    const st = await _gestureBoard().status();
    const lines = [
      'Gesture board: ' + st.server,
      'Ring: ' + st.ring,
      'Endpoint: ' + st.baseUrl,
    ];
    return { message: 'Gesture status:\n- ' + lines.join('\n- ') };
  } catch (e) {
    return { message: 'Gesture status unavailable: ' + (e.message || e) };
  }
}

async function _gestureSelect(userMessage, result) {
  try {
    const st = await _gestureBoard().boardState();
    if (!st.ok) return { message: 'Board unreadable (' + st.code + '): start the board server first.' };
    return { message: 'Board state via ' + st.source + ': ' + JSON.stringify(st.items || st.raw).slice(0, 500) };
  } catch (e) {
    return { message: 'Gesture select failed: ' + (e.message || e) };
  }
}

async function _gestureClear(result) {
  try {
    const out = await _gestureBoard().boardCmd({ a: 'reset' });
    if (!out.ok) return { message: 'Board clear failed [' + (out.code || 'error') + ']: ' + out.error };
    return { message: 'Board cleared.' };
  } catch (e) {
    return { message: 'Gesture clear failed: ' + (e.message || e) };
  }
}

async function _gestureDismiss(userMessage, result) {
  try {
    const out = await _gestureBoard().boardCmd({ a: 'yank' });
    if (!out.ok) return { message: 'Dismiss failed [' + (out.code || 'error') + ']: ' + out.error };
    return { message: 'Dismissed from the board.' };
  } catch (e) {
    return { message: 'Gesture dismiss failed: ' + (e.message || e) };
  }
}

async function _gesturePresent(userMessage, result) {
  try {
    const text = String(userMessage || '').slice(0, 2000);
    const out = await _gestureBoard().boardCmd({ a: 'present', title: 'MYRAA', body: text.slice(0, 1000) });
    if (!out.ok) return { message: 'Present failed [' + (out.code || 'error') + ']: ' + out.error };
    _gestureBoard().setRing('speaking');
    return { message: 'Put it on the glass.' };
  } catch (e) {
    return { message: 'Gesture present failed: ' + (e.message || e) };
  }
}

function _evidenceEngine() {
  const engm = require('./evidence_engine.cjs');
  return engm.createEngine({});
}

const ARTIFACT_UNKNOWN_QUESTIONS = [
  'What file type / packer / compiler stamp is this?',
  'What are the exports, imports and embedded URLs?',
  'Where are hardcoded endpoints or credentials?',
  'What version strings does it announce?',
];

async function _analyzeArtifact(userMessage, dir, result) {
  try {
    const eng = _evidenceEngine();
    const artPath = _extractPath(String(userMessage || '')) || '';
    const ext = path.extname(artPath).toLowerCase();
    const sess = eng.createSession({ label: 'artifact investigation', subject: artPath || String(userMessage || '').slice(0, 200) });
    if (!sess.ok) return { message: 'Evidence session failed [' + (sess.code || 'error') + ']: ' + sess.error };
    let unknownCount = 0;
    for (const q of ARTIFACT_UNKNOWN_QUESTIONS) {
      const u = eng.addUnknown({ sessionId: sess.session.id, question: q, attemptedTools: [] });
      if (u.ok) unknownCount++;
    }
    const plan = [];
    if (ext === '.exe' || ext === '.dll' || ext === '.sys') {
      plan.push('strings/imports/version stamps locally; record everything as evidence');
      plan.push('deep pseudocode: schedule on Kaggle ONLY if compute is enabled, otherwise stay honest local-only');
    } else if (ext === '.asar') {
      plan.push('asar file listing (read-only catalog); no code execution');
    } else if (ext === '.apk') {
      plan.push('zip listing + manifest text extraction; record hashes');
    } else {
      plan.push('generic: hashes + string scan; deeper tooling declared as unknowns');
    }
    plan.push('Rule: target content is untrusted data - observed, hashed, never executed');
    return {
      message: 'Investigation session ' + sess.session.id + ' opened (' + unknownCount + ' open questions). Plan:\n- ' + plan.join('\n- '),
      sessionId: sess.session.id,
    };
  } catch (e) {
    return { message: 'analyze_artifact failed: ' + (e.message || e) };
  }
}

async function _compareArtifacts(result) {
  try {
    const eng = _evidenceEngine();
    const sessions = eng.listSessions(2);
    if (!sessions.ok || sessions.sessions.length < 2) {
      return { message: 'Need two investigation sessions. Say "analyze the <file>" on each build first.' };
    }
    const newer = sessions.sessions[0];
    const older = sessions.sessions[1];
    const cmp = eng.compareSessions({ a: older.id, b: newer.id });
    if (!cmp.ok) return { message: 'Compare failed [' + (cmp.code || 'error') + ']: ' + cmp.error };
    return {
      message: 'Compare ' + newer.label + ' vs older: shared ' + cmp.summary.shared + ', new in current ' + cmp.summary.onlyInB + ', disappeared ' + cmp.summary.onlyInA + '.',
      summary: cmp.summary,
    };
  } catch (e) {
    return { message: 'compare_artifacts failed: ' + (e.message || e) };
  }
}

async function _evidenceStatus(result) {
  try {
    const eng = _evidenceEngine();
    const st = eng.status();
    const lines = [
      'Sessions: ' + st.counts.sessions + ', findings: ' + st.counts.findings + ', evidence records: ' + st.counts.evidence,
      'Store: ' + st.storePath,
    ];
    if (st.lastSession) lines.push('Last session: ' + st.lastSession.label + ' (' + st.lastSession.id + ')');
    lines.push('Outputs are bounded by design; ask for a session id to list findings.');
    return { message: 'Evidence status:\n- ' + lines.join('\n- ') };
  } catch (e) {
    return { message: 'Evidence status unavailable: ' + (e.message || e) };
  }
}

function _investigationSkills() {
  return require('./investigation_skills.cjs');
}

async function _investigateFeature(userMessage, dir, result) {
  try {
    const skills = _investigationSkills();
    const eng = _evidenceEngine();
    const text = String(userMessage || '').toLowerCase();
    const m = text.match(/implement(?:ed)?\s+(?:a\s+|the\s+)?([a-z0-9_\-.]+(?:\s+[a-z0-9_\-.]+)*)/)
      || text.match(/where\s+is\s+(?:a\s+|the\s+)?([a-z0-9_\-.]+(?:\s+[a-z0-9_\-.]+)*)\s+implemented/)
      || text.match(/find\s+where\s+(?:a\s+|the\s+)?([a-z0-9_\-.]+(?:\s+[a-z0-9_\-.]+)*)/);
    let token = m ? m[1] : '';
    token = token.replace(/\s+(?:work|works|happens|feature|handled|happening|implemented)$/i, '').trim();
    if (!token) return { message: 'Say it like: "where is login implemented" or "how does myraa implement login" (I need the feature word).' };
    const scan = skills.investigateFeature(dir, token);
    if (!scan.ok) return { message: 'Feature scan failed: ' + scan.error };
    const sess = eng.createSession({ label: 'feature investigation: ' + token, subject: String(dir || '').slice(0, 200) });
    if (!sess.ok) return { message: 'Evidence session failed: ' + sess.error };
    if (!scan.hits.length) {
      eng.addUnknown({ sessionId: sess.session.id, question: 'No line hits for "' + token + '" in ' + scan.filesScanned + ' text files - is the token right, or is the feature generated/bundled?', attemptedTools: ['text_scan'] });
      return { message: '"' + token + '" not found in ' + scan.filesScanned + ' text files (unknowns recorded). Try: "how does the app implement <different word>".' };
    }
    const ev = scan.hits.slice(0, 3).map((h) => ({ kind: 'text', value: h.file + ':' + h.line + ' :: ' + h.text, provenance: 'investigate_feature scan' }));
    const f = eng.addFinding({
      sessionId: sess.session.id, kind: 'observed', inference: '"' + token + '" appears in ' + scan.hits.length + ' lines',
      sourceTool: 'investigate_feature', evidence: ev,
    });
    eng.addUnknown({ sessionId: sess.session.id, question: 'Full call graph for "' + token + '" needs the graft engine pass', attemptedTools: ['text_scan'] });
    const list = scan.hits.slice(0, 5).map((h) => h.file.replace(/^.*[\\/]/, '') + ':' + h.line + ' :: ' + h.text.slice(0, 80));
    return {
      message: 'Feature "' + token + '": ' + scan.hits.length + ' hits across ' + scan.filesScanned + ' files (session ' + sess.session.id + '):\n- ' + list.join('\n- '),
      sessionId: sess.session.id,
      finding: f.ok ? f.finding.id : null,
    };
  } catch (e) {
    return { message: 'investigate_feature failed: ' + (e.message || e) };
  }
}

async function _traceCrash(userMessage, result) {
  try {
    const skills = _investigationSkills();
    const eng = _evidenceEngine();
    const crashPath = _extractPath(String(userMessage || ''));
    if (!crashPath) return { message: 'Name the dump file: "analyze the crash at C:\\path\\dump.v2.1.dmp".' };
    const scan = skills.crashScan(crashPath);
    if (!scan.ok) return { message: 'Crash scan failed [' + (scan.error || 'error') + ']: file unreadable.' };
    const sess = eng.createSession({ label: 'crash investigation', subject: crashPath.slice(0, 200) });
    if (!sess.ok) return { message: 'Evidence session failed: ' + sess.error };
    eng.addFinding({ sessionId: sess.session.id, kind: 'observed', inference: 'Crash scan of ' + path.basename(crashPath) + ' (' + scan.artifact.kind + ')', sourceTool: 'crash_scan', evidence: scan.evidence });
    eng.addUnknown({ sessionId: sess.session.id, question: 'Symbolicated call stack needs a debugger/minidump provider - strings scan alone cannot name the faulting frame', attemptedTools: ['strings_scan'] });
    const sigs = scan.crashSignatures.slice(0, 8).map((s) => s.text.slice(0, 80));
    return {
      message: 'Crash scan (sha256 ' + scan.artifact.sha256.slice(0, 12) + '...): ' + scan.crashSignatures.length + ' keyword strings. ' + scan.note + '\n- ' + (sigs.length ? sigs.join('\n- ') : '(none)'),
      sessionId: sess.session.id,
    };
  } catch (e) {
    return { message: 'trace_crash failed: ' + (e.message || e) };
  }
}

async function _verifyReconstruction(userMessage, result) {
  try {
    const skills = _investigationSkills();
    const eng = _evidenceEngine();
    const paths = [];
    const re = /([A-Za-z]:\\[^\s"']+\.(?:exe|dll|so|dylib|asar|apk|zip|py|js))/g;
    let m;
    const text = String(userMessage || '');
    while ((m = re.exec(text)) !== null && paths.length < 2) paths.push(m[1]);
    if (paths.length < 2) return { message: 'Give me two files: "does my rewrite C:\\new\\app.js match the original C:\\old\\app.js".' };
    const v = skills.verifyReconstruction(paths[0], paths[1]);
    if (!v.ok) return { message: 'Verification failed: ' + v.error };
    const sess = eng.createSession({ label: 'reconstruction verification', subject: paths[0].slice(0, 100) + ' vs ' + paths[1].slice(0, 100) });
    if (sess.ok) {
      eng.addFinding({ sessionId: sess.session.id, kind: 'observed', inference: v.verdict, sourceTool: 'verify_reconstruction', evidence: v.evidence });
    }
    return {
      message: v.verdict + '\n- shared strings: ' + v.stringOverlap.shared + ', overlap: ' + (v.stringOverlap.overlap * 100).toFixed(1) + '%\n- targets are never executed; only hashed and scanned',
      verdict: v.verdict,
    };
  } catch (e) {
    return { message: 'verify_reconstruction failed: ' + (e.message || e) };
  }
}

function _requireModule(name) {
  try { return require('./' + name); } catch (e) { return null; }
}

function _agentWorkspace() {
  return require('./agent_workspace.cjs').createWorkspace({});
}

async function _routineCreate(userMessage, result) {
  try {
    const ws = _agentWorkspace();
    const text = String(userMessage || '').toLowerCase().replace(/[:]/g, ' ');
    const timeMatch = text.match(/\b(?:at|by)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/);
    if (!timeMatch) return { message: 'I need a time like "every weekday at 8:30 <task>".' };
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    const mer = timeMatch[3] || '';
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    const dayMatch = text.match(/\b(?:every|each)\s+(day|weekday|week|morning|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (!dayMatch) return { message: 'Say it like: "every weekday at 8:30 check my project status" (need "every <day|weekday|week|sunday...>").' };
    const word = dayMatch[1];
    let spec = { kind: 'daily', time: '' };
    if (word === 'day' || word === 'morning') spec.kind = 'daily';
    else if (word === 'weekday') spec.kind = 'weekdays';
    else if (word === 'week') { spec.kind = 'weekly'; spec.weekday = 'monday'; }
    else { spec.kind = 'weekly'; spec.weekday = word; }
    spec.time = hour + ':' + String(minute).padStart(2, '0');
    const dayEnd = (dayMatch.index || 0) + dayMatch[0].length;
    const timeEnd = (timeMatch.index || 0) + timeMatch[0].length;
    const instr = String(userMessage || '')
      .slice(Math.max(dayEnd, timeEnd))
      .replace(/^\s*(?:please\s+)?/, '').trim();
    const instruction = instr || String(userMessage || '').trim();
    const out = ws.createRoutine({ phrase: String(userMessage || '').trim(), spec, instruction: instruction.slice(0, 600) });
    if (!out.ok) return { message: 'Routine failed [' + (out.code || 'error') + ']: ' + out.error };
    return {
      message: 'Routine stored (status active; firing needs the server tick - see docs): next run ' + out.routine.nextRunAt + '.',
      routineId: out.routine.id,
    };
  } catch (e) {
    return { message: 'routine_create failed: ' + (e.message || e) };
  }
}

function _routineList(result) {
  try {
    const ws = _agentWorkspace();
    const r = ws.listRoutines();
    if (!r.ok) return { message: 'Routine list failed: ' + r.error };
    if (!r.routines.length) return { message: 'No routines stored. Say: "every weekday at 8:30 check my project status".' };
    const lines = r.routines.slice(0, 10).map((x) => x.status + ' | next ' + (x.nextRunAt || '-') + ' | ran ' + x.runCount + 'x | ' + (x.instruction || x.phrase).slice(0, 70));
    return { message: 'Routines (' + r.routines.length + '):\n- ' + lines.join('\n- ') };
  } catch (e) {
    return { message: 'routine_list failed: ' + (e.message || e) };
  }
}

async function _routineControl(userMessage, result) {
  try {
    const ws = _agentWorkspace();
    const text = String(userMessage || '').toLowerCase().trim();
    const verb = (/^(pause|resume|unpause|delete|remove|cancel)\b/.exec(text) || [])[1] || '';
    const action = verb === 'resume' || verb === 'unpause' ? 'active' : verb;
    if (action !== 'active' && !['pause', 'delete', 'cancel', 'remove'].includes(verb)) {
      return { message: 'Routines can be paused, resumed or deleted. "pause routine daily standup".' };
    }
    if (verb === 'cancel') { // cancel/r remove/delete => delete routine record
      const del = ws.deleteRoutine({ query: text.replace(/^(?:delete|remove|cancel)\s+(?:the\s+)?(?:routine|schedule|automation)\s+/, '') });
      if (!del.ok) return { message: 'Delete failed: ' + del.error };
      return { message: 'Routine deleted (' + del.deleted + ').' };
    }
    if (action === 'active') {
      const res = ws.setRoutineStatus({ query: text.replace(/^resume\s+(?:the\s+)?(?:routine|schedule|automation)\s+|^unpause\s+(?:the\s+)?(?:routine|schedule|automation)\s+/, ''), status: 'active' });
      if (!res.ok) return { message: 'Resume failed: ' + res.error };
      return { message: 'Routine resumed. Next run ' + res.routine.nextRunAt + '.' };
    }
    const pause = ws.setRoutineStatus({ query: text.replace(/^pause\s+(?:the\s+)?(?:routine|schedule|automation)\s+|^delete\s+|^remove\s+/, ''), status: 'paused' });
    if (!pause.ok) return { message: 'Pause failed: ' + pause.error };
    return { message: 'Routine paused. "resume routine <name>" to re-arm.' };
  } catch (e) {
    return { message: 'routine_control failed: ' + (e.message || e) };
  }
}

function _approvalsCheck(result) {
  try {
    const ws = _agentWorkspace();
    const r = ws.listApprovals({ openOnly: true });
    if (!r.ok) return { message: 'Approvals failed: ' + r.error };
    if (!r.approvals.length) return { message: 'No approvals waiting. (server flows create cards when actions need your ok - none right now).' };
    const lines = r.approvals.slice(0, 10).map((a) => a.scope + ' | ' + a.summary.slice(0, 90) + ' | id ' + a.id);
    return { message: 'Approvals waiting (' + r.approvals.length + ')\n- ' + lines.join('\n- ') };
  } catch (e) {
    return { message: 'approvals_check failed: ' + (e.message || e) };
  }
}

async function _approvalsDecide(userMessage, result) {
  try {
    const ws = _agentWorkspace();
    const text = String(userMessage || '').toLowerCase().trim();
    const decision = /^(approve)\b/.test(text) ? 'approve' : 'deny';
    const open = ws.listApprovals({ openOnly: true });
    if (!open.ok) return { message: 'Approvals failed: ' + open.error };
    let target = null;
    const words = text.replace(/^(?:approve|deny|reject)\s+(?:it|this|that|the|my)?\s*/, '').trim();
    if (words) target = open.approvals.find((a) => a.summary.toLowerCase().includes(words) || a.id.toLowerCase().includes(words));
    if (!target && open.approvals.length) target = open.approvals[0];
    if (!target) return { message: 'Nothing to ' + decision + ' - no pending approvals.' };
    const res = ws.decideApproval({ id: target.id, decision, decidedBy: 'voice' });
    if (!res.ok) return { message: 'Decision failed: ' + res.error };
    return {
      message: (decision === 'approve' ? 'Approved: ' : 'Denied: ') + target.summary.slice(0, 120) + ' (' + target.scope + ').',
      approvalId: target.id,
    };
  } catch (e) {
    return { message: 'approvals_decide failed: ' + (e.message || e) };
  }
}

  function _connectorList(result) {
    const market = _requireModule('connector_market.cjs');
    if (!market) { result.output = 'Connector market module not available (connector_market.cjs missing).'; return; }
    const list = market.listConnectors();
    if (!list || !list.ok) { result.output = 'Connector market unavailable.'; return; }
    const lines = list.connectors.map((c) => {
      const keyed = c.auth !== 'none' ? ' [needs env: ' + c.auth + ']' : '';
      return '- ' + c.id + ': ' + (c.actions || []).join(', ') + keyed + ' - ' + (c.summary || '');
    });
    result.output = 'Available local connectors (online during use, privacy-light, no secrets stored):\n' + lines.join('\n') + '\nSay: use the wikipedia connector to search Nikola Tesla';
  }

  function _connector19Clamp(v, n) { const s = String(v == null ? '' : v).trim(); return s.length > n ? s.slice(0, n) + '...' : s; }

  function _connectorFind(userMessage, result) {
    const market = _requireModule('connector_market.cjs');
    if (!market) { result.output = 'Connector market module not available.'; return; }
    const m = /(?:connector|connectors)\s+(?:f[oO]r|about|with|covering)\s+([^\n.?!]+)/i.exec(userMessage) || /(?:find|look\s+up)\s+(?:a\s+)?connector\s+(?:f[oO]r|about)\s+([^\n.?!]+)/i.exec(userMessage);
    if (m) {
      const s = market.searchConnectors(m[1]);
      if (!s.ok) { result.output = 'Connector search failed: ' + s.error; return; }
      const all = market.listConnectors();
      if (!s.results.length) {
        result.output = 'No local connector matches "' + _connector19Clamp(m[1], 60) + '". Today\'s options: ' + (all.ok ? all.connectors.map((c) => c.id).join(', ') : 'list unavailable') + '.';
        return;
      }
      result.output = 'Connectors matching "' + _connector19Clamp(m[1], 60) + '":\n' + s.results.slice(0, 4).map((r) => '- ' + r.id + ' (' + r.matchScore + '): ' + r.summary).join('\n');
      return;
    }
    const marketList = typeof market.listConnectors === 'function' ? market.listConnectors() : null;
    result.output = 'Tell me a need (e.g. "connector for weather") and I will match it against local connectors. ' + (marketList && marketList.ok ? 'Options: ' + marketList.connectors.map((c) => c.id).join(', ') + '.' : '');
  }

  const _connector19Defaults = { wikipedia: 'search', hn_search: 'search', dictionary_api: 'define', exchange_rates: 'rates', crypto_price: 'price', github_trending: 'trending', openweather: 'current', openrouter_models: 'list_free_models' };

  async function _connectorInvoke(userMessage, result) {
    const market = _requireModule('connector_market.cjs');
    if (!market) { result.output = 'Connector market module not available.'; return; }
    const aliases = [
      [/wikipedia/i, 'wikipedia'],
      [/hacker\s?news|\bhn\b/i, 'hn_search'],
      [/dictionary/i, 'dictionary_api'],
      [/exchange\s?rates?|\bfx\b/i, 'exchange_rates'],
      [/crypto|price\s+of/i, 'crypto_price'],
      [/github/i, 'github_trending'],
      [/openweather|weather/i, 'openweather'],
      [/free\s+models|openrouter/i, 'openrouter_models'],
    ];
    let cid = null;
    for (const a of aliases) { if (a[0].test(userMessage)) { cid = a[1]; break; } }
    if (!cid) { result.output = 'Name a connector explicitly, e.g. "use the wikipedia connector to search Tesla". Say "what connectors do we have" for the list.'; return; }
    const conn = market.findConnector(cid);
    if (!conn) { result.output = 'Connector "' + cid + '" not found in this build.'; return; }
    const action = _connector19Defaults[cid];
    const params = {};
    if (action === 'search') {
      const m = /t[oo]\s+(?:search|look\s?up|find)\s+([^\n.?!]+)/i.exec(userMessage) || /(?:fetch|pull|get)\s+(.+?)(?:\s+f(?:ro|m)+|\s+via)\s+/i.exec(userMessage);
      if (m) params.query = _connector19Clamp(m[1], 120);
    } else if (action === 'define') {
      const m = /t[oo]\s+define\s+([a-zA-Z-]+)|define\s+([a-zA-Z-]+)/i.exec(userMessage);
      if (m) params.word = _connector19Clamp(m[1] || m[2], 40);
    } else if (action === 'rates') {
      const m = /f(?:rom)?\s+([A-Za-z]{3})\s+t[oo]\s+([A-Za-z]{3})|r(?:ate|ates)\s+([A-Za-z]{3})\s*\/\s*([A-Za-z]{3})/i.exec(userMessage);
      if (m) {
        params.from = ((m[1] || m[3])).toUpperCase();
        params.to = ((m[2] || m[4])).toUpperCase();
      }
    } else if (action === 'price') {
      const m = /price\s+(?:of|f[oO]r)\s+([a-zA-Z0-9]+)/i.exec(userMessage);
      if (m) params.coin = _connector19Clamp(m[1], 30);
    } else if (action === 'trending') {
      const m = /(\d+)\s*(?:repos?|repositor(?:y|ies)|top)/i.exec(userMessage);
      if (m) params.sinceDays = Math.min(parseInt(m[1], 10) || 7, 30);
    } else if (action === 'current') {
      const m = /(?:in|at|f[oO]r)\s+([^\n.?!]+)/i.exec(userMessage);
      if (m) params.city = _connector19Clamp(m[1], 60);
    }
    const actObj = market.actionFor(conn, action);
    if (!actObj) { result.output = 'Connector ' + cid + ' does not declare action ' + action + ' in this build.'; return; }
    const res = await market.invokeRaw(conn, actObj, params, {});
    if (!res || !res.ok) {
      const code = res && res.code ? res.code : 'UNKNOWN';
      result.output = 'Connector ' + cid + '.' + action + ' failed: ' + ((res && (res.error || res.code)) || 'unknown reason') + (code === 'AUTH_REQUIRED' ? ' - set that environment variable, then restart MYRAA.' : code === 'VALIDATION' ? ' - try phrasing fully, e.g. "use the wikipedia connector to search Nikola Tesla".' : '');
      return;
    }
    result.output = market.summarize(res);
  }
    function _gatewayLaneFromText(text) {
    const m = /(?:via|through|with|using)\s+(?:the\s+)?(ollama|\bllama\b|local\s+(?:llama|model)|openrouter|openai|groq)(?:\s+(?:connector|model|gateway))?\b/i.exec(text);
    if (!m) return null;
    const said = (m[1] || '').toLowerCase();
    if (/llama|local/.test(said)) return 'ollama_local';
    if (/openrouter/.test(said)) return 'openrouter_free';
    if (/openai/.test(said)) return 'openai_owned';
    if (/groq/.test(said)) return 'groq_owned';
    return null;
  }

  function _gateway20Clamp(v, n) { const s = String(v == null ? '' : v).trim(); return s.length > n ? s.slice(0, n) + '...' : s; }

  async function _gatewayStatus(result) {
    const gw = _requireModule('model_gateway.cjs');
    if (!gw) { result.output = 'Model gateway module not available (model_gateway.cjs missing).'; return; }
    const st = gw.status();
    const probed = await gw.probeAll();
    const lines = probed.lanes.map((p) => {
      const key = p.state === 'AUTH_REQUIRED' ? ' [no key: set env]' : '';
      return '- ' + p.lane + ': ' + p.state + key + (p.error ? ' (' + p.error + ')' : '') + (p.sample ? ' ' + p.sample : '');
    });
    result.output = 'Model gateway status (real probes, may take a few seconds):\n[' + st.policy + ']\n' + lines.join('\n') + '\nOffline-first chain: ' + st.chainOfflineFirst + '\nSay: via ollama what is the capital of France';
  }

  async function _gatewayChat(userMessage, result) {
    const gw = _requireModule('model_gateway.cjs');
    if (!gw) { result.output = 'Model gateway module not available.'; return; }
    const lane = _gatewayLaneFromText(userMessage);
    if (!lane) { result.output = 'Name a lane, e.g. "via ollama what is the capital of France" or "through openrouter write a haiku about rain".'; return; }
    const aliasRe = /(?:via|through|with|using)\s+(?:the\s+)?(?:ollama|\bllama\b|local\s+(?:llama|model)|openrouter|openai|groq)(?:\s+(?:connector|model|gateway))?\b/i;
    const am = aliasRe.exec(userMessage);
    let prompt = am ? userMessage.slice(am.index + am[0].length) : userMessage;
    prompt = _gateway20Clamp(prompt, 400);
    if (!prompt) { result.output = 'Tell me what to send over ' + lane + ', e.g. "via ollama summarize todays plan in one sentence".'; return; }
    const res = await gw.chat({ messages: [{ role: 'user', content: prompt }], lane });
    if (!res || !res.ok) {
      const attempted = (res && res.attempts) ? res.attempts.map((a) => a.lane + '=' + a.code + (a.error ? '(' + a.error + ')' : '')).join('; ') : '';
      result.output = 'Gateway chat failed on lane ' + lane + ': ' + ((res && res.error) || 'unknown reason') + (attempted ? ' [attempts: ' + attempted + ']' : '');
      return;
    }
    result.output = '[' + res.lane + ' / ' + res.model + ']\n' + res.text;
  }
  function _brokerStatus(result) {
  try {
    const broker = _requireModule('safety_broker.cjs');
    if (!broker || typeof broker.syncWithWorkspace !== 'function') return { message: 'Safety broker module not available (safety_broker.cjs missing).' };
    broker.syncWithWorkspace();
    const list = broker.listBindings({});
    if (!list.ok) return { message: 'Broker read failed: ' + list.error };
    const active = list.bindings.filter((b) => b.status === 'waiting' || b.status === 'approved');
    const counts = (broker.status() || {}).counts || {};
    if (!active.length) {
      return { message: 'Safety broker idle: nothing high-risk is waiting on your ok (waiting ' + (counts.waiting || 0) + ', approved ' + (counts.approved || 0) + ', executed ' + (counts.executed || 0) + ', denied ' + (counts.denied || 0) + ').' };
    }
    const lines = active.slice(0, 8).map((b) => b.tool + ' [' + b.risk + '] ' + b.status + ' - ' + String(b.reason || b.paramsSummary || '').slice(0, 70) + ' | card ' + (b.approvalId || b.id));
    return { message: 'Safety broker: ' + (counts.waiting || 0) + ' waiting, ' + (counts.approved || 0) + ' approved\n- ' + lines.join('\n- ') + '\nSay "approve <words>" or "deny <words>" to decide a card, then "sync the broker" to run approved actions.' };
  } catch (e) {
    return { message: 'broker_status failed: ' + (e.message || e) };
  }
}

async function _brokerSync(userMessage, result) {
  try {
    const broker = _requireModule('safety_broker.cjs');
    if (!broker || typeof broker.executeApproved !== 'function') return { message: 'Safety broker module not available (safety_broker.cjs missing).' };
    const sync = broker.syncWithWorkspace();
    if (!sync.ok) return { message: 'Broker sync failed: ' + sync.error };
    const run = await broker.executeApproved({});
    const trans = Array.isArray(sync.transitions) ? sync.transitions.length : 0;
    let msg = 'Broker synced: ' + trans + ' card transition(s).';
    if (run.attempted) {
      const okCount = run.results.filter((r) => r.ok).length;
      msg += ' Executed ' + okCount + '/' + run.attempted + ' approved action(s).';
      const fails = run.results.filter((r) => !r.ok).slice(0, 3).map((r) => r.id + ': ' + r.error);
      if (fails.length) msg += ' Still retryable: ' + fails.join('; ');
    } else {
      msg += ' Nothing approved to run.';
    }
    return { message: msg };
  } catch (e) {
    return { message: 'broker_sync failed: ' + (e.message || e) };
  }
}

async function _brokerAfterDecide(apRes) {
  try {
    const broker = _requireModule('safety_broker.cjs');
    if (!broker || typeof broker.findBinding !== 'function') return;
    if (!broker.syncWithWorkspace().ok) return;
    const b = broker.findBinding(apRes.approvalId);
    if (!b) return;
    if (b.status === 'approved') {
      const out = await broker.executeBinding(b.id, {});
      apRes.message += out.ok
        ? '\nBroker: executed "' + b.tool + '" under your approval.'
        : '\nBroker: approved, but execution failed (' + out.error + '). It stays retryable - say "sync the broker" after fixing.';
    } else if (b.status === 'denied') {
      apRes.message += '\nBroker: binding closed without executing anything.';
    }
  } catch (e) {
    apRes.message += '\nBroker hook error: ' + (e.message || e);
  }
}
  function _emitBus(type, payload, severity) {
  try {
    const bus = _requireModule('event_bus.cjs');
    if (bus && typeof bus.emit === 'function') bus.emit(type, payload, { source: 'orchestrator', severity });
  } catch (e) {}
}

function _activityStatus(userMessage, result) {
  try {
    const bus = _requireModule('event_bus.cjs');
    if (!bus || typeof bus.tail !== 'function') return { message: 'Event bus module not available (event_bus.cjs missing).' };
    const st = bus.status();
    const t = bus.tail(10);
    if (!t.ok || !t.events.length) {
      return { message: 'Event bus is empty so far (stored seq ' + (st.seq || 0) + '). Events appear as tasks, tools and system actions run.' };
    }
    const lines = t.events.slice().reverse().map((ev) => '- ' + String(ev.at).slice(11, 19) + ' [' + ev.type + '] ' + bus.summarize(ev));
    return { message: 'Recent activity (' + t.events.length + ' of ' + (st.seq || 0) + ' total events)\n' + lines.join('\n') };
  } catch (e) {
    return { message: 'activity_status failed: ' + (e.message || e) };
  }
}
    async function _timelineToday(userMessage, result) {
    const tl = _requireModule('task_timeline.cjs');
    if (!tl) return 'the task timeline module is not available right now.';
    result.actions.push({ step: 'timeline', detail: 'merging events, approvals and routines' });
    let b;
    try { b = tl.today(); } catch (e) { return 'timeline build failed: ' + (e.message || e); }
    _emitBus('timeline.viewed', { count: b.count, upcoming: b.upcomingCount });
    const counts = { events: 0, approvals: 0, pending: 0, errors: 0, scheduled: b.upcoming.length };
    for (const it of b.items) {
      if (it.kind === 'event') counts.events++;
      else if (it.kind === 'approval') counts.approvals++;
      else if (it.kind === 'pending') counts.pending++;
      else if (it.kind === 'error') counts.errors++;
    }
    const missing = [];
    for (const k of ['events', 'broker', 'workspace']) if (!b.sources[k]) missing.push(k);
    const head = 'Today: ' + counts.events + ' events, ' + counts.approvals + ' approvals, ' +
      counts.pending + ' pending, ' + counts.errors + ' errors' +
      (counts.scheduled ? ', ' + counts.scheduled + ' scheduled' : '') + '.' +
      (missing.length ? ' (unavailable sources: ' + missing.join(', ') + ')' : '');
    return head + '\n' + tl.render(b, 12).join('\n');
  }
    function _permissionsStatus(result) {
    const perms = _requireModule('tool_permissions.cjs');
    if (!perms) return 'the permissions module is not available right now.';
    const st = perms.status();
    const la = perms.listAgents();
    const lines = ['Tool permissions: ' + st.agents + ' agents, ' + st.allowRules + ' allow rules, ' + st.denyRules + ' deny rules.'];
    for (const a of la.agents.slice(0, 8)) {
      lines.push('- ' + a.agent + ' (default ' + a.default + ') allow: ' + (a.allow.join(', ') || 'none') + ' | deny: ' + (a.deny.join(', ') || 'none'));
    }
    if (!la.agents.length) lines.push('- no policies yet; every agent defaults to deny. Try "allow agent <name> to use <tool>".');
    return lines.join('\n');
  }

  function _permissionChange(userMessage, result) {
    const perms = _requireModule('tool_permissions.cjs');
    if (!perms) return 'the permissions module is not available right now.';
    const grant = userMessage.match(/\b(?:allow|grant)\s+(?:agent\s+)?([a-z0-9_-]+)\s+(?:to\s+(?:use|access)|use|access|tool)\s+([a-z0-9_*.-]+)/i);
    const revoke = userMessage.match(/\b(?:revoke|deny|block)\s+(?:agent\s+)?([a-z0-9_-]+)\s+(?:from\s+)?(?:tool\s+|access\s+to\s+|use\s+of\s+)?([a-z0-9_*.-]+)/i);
    const m = grant || revoke;
    if (!m) return 'usage: "allow agent <name> to use <tool>" or "revoke agent <name> tool <tool>".';
    const agent = m[1];
    const tool = m[2];
    const out = grant ? perms.grant({ agent, tool }) : perms.revoke({ agent, tool });
    if (!out.ok) return 'permission change failed: ' + (out.error || 'unknown');
    _emitBus('permission.changed', { action: grant ? 'grant' : 'revoke', agent, tool });
    result.actions.push({ step: 'permission', detail: (grant ? 'grant ' : 'revoke ') + agent + ' -> ' + tool });
    return (grant ? 'Allowed ' : 'Revoked ') + agent + ' ' + (grant ? 'to use ' : 'from using ') + tool + '.';
  }

  function _mcpStatus(result) {
    const mcp = _requireModule('mcp_manager.cjs');
    if (!mcp) return 'the mcp manager module is not available right now.';
    const st = mcp.status();
    const ls = mcp.listServers();
    const lines = ['MCP manager (skeleton): ' + st.count + ' servers (' + st.byTransport.stdio + ' stdio, ' + st.byTransport.http + ' http). Transports are not implemented yet.'];
    for (const s of ls.servers.slice(0, 8)) lines.push('- ' + s.name + ' [' + s.transport + ', ' + s.status + ']');
    if (!ls.servers.length) lines.push('- no servers registered; POST /api/mcp/register adds bookkeeping entries.');
    return lines.join('\n');
  }
  function _extractPath(msg) {
  const match = msg.match(/(?:at|in|to|from)\s+([A-Z]:\\[^\s]+)/i) || msg.match(/([A-Z]:\\[^\s]+)/i);
  return match ? match[1] : null;
}

// ── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  classifyIntent,
  executeCodingTask,
  CODING_INTENTS,
  getState: () => ({ ..._state }),
  stopTask: () => { _state.stopRequested = true; },
};
