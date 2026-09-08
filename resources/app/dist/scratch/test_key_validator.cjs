const fs = require('fs');
const path = require('path');

function getApiKey() {
  let key = process.env.GEMINI_API_KEY;
  if (key) return key;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'MYRAA', 'secrets.json')));
    if (s.geminiApiKey) return s.geminiApiKey;
  } catch(e) {}
  try {
    const env = fs.readFileSync('D:\\Team of Vishwajeet\\.env', 'utf8');
    const m = env.match(/GEMINI_API_KEY=([^\r\n]+)/);
    if (m) return m[1].replace(/['"]/g, '').trim();
  } catch(e) {}
  return null;
}

async function validateGeminiApiKey(k) {
  if (!k) return { ok: false, category: 'AUTH_FAILURE', message: 'Gemini API key is missing' };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}&pageSize=1`, { timeout: 4000 });
    const data = await res.json();
    if (res.status === 200) {
      return { ok: true, category: 'VALID', message: 'API key is valid and active' };
    }
    return {
      ok: false,
      category: 'AUTH_FAILURE',
      status: res.status,
      message: data.error?.message || 'Google rejected the API key'
    };
  } catch(e) {
    // If network fails, it is not an auth error, it is a network error!
    return {
      ok: false,
      category: 'NETWORK_DROP',
      message: `Network offline or unreachable: ${e.message}`
    };
  }
}

async function run() {
  const realKey = getApiKey();
  console.log('Testing Real Key (prefix: ' + (realKey ? realKey.slice(0, 8) + '...' : 'none') + '):');
  const realRes = await validateGeminiApiKey(realKey);
  console.log('Real Key Result:', realRes);

  console.log('\nTesting Broken Key ("AIzaSyBrokenKeyExample"):');
  const brokenRes = await validateGeminiApiKey('AIzaSyBrokenKeyExample');
  console.log('Broken Key Result:', brokenRes);
}

run();
