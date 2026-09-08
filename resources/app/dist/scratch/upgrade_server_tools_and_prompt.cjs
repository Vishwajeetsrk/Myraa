const fs = require('fs');
const path = require('path');

const targetDirs = [
  'C:/Users/Vishwajeet/Music/Myraa/resources/app/dist',
  'C:/Users/Vishwajeet/AppData/Local/Programs/MYRAA-AI-OS/resources/app/dist'
];

for (const dir of targetDirs) {
  const serverPath = path.join(dir, 'server.cjs');
  if (!fs.existsSync(serverPath)) continue;
  let content = fs.readFileSync(serverPath, 'utf8');

  // 1. Add tools to DESKTOP_TOOLS set if missing
  const toolsToAdd = [
    'editWord', 'createWord', 'createWordDocument', 'wordDocument',
    'editExcel', 'createExcel', 'createExcelDocument', 'excelSpreadsheet',
    'editPowerPoint', 'createPowerPoint', 'pptPresentation',
    'openPaint', 'editPaint', 'printDocument', 'print', 'msPrint',
    'editVsCode', 'openVsCode', 'writeVsCode',
    'wifiControl', 'bluetoothControl', 'getWeather', 'getDateTime',
    'getTodayTasks', 'addTodayTask', 'searchApp', 'installApp', 'uninstallApp',
    'createWebsiteProject', 'createResume', 'createPrdReport', 'createClientEmail', 'learnGitHubRepo'
  ];

  for (const t of toolsToAdd) {
    if (!content.includes(`"${t}",`)) {
      content = content.replace('var DESKTOP_TOOLS = /* @__PURE__ */ new Set([', `var DESKTOP_TOOLS = /* @__PURE__ */ new Set([\n  "${t}",`);
    }
  }

  // 2. Add handlers to Desktop Native Fallback
  const extraHandlers = `
      if (tool === "wifiControl" || tool === "wifi") return nativeDA.wifiControl(args);
      if (tool === "bluetoothControl" || tool === "bluetooth") return nativeDA.bluetoothControl(args);
      if (tool === "getWeather" || tool === "weather") return await nativeDA.getWeather(args.location || args.city);
      if (tool === "getDateTime" || tool === "dateTime" || tool === "date" || tool === "time") return nativeDA.getDateTime();
      if (tool === "getTodayTasks" || tool === "todayTasks" || tool === "todayProgress") return nativeDA.getTodayTasks();
      if (tool === "addTodayTask") return nativeDA.addTodayTask(args.title || args.task, args.priority);
      if (tool === "searchApp" || tool === "findApp") return nativeDA.searchApp(args.name || args.appName);
      if (tool === "installApp") return nativeDA.installApp(args.name || args.appName);
      if (tool === "uninstallApp") return nativeDA.uninstallApp(args.name || args.appName);
      if (tool === "createWebsiteProject" || tool === "createWebsite") return nativeDA.createWebsiteProject(args.projectName || args.name, args.description || args.prompt);
      if (tool === "createResume") return nativeDA.createResume(args.candidateName || args.name, args.details);
      if (tool === "createPrdReport" || tool === "createPrd") return nativeDA.createPrdReport(args.featureName || args.name, args.specDetails || args.details);
      if (tool === "createClientEmail") return nativeDA.createClientEmail(args.clientName || args.recipient, args.subject, args.bodyDetails || args.body);
      if (tool === "learnGitHubRepo") return nativeDA.learnGitHubRepo(args.repoUrl || args.url);`;

  if (!content.includes('tool === "wifiControl"')) {
    content = content.replace(
      'console.warn(`[Desktop Native Fallback] No native handler for tool: ${tool}`);',
      `${extraHandlers}\n      console.warn(\`[Desktop Native Fallback] No native handler for tool: \${tool}\`);`
    );
  }

  // 3. Update capability instructions with absolute computer control & writing authority
  const newCapHeader = `"CAPABILITIES AND OPERATING CONTRACT:",
        "- 100% DIRECT COMPUTER CONTROL & TYPING AUTHORITY: You have full, unrestricted power to write, edit, type, and control ANY software on the user's PC (Microsoft Word, Excel, PowerPoint, VS Code, Notepad, Browser, Terminal, Windows Settings).",
        "- ZERO REFUSAL RULE FOR APPS: NEVER say 'Main directly type nahi kar paungi' or 'tum use copy paste kar lena'. When asked to write a report, code, letter, or email in MS Word, Excel, or any app, IMMEDIATELY execute it using typeText, editWord, editExcel, editVsCode, or generate the file directly and launch it for the user.",
        "- SYSTEM CONTROLS: You directly control volume, brightness, Wi-Fi, Bluetooth, Start Menu, winget app install/uninstall, live weather, and task tracking.",`;

  if (!content.includes('ZERO REFUSAL RULE FOR APPS')) {
    content = content.replace('"CAPABILITIES AND OPERATING CONTRACT:",', newCapHeader);
  }

  // 4. Update presence instructions rule 0
  const newPresenceHeader = `"HIGHEST PRIORITY CONVERSATION RULES:",
        "0. FEMALE IDENTITY & STRICT GRAMMAR RULE: MYRAA is strictly female. In Hindi or Hinglish self-references, ALWAYS use feminine grammar ('Main karti hoon', 'Main samajh gayi', 'Main dekh rahi hoon', 'Main kar sakti hoon', 'Main check kar rahi hoon', 'Main try karungi', 'Maine find kar liya'). NEVER use masculine forms ('karta hoon', 'samajh gaya', 'kar sakta hoon', 'dekh raha hoon', 'karunga', 'kar dunga', 'bol raha hoon').",
        "0b. ACTIVE WORKFLOW EXECUTION: When the user asks you to write in Word, edit Excel, control settings, or check weather, DO NOT claim technical inability. You have direct desktop tools. Announce confidently that you are doing it ('Haan, main Word me likh rahi hoon', 'Main settings change kar rahi hoon') and trigger the action immediately.",`;

  if (!content.includes('0b. ACTIVE WORKFLOW EXECUTION')) {
    content = content.replace(
      `"0. FEMALE IDENTITY & STRICT GRAMMAR RULE: MYRAA is strictly female. In Hindi or Hinglish self-references, ALWAYS use feminine grammar ('Main karti hoon', 'Main samajh gayi', 'Main dekh rahi hoon', 'Main kar sakti hoon', 'Main check kar rahi hoon', 'Main try karungi', 'Maine find kar liya'). NEVER use masculine forms ('karta hoon', 'samajh gaya', 'kar sakta hoon', 'dekh raha hoon', 'karunga', 'kar dunga', 'bol raha hoon').",`,
      newPresenceHeader
    );
  }

  fs.writeFileSync(serverPath, content, 'utf8');
  console.log(`[Server Upgraded] Synchronized tools and directives in ${serverPath}`);
}
