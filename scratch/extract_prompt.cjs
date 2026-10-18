const fs = require('fs');
const readline = require('readline');

async function extractPrompt() {
  const filePath = 'C:/Users/Vishwajeet/.gemini/antigravity-ide/brain/58a6bf97-0377-465e-b453-a22355e48ceb/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lastPrompt = null;
  let lastStep = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' && obj.content && typeof obj.content === 'string' && obj.content.includes('MYRAA AUTONOMOUS DESIGN + ENGINEERING INTELLIGENCE V2')) {
        lastPrompt = obj.content;
        lastStep = obj.step_index;
      }
    } catch (e) {}
  }

  if (lastPrompt) {
    console.log('=== PROMPT FOUND (Length: ' + lastPrompt.length + ') ===');
    console.log(lastPrompt);
  } else {
    console.log('Prompt not found');
  }
}

extractPrompt();
