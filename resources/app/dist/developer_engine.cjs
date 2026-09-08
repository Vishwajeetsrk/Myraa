/**
 * MYRAA AI OS — Developer Intelligence Engine
 * Handles code generation, multi-file editing, bug fixing, refactoring, linting, git workflows, and project scaffolding.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const modelRouter = require('./model_router.cjs');

class DeveloperEngine {
    constructor() {}

    /**
     * Scaffold or generate code files based on prompt and project context
     */
    async generateProject(prompt, targetDir, options = {}) {
        const systemPrompt = `You are MYRAA Lead Developer Engine. You generate full-stack, modular, and production-ready code.
Always respond with valid JSON matching this exact structure:
{
  "project_name": "...",
  "description": "...",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "Full source code of the file"
    }
  ],
  "dependencies": ["package1", "package2"],
  "setup_instructions": "npm install && npm run dev"
}`;

        const messages = [{ role: 'user', content: `Generate project for: ${prompt}\nFramework preferences: ${options.framework || 'Vite + React + Tailwind'}` }];
        const res = await modelRouter.executeWithFallback('coding', messages, {
            systemPrompt: systemPrompt,
            temperature: 0.2,
            maxTokens: 4096
        });

        let generated;
        try {
            const jsonMatch = res.text.match(/\{[\s\S]*\}/);
            generated = JSON.parse(jsonMatch ? jsonMatch[0] : res.text);
        } catch (e) {
            throw new Error(`Failed to parse generated project JSON: ${e.message}`);
        }

        // Write files to target directory if requested
        if (targetDir && generated.files) {
            for (const f of generated.files) {
                const fullPath = path.isAbsolute(f.path) ? f.path : path.join(targetDir, f.path);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, f.content, 'utf8');
            }
        }

        return {
            success: true,
            model: res.model,
            project: generated
        };
    }

    /**
     * Analyze code for bugs and produce fixes
     */
    async fixBugs(code, errorMessage = '', context = {}) {
        const prompt = `Code:\n\`\`\`\n${code}\n\`\`\`\n\nError Message / Behavior:\n${errorMessage}\n\nContext: ${JSON.stringify(context)}\n\nIdentify all bugs, explain root causes, and provide the complete corrected code.`;
        const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
            systemPrompt: 'You are MYRAA Developer Intelligence Bug Fixing Specialist. Provide root-cause analysis and fixed drop-in replacements.'
        });

        return {
            analysis: res.text,
            model: res.model,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Refactor code for readability, performance, or modern paradigms
     */
    async refactorCode(code, goal = 'Improve performance, type safety, and modularity') {
        const prompt = `Refactor the following code with the goal: "${goal}"\n\nSource Code:\n\`\`\`\n${code}\n\`\`\``;
        const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
            systemPrompt: 'You are MYRAA Senior Refactoring Specialist. Optimize architecture while strictly preserving functionality.'
        });

        return {
            refactoredCode: res.text,
            model: res.model
        };
    }

    /**
     * Run local linter / syntax check on a file
     */
    async lintFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return { ok: false, error: 'File not found' };
        }
        const ext = path.extname(filePath).toLowerCase();
        try {
            if (['.js', '.cjs', '.mjs', '.json'].includes(ext)) {
                // Syntax check via node -c
                execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
                return { ok: true, file: filePath, message: 'Syntax valid' };
            }
            if (ext === '.py') {
                execSync(`python -m py_compile "${filePath}"`, { stdio: 'pipe' });
                return { ok: true, file: filePath, message: 'Python syntax valid' };
            }
            return { ok: true, file: filePath, message: 'No specific linter required' };
        } catch (err) {
            return { ok: false, file: filePath, error: err.stderr ? err.stderr.toString() : err.message };
        }
    }
}

const engine = new DeveloperEngine();
module.exports = engine;
