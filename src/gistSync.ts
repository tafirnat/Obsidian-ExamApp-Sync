import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { ExamAppGistSyncSettings } from './settings';
import { findExamAppGist, createExamAppGist } from './githubApi';

const BACKUP_FILENAME = 'exam_app_backup.json';
const SOURCES_FILENAME = 'exam_app_sources.json';
const ARCHIVE_FILENAME = 'exam_app_archive.json';
const GITHUB_API_BASE = 'https://api.github.com';

async function ensureGistId(settings: ExamAppGistSyncSettings): Promise<string> {
    if (!settings.githubToken) {
        throw new Error('GitHub PAT token tanımlı değil. Lütfen eklenti ayarlarından oturum açın.');
    }

    if (settings.gistId) {
        return settings.gistId;
    }

    // Auto-discover
    const detectedId = await findExamAppGist(settings.githubToken);
    if (detectedId) {
        settings.gistId = detectedId;
        return detectedId;
    }

    // Auto-create
    const createdId = await createExamAppGist(settings.githubToken);
    settings.gistId = createdId;
    return createdId;
}

async function getFileContent(fileObj: any, token: string): Promise<string | null> {
    if (!fileObj) return null;
    let contentStr = fileObj.content;
    if (fileObj.truncated && fileObj.raw_url) {
        const rawResponse = await requestUrl({
            url: fileObj.raw_url,
            headers: {
                'Authorization': `Bearer ${token.trim()}`
            }
        });
        if (rawResponse.status === 200) {
            contentStr = rawResponse.text;
        }
    }
    return (contentStr && contentStr.trim().length > 0) ? contentStr : null;
}

export async function fetchGistData(settings: ExamAppGistSyncSettings): Promise<any> {
    const gistId = await ensureGistId(settings);
    const token = settings.githubToken.trim();

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${gistId}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };

    const response: RequestUrlResponse = await requestUrl(reqParams);
    
    if (response.status !== 200) {
        throw new Error(`GitHub Gist okuma hatası: ${response.status}`);
    }
    
    const gist = response.json;
    const files = gist.files || {};

    const backupContent = await getFileContent(files[BACKUP_FILENAME], token);
    const sourcesContent = await getFileContent(files[SOURCES_FILENAME], token);

    const backupJson = backupContent ? JSON.parse(backupContent) : null;
    const sourcesJson = sourcesContent ? JSON.parse(sourcesContent) : null;

    if (!backupJson && !sourcesJson) {
        return {
            version: 3,
            lastUpdated: Date.now(),
            sources: [],
            folders: [],
            deletedSourceIds: [],
            deletedFolderIds: [],
            stats: {},
            totalStats: {},
            recentTests: [],
            settings: {}
        };
    }

    const payload = backupJson ? { ...backupJson } : {};
    const inlineSources = Array.isArray(backupJson?.sources) ? backupJson.sources : [];
    const splitSources = Array.isArray(sourcesJson?.sources) ? sourcesJson.sources : null;

    let activeSources: any[] = [];
    if (!splitSources) {
        activeSources = inlineSources;
    } else {
        const inlineAt = backupJson?.lastUpdated || 0;
        const splitAt = sourcesJson?.lastUpdated || 0;
        activeSources = (inlineSources.length > 0 && inlineAt > splitAt) ? inlineSources : splitSources;
    }

    payload.sources = activeSources;
    payload.lastUpdated = Math.max(backupJson?.lastUpdated || 0, sourcesJson?.lastUpdated || 0);

    return payload;
}

export async function pushGistData(settings: ExamAppGistSyncSettings, payload: any): Promise<void> {
    const gistId = await ensureGistId(settings);
    const token = settings.githubToken.trim();
    const now = Date.now();

    // Prepare backup file payload (progress metadata without redundant heavy sources array)
    const backupPayload = {
        ...payload,
        sources: [],
        lastUpdated: now
    };

    // Prepare sources file payload
    const sourcesPayload = {
        sources: payload.sources || [],
        lastUpdated: now
    };

    const filesToPatch: Record<string, any> = {
        [BACKUP_FILENAME]: {
            content: JSON.stringify(backupPayload, null, 2)
        },
        [SOURCES_FILENAME]: {
            content: JSON.stringify(sourcesPayload, null, 2)
        }
    };

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${gistId}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            description: 'Exam App - User Study & Resource Data Sync (via Obsidian)',
            files: filesToPatch
        })
    };

    const response = await requestUrl(reqParams);

    if (response.status !== 200) {
        throw new Error(`GitHub Gist yazma hatası: ${response.status}`);
    }
}

