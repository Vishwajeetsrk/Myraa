const fs = require('fs');
const env = fs.readFileSync('D:/Team of Vishwajeet/.env', 'utf8');
const m = env.match(/GROQ_API_KEY=([^\r\n]+)/);
const key = m ? m[1].replace(/['"]/g, '').trim() : '';

async function testGroqModel(model) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say hello in 5 words' }]
    })
  });
  const data = await r.json();
  console.log(model, 'Status:', r.status, 'Response:', data.choices?.[0]?.message?.content || data.error?.message);
}

async function run() {
  await testGroqModel('openai/gpt-oss-120b');
  await testGroqModel('openai/gpt-oss-20b');
  await testGroqModel('groq/compound-mini');
}
run();
