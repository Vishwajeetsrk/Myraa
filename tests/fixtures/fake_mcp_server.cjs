'use strict';
/**
 * Fake MCP stdio server for tests (Phase 25).
 * Newline-delimited JSON-RPC 2.0 over stdio. No dependencies, no network.
 * Tools: echo, add, wait (sleep), boom (json-rpc error), plus unknown -> error.
 * Prints one non-JSON banner line first to prove the client tolerates chatter.
 */

process.stdout.write('fake-mcp ready\n');

let buf = '';

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

function handle(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.method === 'initialize') {
    return send({ jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'fake-mcp', version: '1.0.0' },
    } });
  }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'tools/list') {
    return send({ jsonrpc: '2.0', id: msg.id, result: { tools: [
      { name: 'echo', description: 'Echo text back', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
      { name: 'add', description: 'Add two numbers', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } } },
      { name: 'wait', description: 'Sleep then respond', inputSchema: { type: 'object', properties: { ms: { type: 'number' } } } },
      { name: 'boom', description: 'Always fails with a json-rpc error', inputSchema: { type: 'object', properties: {} } },
    ] } });
  }
  if (msg.method === 'tools/call') {
    const name = msg.params && msg.params.name;
    const args = (msg.params && msg.params.arguments) || {};
    if (name === 'echo') return send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'echo: ' + String(args.text == null ? '' : args.text) }] } });
    if (name === 'add') return send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: String((Number(args.a) || 0) + (Number(args.b) || 0)) }] } });
    if (name === 'wait') {
      const ms = Math.min(Number(args.ms) || 0, 60000);
      return setTimeout(() => send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'slept ' + ms }] } }), ms);
    }
    if (name === 'boom') return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'boom requested' } });
    return send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown tool: ' + name } });
  }
  if (msg.id != null) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'method not found: ' + msg.method } });
}

process.stdin.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) {}
  }
});
process.stdin.on('end', () => process.exit(0));
