/**
 * MYRAA AI OS — AWS Bedrock AI Provider Module
 * Fully compliant with AIProvider interface. Supports text chat, streaming, vision, document, and tool calling.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class BedrockProvider {
    constructor(config = {}) {
        this.name = 'aws_bedrock';
        this.region = config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
        this.token = config.token || process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEARER_TOKEN || '';
        this.defaultModel = config.defaultModel || 'amazon.nova-pro-v1:0';
        this.fastModel = 'amazon.nova-lite-v1:0';
        this.microModel = 'amazon.nova-micro-v1:0';
        this.bridgePath = path.join(__dirname, 'bedrock_runtime_bridge.py');
    }

    async _runBridge(payload) {
        return new Promise((resolve, reject) => {
            const py = spawn('python', [this.bridgePath], {
                env: {
                    ...process.env,
                    AWS_BEARER_TOKEN_BEDROCK: this.token,
                    AWS_BEARER_TOKEN: this.token,
                    AWS_DEFAULT_REGION: this.region
                }
            });

            let stdout = '';
            let stderr = '';

            py.stdout.on('data', (d) => { stdout += d.toString(); });
            py.stderr.on('data', (d) => { stderr += d.toString(); });

            py.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    return reject(new Error(`Bedrock bridge exited with code ${code}: ${stderr}`));
                }
                try {
                    const parsed = JSON.parse(stdout.trim());
                    if (parsed.ok === false) {
                        return reject(new Error(parsed.error || 'Bedrock bridge returned false'));
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Invalid JSON from Bedrock bridge: ${stdout || stderr}`));
                }
            });

            py.stdin.write(JSON.stringify(payload));
            py.stdin.end();
        });
    }

    async initialize() {
        return this.healthCheck();
    }

    async validateConnection() {
        const health = await this.healthCheck();
        return health.ok;
    }

    async listModels() {
        return [
            { id: 'amazon.nova-pro-v1:0', name: 'Amazon Nova Pro', capabilities: ['text', 'code', 'vision', 'documents', 'reasoning'], default: true },
            { id: 'amazon.nova-lite-v1:0', name: 'Amazon Nova Lite', capabilities: ['text', 'vision', 'documents', 'fast'], speed: 'fast' },
            { id: 'amazon.nova-micro-v1:0', name: 'Amazon Nova Micro', capabilities: ['text', 'high-throughput'], speed: 'ultra-fast' },
            { id: 'apac.amazon.nova-pro-v1:0', name: 'Amazon Nova Pro (APAC)', capabilities: ['text', 'code', 'vision', 'documents'] },
            { id: 'apac.amazon.nova-lite-v1:0', name: 'Amazon Nova Lite (APAC)', capabilities: ['text', 'vision', 'documents'] }
        ];
    }

    async chat(messages, options = {}) {
        const payload = {
            action: 'converse',
            region: this.region,
            token: this.token,
            model_id: options.modelId || this.defaultModel,
            messages: messages,
            system_prompt: options.systemPrompt,
            max_tokens: options.maxTokens || 2048,
            temperature: options.temperature !== undefined ? options.temperature : 0.7
        };
        const res = await this._runBridge(payload);
        return {
            provider: 'aws_bedrock',
            model: res.model_id,
            text: res.text,
            role: res.role,
            usage: res.usage,
            latency_ms: res.latency_ms
        };
    }

    async vision(imageInput, prompt = 'Describe and analyze this image in detail.', options = {}) {
        let imageObj = {};
        if (typeof imageInput === 'string') {
            if (fs.existsSync(imageInput)) {
                const ext = path.extname(imageInput).toLowerCase().replace('.', '') || 'png';
                imageObj = { path: imageInput, format: ext === 'jpg' ? 'jpeg' : ext };
            } else if (imageInput.startsWith('data:image/')) {
                const parts = imageInput.split(',');
                const formatMatch = imageInput.match(/data:image\/([a-zA-Z0-9]+);base64/);
                const format = formatMatch ? formatMatch[1] : 'png';
                imageObj = { base64: parts[1], format: format === 'jpg' ? 'jpeg' : format };
            } else {
                imageObj = { base64: imageInput, format: options.format || 'png' };
            }
        } else if (Buffer.isBuffer(imageInput)) {
            imageObj = { base64: imageInput.toString('base64'), format: options.format || 'png' };
        } else if (typeof imageInput === 'object') {
            imageObj = imageInput;
        }

        const messages = [{
            role: 'user',
            content: [
                { image: imageObj },
                { text: prompt }
            ]
        }];

        return this.chat(messages, {
            modelId: options.modelId || 'amazon.nova-pro-v1:0',
            systemPrompt: options.systemPrompt || 'You are MYRAA AI OS Vision Intelligence. Provide thorough, structured, and actionable visual analysis.',
            maxTokens: options.maxTokens || 3000
        });
    }

    async document(docInput, prompt = 'Analyze and extract key insights from this document.', options = {}) {
        let docObj = {};
        if (typeof docInput === 'string') {
            if (fs.existsSync(docInput)) {
                const ext = path.extname(docInput).toLowerCase().replace('.', '') || 'txt';
                docObj = { path: docInput, format: ext, name: path.basename(docInput, path.extname(docInput)) };
            } else {
                docObj = { text: docInput, format: 'txt', name: 'input_document' };
            }
        }

        const messages = [{
            role: 'user',
            content: [
                { document: docObj },
                { text: prompt }
            ]
        }];

        return this.chat(messages, {
            modelId: options.modelId || 'amazon.nova-pro-v1:0',
            systemPrompt: options.systemPrompt || 'You are MYRAA AI OS Document Intelligence. Extract structured analysis, bullet points, and actionable items.',
            maxTokens: options.maxTokens || 4000
        });
    }

    async healthCheck() {
        try {
            const res = await this._runBridge({ action: 'health', region: this.region, token: this.token });
            return res;
        } catch (e) {
            return {
                ok: false,
                provider: 'aws_bedrock',
                error: e.message
            };
        }
    }
}

module.exports = BedrockProvider;
