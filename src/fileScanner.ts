import { App, TFile, TFolder } from 'obsidian';
import { validateExamSchema } from './schemaValidator';

async function ensureSubfolders(app: App, folderPath: string): Promise<void> {
    const subfolders = ['', '/Archived', '/Backup', '/Deleted'];
    for (const sub of subfolders) {
        const path = `${folderPath}${sub}`;
        const folder = app.vault.getAbstractFileByPath(path);
        if (!folder) {
            try {
                await app.vault.createFolder(path);
            } catch (e) {
                // Ignore if created concurrently
            }
        }
    }
}

export async function scanLocalSources(app: App, folderPath: string): Promise<any[]> {
    await ensureSubfolders(app, folderPath);
    const targetFolder = app.vault.getAbstractFileByPath(folderPath);
    
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        console.warn(`[ExamApp Sync] Hedef klasör bulunamadı: ${folderPath}`);
        return [];
    }

    const validSources: any[] = [];

    // Scan active .json files directly under folderPath (Backup subfolder is strictly local and EXCLUDED from Gist sync)
    for (const child of targetFolder.children) {
        if (child instanceof TFile && child.extension === 'json') {
            try {
                const content = await app.vault.read(child);
                if (!content || content.trim().length === 0) continue;
                const data = JSON.parse(content);
                
                const { valid, isExamAppSource } = validateExamSchema(data);
                
                if (isExamAppSource && valid) {
                    validSources.push(data);
                } else if (isExamAppSource && !valid) {
                    console.warn(`[ExamApp Sync] Dosya (${child.path}) ExamApp yapısına benziyor fakat şema hatası içeriyor. Atlanıyor.`);
                }
            } catch (err) {
                console.error(`[ExamApp Sync] JSON okuma hatası (${child.path}):`, err);
            }
        }
    }

    return validSources;
}

export async function writeLocalSources(app: App, folderPath: string, sources: any[]): Promise<void> {
    await ensureSubfolders(app, folderPath);

    for (const source of sources) {
        const safeName = (source.name || source.id || 'Unknown_Source').replace(/[\\/:*?"<>|]/g, '_');
        const shortId = (source.id || '00000000').substring(0, 8);
        
        let targetSubfolder = '';
        if (source.isDeleted) {
            targetSubfolder = '/Deleted';
        } else if (source.isArchived) {
            targetSubfolder = '/Archived';
        }

        const filePath = `${folderPath}${targetSubfolder}/${safeName}_${shortId}.json`;
        const content = JSON.stringify(source, null, 2);
        
        const existingFile = app.vault.getAbstractFileByPath(filePath);
        if (existingFile instanceof TFile) {
            await app.vault.modify(existingFile, content);
        } else {
            await app.vault.create(filePath, content);
        }
    }
}

export async function cleanupOldDirectory(app: App, oldFolderPath: string, newFolderPath: string): Promise<number> {
    if (!oldFolderPath || oldFolderPath.trim() === '' || oldFolderPath === newFolderPath) {
        return 0;
    }

    const oldFolder = app.vault.getAbstractFileByPath(oldFolderPath);
    if (!oldFolder || !(oldFolder instanceof TFolder)) {
        return 0;
    }

    let deletedCount = 0;
    const children = [...oldFolder.children];

    for (const child of children) {
        if (!(child instanceof TFile)) continue;

        if (child.name === 'examApp_data.md' || child.name === 'ExamApp_Overview.md') {
            try {
                await app.vault.delete(child);
                deletedCount++;
            } catch (err) {
                console.error(`[ExamApp Sync] Failed to delete summary file in old directory (${child.path}):`, err);
            }
        } else if (child.extension === 'json') {
            try {
                const content = await app.vault.read(child);
                const data = JSON.parse(content);
                const { isExamAppSource } = validateExamSchema(data);

                if (isExamAppSource) {
                    await app.vault.delete(child);
                    deletedCount++;
                }
            } catch (err) {
                console.error(`[ExamApp Sync] Failed during garbage collection of file (${child.path}):`, err);
            }
        }
    }

    if (oldFolder.children.length === 0) {
        try {
            await app.vault.delete(oldFolder);
        } catch (err) {
            console.warn(`[ExamApp Sync] Could not delete empty old directory (${oldFolderPath}):`, err);
        }
    }

    return deletedCount;
}


