/**
 * MYRAA AI OS — Intelligent Model Router & Provider Abstraction Layer
 * Dynamically selects best models for coding, vision, planning, documents, fast tasks, and handles multi-tier fallback.
 */
const fs = require('fs');
const path = require('path');
const BedrockProvider = require('./bedrock_provider.cjs');

class ModelRouter {
    constructor() {
        this.providers = new Map();
        this.activeRoutingMode = 'auto'; // 'auto' | 'fast' | 'balanced' | 'smart' | 'deep_reasoning' | 'coding' | 'creative' | 'local' | 'cheapest'
        this.customProviders = [];
        this.initProviders();
    }

    initProviders() {
        // 1. AWS Bedrock Provider
        try {
            const bedrock = new BedrockProvider();
            this.providers.set('aws_bedrock', bedrock);
        } catch (e) {
            console.error('[ModelRouter] Failed to init Bedrock provider:', e.message);
        }

        // 2. Groq Provider
        this.providers.set('groq', {
            name: 'groq',
            async healthCheck() {
                const key = process.env.GROQ_API_KEY;
                return { ok: !!key, provider: 'groq' };
            },
            async chat(messages, options = {}) {
                const key = process.env.GROQ_API_KEY;
                if (!key) throw new Error('GROQ_API_KEY is not set');
                const model = options.modelId || 'llama-3.3-70b-versatile';
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model,
                        messages: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) })),
                        max_tokens: options.maxTokens || 2048,
                        temperature: options.temperature || 0.7
                    })
                });
                if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                return {
                    provider: 'groq',
                    model: model,
                    text: data.choices?.[0]?.message?.content || '',
                    role: 'assistant',
                    usage: data.usage
                };
            }
        });

        // 3. Gemini Provider
        this.providers.set('gemini', {
            name: 'gemini',
            async healthCheck() {
                const key = process.env.GEMINI_API_KEY;
                return { ok: !!key, provider: 'gemini' };
            },
            async chat(messages, options = {}) {
                const key = process.env.GEMINI_API_KEY;
                if (!key) throw new Error('GEMINI_API_KEY is not set');
                // 'gemini-2.0-flash' is RETIRED (404). Default follows project env like the gateway.
                const model = options.modelId || process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash';
                const formattedContents = messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
                }));
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: formattedContents })
                });
                if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return {
                    provider: 'gemini',
                    model: model,
                    text: text,
                    role: 'assistant'
                };
            }
        });

        // 4. Ollama / Local Provider
        this.providers.set('ollama', {
            name: 'ollama',
            async healthCheck() {
                try {
                    const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
                    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(1000) });
                    return { ok: res.ok, provider: 'ollama' };
                } catch {
                    return { ok: false, provider: 'ollama' };
                }
            },
            async chat(messages, options = {}) {
                const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
                const model = options.modelId || 'llama3';
                const res = await fetch(`${host}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        stream: false
                    })
                });
                if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
                const data = await res.json();
                return {
                    provider: 'ollama',
                    model: model,
                    text: data.message?.content || '',
                    role: 'assistant'
                };
            }
        });
    }

    setMode(mode) {
        const validModes = ['auto', 'fast', 'balanced', 'smart', 'deep_reasoning', 'coding', 'creative', 'local', 'cheapest'];
        if (validModes.includes(mode)) {
            this.activeRoutingMode = mode;
        }
    }

    getMode() {
        return this.activeRoutingMode;
    }

    route(taskType, preferences = {}) {
        const mode = preferences.mode || this.activeRoutingMode;

        // Multimodal Vision / Image
        if (taskType === 'vision' || taskType === 'image') {
            return {
                provider: 'aws_bedrock',
                modelId: 'amazon.nova-pro-v1:0',
                fallback: [
                    { provider: 'gemini', modelId: process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash' },
                    { provider: 'aws_bedrock', modelId: 'amazon.nova-lite-v1:0' }
                ]
            };
        }

        // Documents / PDF / Long context
        if (taskType === 'document' || taskType === 'doc' || taskType === 'pdf') {
            return {
                provider: 'aws_bedrock',
                modelId: 'amazon.nova-pro-v1:0',
                fallback: [
                    { provider: 'gemini', modelId: process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash' }
                ]
            };
        }

        // Coding / Architecture / Refactor
        if (taskType === 'coding' || mode === 'coding') {
            return {
                provider: 'aws_bedrock',
                modelId: 'amazon.nova-pro-v1:0',
                fallback: [
                    { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
                    { provider: 'gemini', modelId: process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash' }
                ]
            };
        }

        // Deep Reasoning / Planning / Architecture
        if (taskType === 'reasoning' || taskType === 'planning' || mode === 'deep_reasoning') {
            return {
                provider: 'aws_bedrock',
                modelId: 'amazon.nova-pro-v1:0',
                fallback: [
                    { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
                    { provider: 'gemini', modelId: process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash' }
                ]
            };
        }

        // Fast simple tasks
        if (taskType === 'fast' || mode === 'fast' || mode === 'cheapest') {
            return {
                provider: 'aws_bedrock',
                modelId: 'amazon.nova-lite-v1:0',
                fallback: [
                    { provider: 'groq', modelId: 'llama-3.1-8b-instant' },
                    { provider: 'aws_bedrock', modelId: 'amazon.nova-micro-v1:0' }
                ]
            };
        }

        // Local / Private mode
        if (mode === 'local') {
            return {
                provider: 'ollama',
                modelId: 'llama3',
                fallback: [
                    { provider: 'aws_bedrock', modelId: 'amazon.nova-lite-v1:0' }
                ]
            };
        }

        // Default Auto / Balanced
        return {
            provider: 'aws_bedrock',
            modelId: 'amazon.nova-pro-v1:0',
            fallback: [
                { provider: 'aws_bedrock', modelId: 'amazon.nova-lite-v1:0' },
                { provider: 'groq', modelId: 'llama-3.3-70b-versatile' },
                { provider: 'gemini', modelId: process.env.MYRAA_FAST_MODEL || 'gemini-3.5-flash' }
            ]
        };
    }

    async executeWithFallback(taskType, messages, options = {}) {
        const routePlan = this.route(taskType, options);
        const attempts = [{ provider: routePlan.provider, modelId: routePlan.modelId }, ...(routePlan.fallback || [])];

        let lastError = null;
        for (const target of attempts) {
            const prov = this.providers.get(target.provider);
            if (!prov) continue;
            try {
                if (taskType === 'vision' && typeof prov.vision === 'function' && options.image) {
                    return await prov.vision(options.image, options.prompt || messages[messages.length - 1]?.content, {
                        modelId: target.modelId,
                        ...options
                    });
                }
                if (taskType === 'document' && typeof prov.document === 'function' && options.document) {
                    return await prov.document(options.document, options.prompt || messages[messages.length - 1]?.content, {
                        modelId: target.modelId,
                        ...options
                    });
                }
                const result = await prov.chat(messages, {
                    modelId: target.modelId,
                    ...options
                });
                return result;
            } catch (err) {
                console.warn(`[ModelRouter] Provider ${target.provider}:${target.modelId} failed: ${err.message}. Trying next fallback...`);
                lastError = err;
            }
        }

        throw new Error(`All model providers in fallback chain failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
    }

    async getSystemHealth() {
        const results = {};
        for (const [name, prov] of this.providers.entries()) {
            if (typeof prov.healthCheck === 'function') {
                try {
                    results[name] = await prov.healthCheck();
                } catch (e) {
                    results[name] = { ok: false, error: e.message };
                }
            } else {
                results[name] = { ok: true, provider: name };
            }
        }
        return {
            activeMode: this.activeRoutingMode,
            providers: results
        };
    }
}

const instance = new ModelRouter();
module.exports = instance;
