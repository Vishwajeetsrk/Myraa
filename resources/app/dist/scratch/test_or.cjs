const fs = require('fs');
const env = fs.readFileSync('D:/Team of Vishwajeet/.env', 'utf8');
const m = env.match(/OPENROUTER_API_KEY=([^\r\n]+)/);
const key = m ? m[1].replace(/['"]/g, '').trim() : '';

async function testOpenRouter() {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'user', content: 'Say hello in 5 words' }]
    })
  });
  const data = await r.json();
  console.log('OpenRouter Status:', r.status, 'Response:', data.choices?.[0]?.message?.content || data.error?.message);
}
testOpenRouter();
