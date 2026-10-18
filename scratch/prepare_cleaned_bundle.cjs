const fs = require('fs');
const cp = require('child_process');

const tempPath = 'scratch/cleaned_bundle.js';

// Get original bundle from git HEAD
const original = cp.execSync('git show HEAD:resources/app/dist/assets/index-qnLjC2CG.js', { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');

console.log('Original length:', original.length);

// Rule #1: Replace ALL emojis with ASCII symbols / approved symbols
// Approved ASCII fallbacks: [OK], [X], [!], [*], [-], [>], [+]
let cleaned = original
  .replace(/💡/g, '[*]')
  .replace(/🎙/g, '[>]')
  .replace(/⚡/g, '[*]')
  .replace(/✓/g, '[OK]');

// Verify no emojis remain
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
const remainingEmojis = cleaned.match(emojiRegex);
console.log('Remaining emojis:', remainingEmojis ? remainingEmojis.length : 0);

// Verify audio pipeline components exist
const hasOutputAudioCtx = cleaned.includes('this.outputAudioCtx');
const hasPlayAudioPCMChunk = cleaned.includes('playAudioPCMChunk');
const hasMyraaSpeak = cleaned.includes('myraaSpeak');
const hasSpeechSynthesis = cleaned.includes('speechSynthesis');

console.log('hasOutputAudioCtx:', hasOutputAudioCtx);
console.log('hasPlayAudioPCMChunk:', hasPlayAudioPCMChunk);
console.log('hasMyraaSpeak:', hasMyraaSpeak);
console.log('hasSpeechSynthesis:', hasSpeechSynthesis);

if (!hasOutputAudioCtx || !hasPlayAudioPCMChunk) {
  console.error('CRITICAL: Audio pipeline components missing from original!');
  process.exit(1);
}

// Write to temp file
fs.writeFileSync(tempPath, cleaned, 'utf8');
console.log('Successfully wrote to temp file:', tempPath);
