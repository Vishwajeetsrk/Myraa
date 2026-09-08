/**
 * MYRAA AI OS — Smart File System Organizer Service
 * Organizes directories, categorizes files, supports custom exclusion rules ("Active Projects"), dry-run preview, and atomic rollback / undo history.
 */
const fs = require('fs');
const path = require('path');

class FileOrganizerService {
    constructor() {
        this.historyDir = path.join(process.env.APPDATA || process.env.USERPROFILE || '.', 'MYRAA', 'file_history');
        fs.mkdirSync(this.historyDir, { recursive: true });
        this.operations = new Map();
    }

    categorizeFile(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'].includes(ext)) return 'Images';
        if (['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf'].includes(ext)) return 'Documents';
        if (['.xlsx', '.xls', '.csv', '.tsv'].includes(ext)) return 'Spreadsheets';
        if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'Videos';
        if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(ext)) return 'Audio';
        if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) return 'Archives';
        if (['.exe', '.msi', '.bat', '.ps1', '.cmd'].includes(ext)) return 'Installers';
        if (['.js', '.ts', '.py', '.rs', '.go', '.cpp', '.cs', '.java', '.html', '.css', '.json'].includes(ext)) return 'Code';
        return 'Other';
    }

    /**
     * Preview organization plan without moving files
     */
    async planOrganization(targetDir, exclusions = ['Active Projects', 'node_modules', '.git']) {
        if (!fs.existsSync(targetDir)) {
            throw new Error(`Directory does not exist: ${targetDir}`);
        }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const proposedMoves = [];
        const skipped = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (exclusions.some(exc => entry.name.toLowerCase().includes(exc.toLowerCase()))) {
                    skipped.push({ name: entry.name, reason: 'Matched exclusion pattern' });
                }
                continue;
            }

            const fileName = entry.name;
            if (exclusions.some(exc => fileName.toLowerCase().includes(exc.toLowerCase()))) {
                skipped.push({ name: fileName, reason: 'Matched exclusion pattern' });
                continue;
            }

            const category = this.categorizeFile(fileName);
            const sourcePath = path.join(targetDir, fileName);
            const destDir = path.join(targetDir, category);
            const destPath = path.join(destDir, fileName);

            proposedMoves.push({
                fileName,
                category,
                sourcePath,
                destPath
            });
        }

        return {
            targetDir,
            totalFiles: proposedMoves.length,
            proposedMoves,
            skipped,
            previewOnly: true
        };
    }

    /**
     * Execute organization with atomic rollback record
     */
    async executeOrganization(targetDir, exclusions = ['Active Projects', 'node_modules', '.git']) {
        const plan = await this.planOrganization(targetDir, exclusions);
        const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const executedMoves = [];
        const errors = [];

        for (const item of plan.proposedMoves) {
            try {
                const destFolder = path.dirname(item.destPath);
                fs.mkdirSync(destFolder, { recursive: true });
                fs.renameSync(item.sourcePath, item.destPath);
                executedMoves.push({
                    from: item.sourcePath,
                    to: item.destPath
                });
            } catch (err) {
                errors.push({ file: item.fileName, error: err.message });
            }
        }

        const record = {
            operation_id: opId,
            timestamp: new Date().toISOString(),
            targetDir,
            moves: executedMoves,
            errors
        };

        const recordPath = path.join(this.historyDir, `${opId}.json`);
        fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');
        this.operations.set(opId, record);

        return {
            operation_id: opId,
            success: errors.length === 0,
            movedCount: executedMoves.length,
            errorCount: errors.length,
            errors,
            rollbackAvailable: true
        };
    }

    /**
     * Rollback a previous organization operation
     */
    async rollback(operationId) {
        let record = this.operations.get(operationId);
        if (!record) {
            const recordPath = path.join(this.historyDir, `${operationId}.json`);
            if (fs.existsSync(recordPath)) {
                record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
            }
        }

        if (!record) {
            throw new Error(`Operation record not found for ID: ${operationId}`);
        }

        const restored = [];
        const rollbackErrors = [];

        for (const item of (record.moves || [])) {
            try {
                if (fs.existsSync(item.to)) {
                    fs.mkdirSync(path.dirname(item.from), { recursive: true });
                    fs.renameSync(item.to, item.from);
                    restored.push({ from: item.to, to: item.from });
                }
            } catch (err) {
                rollbackErrors.push({ file: item.to, error: err.message });
            }
        }

        return {
            operation_id: operationId,
            status: 'ROLLED_BACK',
            restoredCount: restored.length,
            errors: rollbackErrors
        };
    }
}

const service = new FileOrganizerService();
module.exports = service;
