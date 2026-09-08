'use strict';

const crypto = require('crypto');

module.exports = {
  tools: [
    {
      name: 'myraa_time',
      description: 'Get current time in any timezone',
      inputSchema: {
        type: 'object',
        properties: {
          timezone: { type: 'string', description: 'IANA timezone (e.g. Asia/Kolkata, UTC)', default: 'Asia/Kolkata' },
          format: { type: 'string', enum: ['iso', 'unix', 'human'], default: 'iso' }
        }
      },
      handler(args) {
        const tz = args.timezone || 'Asia/Kolkata';
        const now = new Date();
        if (args.format === 'unix') return { ok: true, data: Math.floor(now.getTime() / 1000), timezone: tz };
        if (args.format === 'human') {
          return { ok: true, data: now.toLocaleString('en-IN', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }), timezone: tz };
        }
        return { ok: true, data: now.toLocaleString('sv-SE', { timeZone: tz }).replace(' ', 'T'), timezone: tz };
      }
    },
    {
      name: 'myraa_hash',
      description: 'Hash a string with various algorithms',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to hash' },
          algorithm: { type: 'string', enum: ['md5', 'sha256', 'sha512'], default: 'sha256' }
        },
        required: ['text']
      },
      handler(args) {
        if (!args.text) return { ok: false, error: 'text required' };
        const hash = crypto.createHash(args.algorithm || 'sha256').update(args.text).digest('hex');
        return { ok: true, hash, algorithm: args.algorithm || 'sha256' };
      }
    },
    {
      name: 'myraa_encode',
      description: 'Encode/decode base64',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to encode/decode' },
          mode: { type: 'string', enum: ['encode', 'decode'], default: 'encode' }
        },
        required: ['text']
      },
      handler(args) {
        if (!args.text) return { ok: false, error: 'text required' };
        try {
          if (args.mode === 'decode') {
            return { ok: true, data: Buffer.from(args.text, 'base64').toString('utf8'), mode: 'decode' };
          }
          return { ok: true, data: Buffer.from(args.text).toString('base64'), mode: 'encode' };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
    }
  ],

  hooks: {
    onChat(data) {
      if (data.text && data.text.toLowerCase().includes('what time')) {
        return { inject: `[Plugin: myraa-utils] Current time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` };
      }
      return null;
    }
  },

  onLoad({ manifest }) {
    console.log(`[myraa-utils] Plugin loaded — 3 tools available`);
  },

  onUnload() {
    console.log(`[myraa-utils] Plugin unloaded`);
  }
};
