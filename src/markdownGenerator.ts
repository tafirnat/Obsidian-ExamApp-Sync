import { App, TFile, TFolder } from 'obsidian';

/**
 * Safe filename generation matching writeLocalSources in fileScanner.ts
 */
function getDatasetFilename(source: any): string {
    const title = source.name || source.exam_metadata?.title || source.title || source.id || 'Unknown_Source';
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    const shortId = (source.id || '00000000').substring(0, 8);
    return `${safeName}_${shortId}.json`;
}

/**
 * Resolves parent folder path and relative dataset subfolder name.
 */
function getSummaryLocation(folderPath: string): { parentFolderPath: string; relativeSubfolder: string } {
    const normalized = folderPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlashIndex = normalized.lastIndexOf('/');
    
    if (lastSlashIndex > 0) {
        const parentFolderPath = normalized.substring(0, lastSlashIndex);
        const relativeSubfolder = normalized.substring(lastSlashIndex + 1);
        return {
            parentFolderPath,
            relativeSubfolder
        };
    }
    
    return {
        parentFolderPath: normalized,
        relativeSubfolder: ''
    };
}

/**
 * Generates and updates 00_ExamApp_Overview.md in the parent folder of the dataset directory.
 */
export async function generateMarkdownSummary(
    app: App,
    folderPath: string,
    sources: any[],
    syncStatus: string = 'Success'
): Promise<void> {
    const { parentFolderPath, relativeSubfolder } = getSummaryLocation(folderPath);
    const summaryFilePath = `${parentFolderPath}/00_ExamApp_Overview.md`;

    // Ensure parent folder exists
    let targetFolder = app.vault.getAbstractFileByPath(parentFolderPath);
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        try {
            await app.vault.createFolder(parentFolderPath);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create directory for summary: ${parentFolderPath}`, e);
            return;
        }
    }

    const now = new Date();

    // Statistics calculation
    const totalDatasets = sources.length;
    let totalQuestions = 0;
    sources.forEach(s => {
        if (Array.isArray(s.questions)) {
            totalQuestions += s.questions.length;
        }
    });

    const formattedSyncTime = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:mm:ss

    // Header & Content (100% English, no YAML frontmatter to prevent localized Properties panel)
    let markdown = `# 📊 ExamApp Datasets & Sync Overview

> [!abstract] System Overview
> - 📁 **Total Datasets**: \`${totalDatasets}\`
> - ❓ **Total Questions**: \`${totalQuestions}\`
> - 🔄 **Last Sync**: \`${formattedSyncTime}\` (\`${syncStatus}\`)

## 📑 Datasets Index

| Dataset Title | JSON File | Questions | App Version | Categories / Tags | Last Modified |
| :--- | :--- | :---: | :---: | :--- | :--- |
`;

    if (sources.length === 0) {
        markdown += `| *No datasets found* | - | 0 | - | - | - |\n`;
    } else {
        sources.forEach(s => {
            const title = s.name || s.exam_metadata?.title || s.title || s.id || 'Untitled Dataset';
            const fileName = getDatasetFilename(s);
            const relativeFilePath = relativeSubfolder ? `${relativeSubfolder}/${fileName}` : fileName;
            const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
            const appVersion = s.target_version || s.version || s.exam_metadata?.version || 'N/A';
            
            let categories = '-';
            if (Array.isArray(s.categories) && s.categories.length > 0) {
                categories = s.categories.join(', ');
            } else if (Array.isArray(s.tags) && s.tags.length > 0) {
                categories = s.tags.join(', ');
            } else if (s.exam_metadata?.category) {
                categories = String(s.exam_metadata.category);
            }

            let lastMod = '-';
            if (s.lastUsed || s.lastUpdated || s.updatedAt) {
                const ts = s.lastUsed || s.lastUpdated || s.updatedAt;
                try {
                    lastMod = new Date(ts).toISOString().split('T')[0];
                } catch (e) {
                    lastMod = String(ts);
                }
            }

            // Clean markdown table special characters
            const safeTitle = title.replace(/\|/g, '\\|');
            const safeFileName = fileName.replace(/\|/g, '\\|');
            const safeCategories = categories.replace(/\|/g, '\\|');

            markdown += `| **${safeTitle}** | [[${relativeFilePath}|${safeFileName}]] | ${qCount} | \`${appVersion}\` | ${safeCategories} | ${lastMod} |\n`;
        });
    }

    markdown += `\n`;

    // Atomic write to vault file
    const existingFile = app.vault.getAbstractFileByPath(summaryFilePath);
    if (existingFile instanceof TFile) {
        try {
            const currentContent = await app.vault.read(existingFile);
            if (currentContent === markdown) {
                return;
            }
            await app.vault.modify(existingFile, markdown);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to update summary file: ${summaryFilePath}`, e);
        }
    } else {
        try {
            await app.vault.create(summaryFilePath, markdown);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create summary file: ${summaryFilePath}`, e);
        }
    }
}
