/**
 * MYRAA AI OS — Unified Multimodal Intelligence Module
 * Processes Images, Documents, Audio, Video frames, and File batches with Bedrock Nova Pro and Vision models.
 */
const fs = require('fs');
const path = require('path');
const modelRouter = require('./model_router.cjs');

class MultimodalEngine {
    constructor() {}

    /**
     * IMAGE INTELLIGENCE
     * Options: 'describe' | 'ocr' | 'detect_ui' | 'visual_debug' | 'design_review' | 'general'
     */
    async analyzeImage(imageInput, taskType = 'general', customPrompt = null) {
        let systemPrompt = 'You are the MYRAA Vision Intelligence Engine.';
        let defaultPrompt = 'Describe and analyze this image in detail.';

        switch (taskType) {
            case 'ocr':
                defaultPrompt = 'Perform complete optical character recognition (OCR). Extract all visible text, headings, labels, and numbers verbatim with bounding context.';
                break;
            case 'detect_ui':
                defaultPrompt = 'Identify all UI elements: buttons, input fields, navigation bars, icons, modal dialogs, and layout hierarchy. Output a structured breakdown.';
                break;
            case 'visual_debug':
                defaultPrompt = 'Analyze this screenshot for visual bugs, alignment issues, broken layouts, clipped text, or error states. Provide root causes and CSS/layout fix suggestions.';
                break;
            case 'design_review':
                defaultPrompt = 'Perform a comprehensive UI/UX design review. Evaluate visual hierarchy, color harmony, typography readability, contrast ratios, and spatial rhythm.';
                break;
            case 'describe':
            default:
                defaultPrompt = customPrompt || 'Describe this image thoroughly, identifying all objects, text, people, environment, and overall context.';
                break;
        }

        const prompt = customPrompt || defaultPrompt;
        const result = await modelRouter.executeWithFallback('vision', [{ role: 'user', content: prompt }], {
            image: imageInput,
            prompt: prompt,
            systemPrompt: systemPrompt
        });

        return {
            taskType,
            model: result.model,
            provider: result.provider,
            analysis: result.text,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * DOCUMENT INTELLIGENCE
     * Formats: pdf, docx, txt, md, xlsx, csv, pptx
     */
    async analyzeDocument(docInput, taskType = 'summary', customPrompt = null) {
        let defaultPrompt = 'Analyze and summarize this document, extracting key findings and actionable takeaways.';

        switch (taskType) {
            case 'extract_data':
                defaultPrompt = 'Extract all structured tables, metrics, entities, and key numerical figures from this document in JSON format.';
                break;
            case 'qa':
                defaultPrompt = customPrompt || 'Answer questions based on the content of this document.';
                break;
            case 'summary':
            default:
                defaultPrompt = customPrompt || 'Provide an executive summary, main arguments, key facts, and next steps from this document.';
                break;
        }

        const result = await modelRouter.executeWithFallback('document', [{ role: 'user', content: defaultPrompt }], {
            document: docInput,
            prompt: defaultPrompt,
            systemPrompt: 'You are the MYRAA Document Intelligence Engine. Extract structured insights, tables, and crystal-clear summaries.'
        });

        return {
            taskType,
            model: result.model,
            provider: result.provider,
            output: result.text,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * VIDEO INTELLIGENCE
     * Extracts scenes and analyzes workflow / UI changes
     */
    async analyzeVideoFrames(frames, customPrompt = null) {
        const prompt = customPrompt || 'Analyze this sequence of video frames. Describe the timeline of events, user actions, UI transitions, and any errors or anomalies observed.';
        const messages = [{ role: 'user', content: prompt }];
        const result = await modelRouter.executeWithFallback('vision', messages, {
            image: frames[0],
            prompt: prompt,
            systemPrompt: 'You are the MYRAA Video & Workflow Intelligence Engine.'
        });

        return {
            model: result.model,
            provider: result.provider,
            timeline: result.text,
            frameCount: Array.isArray(frames) ? frames.length : 1,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * FILE INTELLIGENCE & CLASSIFICATION
     */
    async batchClassifyFiles(filePaths) {
        const results = [];
        for (const fp of filePaths) {
            if (!fs.existsSync(fp)) continue;
            const stats = fs.statSync(fp);
            const ext = path.extname(fp).toLowerCase();
            let category = 'Documents';

            if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico'].includes(ext)) {
                category = 'Images';
            } else if (['.pdf', '.docx', '.txt', '.md', '.rtf', '.odt'].includes(ext)) {
                category = 'Documents';
            } else if (['.xlsx', '.csv', '.tsv', '.xls'].includes(ext)) {
                category = 'Spreadsheets';
            } else if (['.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go', '.cpp', '.cs', '.java', '.html', '.css', '.json', '.yaml', '.toml'].includes(ext)) {
                category = 'Code';
            } else if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) {
                category = 'Videos';
            } else if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(ext)) {
                category = 'Audio';
            } else if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) {
                category = 'Archives';
            } else if (['.exe', '.msi', '.bat', '.cmd', '.ps1'].includes(ext)) {
                category = 'Installers_Scripts';
            }

            results.push({
                path: fp,
                name: path.basename(fp),
                sizeBytes: stats.size,
                extension: ext,
                category: category,
                modified: stats.mtime
            });
        }
        return results;
    }
}

const engine = new MultimodalEngine();
module.exports = engine;
