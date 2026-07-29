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
 * Format string for callouts ensuring each line is prefixed with '>'
 */
function formatCalloutContent(content: string): string {
    return content
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
}

/**
 * Generates and updates examApp_data.md in the target dataset directory.
 */
export async function generateMarkdownSummary(
    app: App,
    folderPath: string,
    sources: any[],
    syncStatus: string = 'Success'
): Promise<void> {
    const summaryFilePath = `${folderPath}/examApp_data.md`;

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

    const now = new Date();
    const updatedISO = now.toISOString();
    let createdISO = updatedISO;

    // Check if examApp_data.md already exists to preserve `created` timestamp & check for changes
    const existingFile = app.vault.getAbstractFileByPath(summaryFilePath);
    if (existingFile instanceof TFile) {
        try {
            const existingContent = await app.vault.read(existingFile);
            const createdMatch = existingContent.match(/^created:\s*["']?([^"'\r\n]+)["']?/m);
            if (createdMatch && createdMatch[1]) {
                createdISO = createdMatch[1].trim();
            }
        } catch (e) {
            console.warn('[ExamApp Sync] Could not read existing summary file created date:', e);
        }
    }

    // Calculation statistics
    const totalDatasets = sources.length;
    let totalQuestions = 0;
    sources.forEach(s => {
        if (Array.isArray(s.questions)) {
            totalQuestions += s.questions.length;
        }
    });

    const formattedSyncTime = now.toLocaleString('sv-SE').replace(' ', ' '); // YYYY-MM-DD HH:mm:ss format

    // 1. YAML Frontmatter
    let markdown = `---
title: ExamApp Dataset & Sync Dashboard
type: examapp-summary
created: ${createdISO}
updated: ${updatedISO}
tags:
  - examapp/dashboard
  - examapp/datasets
---

# 📊 ExamApp Dataset & Sync Dashboard

> [!abstract] Dashboard Overview
> - 📁 **Total Datasets / Sources**: \`${totalDatasets}\`
> - ❓ **Total Questions**: \`${totalQuestions}\`
> - 🔄 **Last Sync**: \`${formattedSyncTime}\` (\`${syncStatus}\`)

## 📑 Datasets Index

| Dataset Name | File Name | Questions | Categories / Tags | Last Modified |
| :--- | :--- | :---: | :--- | :--- |
`;

    if (sources.length === 0) {
        markdown += `| *No datasets found* | - | 0 | - | - |\n`;
    } else {
        sources.forEach(s => {
            const name = s.name || s.exam_metadata?.title || s.title || s.id || 'Untitled Dataset';
            const fileName = getDatasetFilename(s);
            const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
            
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
            const safeName = name.replace(/\|/g, '\\|');
            const safeFileName = fileName.replace(/\|/g, '\\|');
            const safeCategories = categories.replace(/\|/g, '\\|');

            markdown += `| **${safeName}** | \`${safeFileName}\` | ${qCount} | ${safeCategories} | ${lastMod} |\n`;
        });
    }

    markdown += `\n## 🔍 Dataset Details\n\n`;

    if (sources.length === 0) {
        markdown += `*No dataset details available.*\n`;
    } else {
        sources.forEach(s => {
            const title = s.name || s.exam_metadata?.title || s.title || s.id || 'Untitled Dataset';
            const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
            const description = s.description || s.exam_metadata?.description || '';

            let calloutInner = `**ID**: \`${s.id}\` | **Questions**: ${qCount}\n`;
            if (description) {
                calloutInner += `**Description**: ${description}\n`;
            }
            calloutInner += `\n### Questions Preview\n\n`;

            if (Array.isArray(s.questions) && s.questions.length > 0) {
                s.questions.forEach((q: any, index: number) => {
                    const qId = q.id !== undefined && q.id !== null ? q.id : index + 1;
                    const qType = q.type || 'unknown';
                    const qDifficulty = q.difficulty || q.metadata?.difficulty || 'N/A';
                    const rawText = q.content?.text || q.text || '(No text preview)';
                    const textPreview = String(rawText).replace(/\n/g, ' ').substring(0, 120);
                    const explanation = q.explanation || q.answer?.explanation || '';

                    calloutInner += `- **[#${qId}]** \`${qType}\` (Difficulty: *${qDifficulty}*)\n`;
                    calloutInner += `  - **Question**: ${textPreview}${rawText.length > 120 ? '...' : ''}\n`;
                    if (explanation) {
                        const expPreview = String(explanation).replace(/\n/g, ' ').substring(0, 150);
                        calloutInner += `  - **Explanation**: ${expPreview}${explanation.length > 150 ? '...' : ''}\n`;
                    }
                });
            } else {
                calloutInner += `*No questions in this dataset.*\n`;
            }

            markdown += `> [!info]+ Dataset: ${title}\n`;
            markdown += formatCalloutContent(calloutInner);
            markdown += `\n\n`;
        });
    }

    // Safe Atomic write: Check if file content changed to prevent redundant vault updates / triggers
    if (existingFile instanceof TFile) {
        try {
            const currentContent = await app.vault.read(existingFile);
            if (currentContent === markdown) {
                // Content is unchanged, no write needed
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
