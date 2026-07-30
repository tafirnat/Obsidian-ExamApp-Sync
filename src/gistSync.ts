import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { ExamAppGistSyncSettings } from './settings';
import { findExamAppGist, createExamAppGist } from './githubApi';

const GIST_FILENAME = 'exam_app_backup.json';
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

export async function fetchGistData(settings: ExamAppGistSyncSettings): Promise<any> {
    const gistId = await ensureGistId(settings);

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${gistId}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${settings.githubToken.trim()}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };

    const response: RequestUrlResponse = await requestUrl(reqParams);
    
    if (response.status !== 200) {
        throw new Error(`GitHub Gist okuma hatası: ${response.status}`);
    }
    
    const gist = response.json;
    const file = gist.files && gist.files[GIST_FILENAME];
    
    if (file) {
        let contentStr = file.content;

        // GitHub Gist API truncates files larger than ~1MB and sets truncated = true.
        // If truncated, fetch the complete raw content from file.raw_url.
        if (file.truncated && file.raw_url) {
            const rawResponse = await requestUrl({
                url: file.raw_url,
                headers: {
                    'Authorization': `Bearer ${settings.githubToken.trim()}`
                }
            });
            if (rawResponse.status === 200) {
                contentStr = rawResponse.text;
            }
        }

        if (contentStr && contentStr.trim().length > 0) {
            return JSON.parse(contentStr);
        }
    }
    
    // Gist found but no exam_app_backup.json inside yet
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


export async function pushGistData(settings: ExamAppGistSyncSettings, payload: any): Promise<void> {
    const gistId = await ensureGistId(settings);

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${gistId}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${settings.githubToken.trim()}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            description: 'Exam App - User Study & Resource Data Sync (via Obsidian)',
            files: {
                [GIST_FILENAME]: {
                    content: JSON.stringify(payload, null, 2)
                }
            }
        })
    };

    const response = await requestUrl(reqParams);

    if (response.status !== 200) {
        throw new Error(`GitHub Gist yazma hatası: ${response.status}`);
    }
}
