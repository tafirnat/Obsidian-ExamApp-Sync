import { App, TFile, TFolder } from 'obsidian';
import { validateExamSchema } from './schemaValidator';

export async function scanLocalSources(app: App, folderPath: string): Promise<any[]> {
    const targetFolder = app.vault.getAbstractFileByPath(folderPath);
    
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        console.warn(`[ExamApp Sync] Hedef klasör bulunamadı: ${folderPath}`);
        return [];
    }

    const validSources: any[] = [];

    for (const child of targetFolder.children) {
        if (child instanceof TFile && child.extension === 'json') {
            try {
                const content = await app.vault.read(child);
                const data = JSON.parse(content);
                
                const { valid, isExamAppSource } = validateExamSchema(data);
                
                if (isExamAppSource && valid) {
                    validSources.push(data);
                } else if (isExamAppSource && !valid) {
                    console.warn(`[ExamApp Sync] Dosya (${child.path}) ExamApp yapısına benziyor fakat şema hatası içeriyor. Atlanıyor.`);
                }
                // If not an ExamApp source at all, just ignore silently.
            } catch (err) {
                console.error(`[ExamApp Sync] JSON okuma hatası (${child.path}):`, err);
            }
        }
    }

    return validSources;
}

export async function writeLocalSources(app: App, folderPath: string, sources: any[]): Promise<void> {
    const targetFolder = app.vault.getAbstractFileByPath(folderPath);
    
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        try {
            await app.vault.createFolder(folderPath);
        } catch (e) {
            console.error(`[ExamApp Sync] Hedef klasör oluşturulamadı: ${folderPath}`, e);
            return;
        }
    }

    for (const source of sources) {
        // Safe filename
        const safeName = (source.name || source.id || 'Unknown_Source').replace(/[\\/:*?"<>|]/g, '_');
        const filePath = `${folderPath}/${safeName}_${source.id.substring(0, 8)}.json`;
        
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
    // Collect children to avoid mutation issues during iteration
    const children = [...oldFolder.children];

    for (const child of children) {
        if (!(child instanceof TFile)) continue;

        if (child.name === 'examApp_data.md') {
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

    // Delete directory if empty
    if (oldFolder.children.length === 0) {
        try {
            await app.vault.delete(oldFolder);
        } catch (err) {
            console.warn(`[ExamApp Sync] Could not delete empty old directory (${oldFolderPath}):`, err);
        }
    }

    return deletedCount;
}

