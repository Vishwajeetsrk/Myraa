const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config({ path: 'd:/Team of Vishwajeet/.env' });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
console.log('Testing with API key prefix:', apiKey ? apiKey.substring(0, 10) : 'none');

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName) {
  console.log('\n--- Testing model:', modelName, '---');
  try {
    const session = await ai.live.connect({
      model: modelName,
      config: {
        responseModalities: ["AUDIO"],
      }
    });
    console.log('Session connected successfully for:', modelName);
    session.close();
  } catch (err) {
    console.error('Failed to connect with', modelName, ':', err.message || err);
  }
}

async function run() {
  await testModel("gemini-3.1-flash-live-preview");
  await testModel("gemini-2.0-flash-exp");
  await testModel("gemini-2.0-flash");
}

run();
