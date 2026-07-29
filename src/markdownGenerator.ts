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
 * Generates and updates ExamApp_Overview.md in the target dataset directory.
 */
export async function generateMarkdownSummary(
    app: App,
    folderPath: string,
    sources: any[],
    syncStatus: string = 'Success'
): Promise<void> {
    const summaryFilePath = `${folderPath}/ExamApp_Overview.md`;
    const legacyFilePath = `${folderPath}/examApp_data.md`;

    // Ensure target folder exists
    let targetFolder = app.vault.getAbstractFileByPath(folderPath);
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        try {
            await app.vault.createFolder(folderPath);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create directory for summary: ${folderPath}`, e);
            return;
        }
    }

    // Clean up legacy examApp_data.md file if present
    const legacyFile = app.vault.getAbstractFileByPath(legacyFilePath);
    if (legacyFile instanceof TFile) {
        try {
            await app.vault.delete(legacyFile);
        } catch (e) {
            console.warn(`[ExamApp Sync] Could not delete legacy summary file (${legacyFilePath}):`, e);
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

    // Header & Content (100% English, no YAML frontmatter to prevent Obsidian localized Properties panel)
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

            markdown += `| **${safeTitle}** | [[${safeFileName}]] | ${qCount} | \`${appVersion}\` | ${safeCategories} | ${lastMod} |\n`;
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
