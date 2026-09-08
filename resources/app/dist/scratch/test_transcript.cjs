function cleanGluedText(str) {
  if (!str) return '';
  let s = str;
  // 1. Punctuation spacing (e.g., 'there.What's' -> 'there. What's', 'rahihai.All' -> 'rahihai. All')
  s = s.replace(/([.?!,;:])([A-Za-z0-9])/g, '$1 $2');
  
  // 2. Glued contractions (e.g. "What'son" -> "What's on", "I'mhere" -> "I'm here")
  s = s.replace(/([A-Za-z0-9])('s|'re|'ve|'d|'ll|n't|'m)([A-Za-z0-9])/gi, '$1$2 $3');
  
  // 3. Glued camelCase or Capital transitions (e.g., 'mindWese' -> 'mind Wese')
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  // 4. Common glued English pairs
  s = s.replace(/\b(your)(mind)\b/gi, '$1 $2');
  s = s.replace(/\b(what)(is)\b/gi, '$1 $2');
  s = s.replace(/\b(how)(are)\b/gi, '$1 $2');
  s = s.replace(/\b(can)(you)\b/gi, '$1 $2');
  s = s.replace(/\b(let)(me)\b/gi, '$1 $2');

  // 5. Common glued Hindi/Hinglish compounds
  const hinglishPairs = [
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
    [/merenaam/gi, 'mere naam'],
    [/aapkaise/gi, 'aap kaise'],
    [/theekhai/gi, 'theek hai'],
    [/thikhai/gi, 'thik hai']
  ];
  for (const [pattern, rep] of hinglishPairs) {
    s = s.replace(pattern, rep);
  }

  // 6. Clean multiple spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const input = "Hey there.What'son yourmind?Wese, kafidinbaadbaatho rahihai.All good?";
console.log('INPUT: ', input);
console.log('OUTPUT:', cleanGluedText(input));
