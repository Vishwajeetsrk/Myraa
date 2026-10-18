const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['resources/app/dist/server.cjs'], {
  cwd: 'resources/app',
  stdio: 'pipe',
  env: { ...process.env, PORT: '3000' }
});

server.stdout.on('data', d => console.log('[STDOUT]', d.toString().slice(0, 100)));
server.stderr.on('data', d => console.error('[STDERR]', d.toString().slice(0, 100)));

function testUrl(url) {
  return new Promise(resolve => {
    http.get(url, res => {
      let len = 0;
      res.on('data', chunk => len += chunk.length);
      res.on('end', () => {
        resolve({ status: res.statusCode, contentType: res.headers['content-type'], length: len });
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

setTimeout(async () => {
  console.log('Testing asset endpoints...');
  const tests = [
    'http://localhost:3000/',
    'http://localhost:3000/assets/characters/evelyn/model.pmx',
    'http://localhost:3000/assets/characters/evelyn/textures.json',
    'http://localhost:3000/assets/characters/evelyn/textures/tex_0.png',
    'http://localhost:3000/assets/characters/nia/Nai.vrm',
    'http://localhost:3000/api/media/background-video'
  ];

  for (const t of tests) {
    const res = await testUrl(t);
    console.log(t, '->', res);
  }

  server.kill();
  process.exit(0);
}, 3000);
