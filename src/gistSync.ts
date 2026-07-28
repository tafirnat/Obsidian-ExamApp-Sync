import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { ExamAppGistSyncSettings } from './settings';

const GIST_FILENAME = 'exam_app_backup.json';
const GITHUB_API_BASE = 'https://api.github.com';

export async function fetchGistData(settings: ExamAppGistSyncSettings): Promise<any> {
    if (!settings.githubToken || !settings.gistId) {
        throw new Error('GitHub PAT veya Gist ID eksik.');
    }

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${settings.gistId}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${settings.githubToken}`,
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
    
    if (file && file.content) {
        return JSON.parse(file.content);
    }
    
    // Gist found but no exam_app_backup.json inside
    return {
        version: 2,
        sources: [],
        deletedSourceIds: [],
        stats: {},
        totalStats: {},
        recentTests: {},
        settings: {}
    };
}

export async function pushGistData(settings: ExamAppGistSyncSettings, payload: any): Promise<void> {
    if (!settings.githubToken || !settings.gistId) {
        throw new Error('GitHub PAT veya Gist ID eksik.');
    }

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists/${settings.gistId}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${settings.githubToken}`,
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
