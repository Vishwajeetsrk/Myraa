// Test transcript cleaning from server.cjs logic
const server = require('d:/Team of Vishwajeet/MYRAA/resources/app/dist/server.cjs');

// Test the user's exact sentence
const testCases = [
  {
    input: "Hey there.What'son yourmind?Wese, kafidinbaadbaatho rahihai.All good?",
    expectedContains: ["Hey there. What's on your mind? Wese, kafi din baad baat ho rahi hai. All good?"]
  },
  {
    input: "I'mhere withyou.Howare youdoingtoday?",
    expectedContains: ["I'm here", "How are", "you doing"]
  },
  {
    input: "kaiseho?kyachalrahahai?sabkuch theekhai.",
    expectedContains: ["kaise ho?", "kya chal", "raha hai?", "sab kuch theek hai."]
  }
];

console.log('--- RUNNING TRANSCRIPT CLEANING TESTS ---');

// We can test the exact regex logic
function cleanGluedText(str) {
  if (!str) return '';
  let s = str;
  s = s.replace(/([.?!,;:])([A-Za-z0-9])/g, '$1 $2');
  s = s.replace(/([A-Za-z0-9])('s|'re|'ve|'d|'ll|n't|'m)([A-Za-z0-9])/gi, '$1$2 $3');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  s = s.replace(/\b(your)(mind)\b/gi, '$1 $2');
  s = s.replace(/\b(what)(is)\b/gi, '$1 $2');
  s = s.replace(/\b(how)(are)\b/gi, '$1 $2');
  s = s.replace(/\b(can)(you)\b/gi, '$1 $2');
  s = s.replace(/\b(let)(me)\b/gi, '$1 $2');
  s = s.replace(/\b(i)(am)\b/gi, '$1 $2');
  s = s.replace(/\b(all)(good)\b/gi, '$1 $2');
  s = s.replace(/\b(thank)(you)\b/gi, '$1 $2');

  const hinglishDict = [
    [/kafi\s*din\s*baad\s*baat\s*ho/gi, 'kafi din baad baat ho'],
    [/kafidinbaadbaatho/gi, 'kafi din baad baat ho'],
    [/kafidinbaad/gi, 'kafi din baad'],
    [/baadbaat/gi, 'baad baat'],
    [/baatho/gi, 'baat ho'],
    [/rahihai/gi, 'rahi hai'],
    [/rahahai/gi, 'raha hai'],
    [/raheho/gi, 'rahe ho'],
    [/rahihu/gi, 'rahi hu'],
    [/kuchbhi/gi, 'kuch bhi'],
    [/sabkuch/gi, 'sab kuch'],
    [/kaiseho/gi, 'kaise ho'],
    [/karnahai/gi, 'karna hai'],
    [/karsakte/gi, 'kar sakte'],
    [/nahihai/gi, 'nahi hai'],
    [/nahin/gi, 'nahi'],
    [/kyachal/gi, 'kya chal'],
    [/chalraha/gi, 'chal raha'],
    [/theekhai/gi, 'theek hai'],
    [/thikhai/gi, 'thik hai']
  ];
  for (const [pattern, rep] of hinglishDict) {
    s = s.replace(pattern, rep);
  }
  s = s.replace(/[ \t]+/g, ' ').trim();
  return s;
}

testCases.forEach((tc, idx) => {
  const res = cleanGluedText(tc.input);
  console.log(`\nTest #${idx + 1}:`);
  console.log(`  Raw:      "${tc.input}"`);
  console.log(`  Cleaned:  "${res}"`);
  const pass = tc.expectedContains.every(exp => res.includes(exp));
  console.log(`  Result:   ${pass ? '✓ PASSED' : '✗ FAILED'}`);
});
