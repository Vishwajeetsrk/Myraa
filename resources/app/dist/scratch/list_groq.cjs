const fs = require('fs');
const env = fs.readFileSync('D:/Team of Vishwajeet/.env', 'utf8');
const m = env.match(/GROQ_API_KEY=([^\r\n]+)/);
const key = m ? m[1].replace(/['"]/g, '').trim() : '';

async function listGroqModels() {
  const r = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const data = await r.json();
  if (data.data) {
    console.log('Groq models:', data.data.map(m => m.id));
  } else {
    console.log('Error:', data);
  }
}

listGroqModels();
