import { requestUrl, RequestUrlParam } from 'obsidian';

const BACKUP_FILENAME = 'exam_app_backup.json';
const SOURCES_FILENAME = 'exam_app_sources.json';
const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubUser {
    login: string;
    avatarUrl?: string;
    name?: string;
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
    if (!token || !token.trim()) {
        throw new Error('GitHub PAT token boş olamaz.');
    }

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/user`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };

    const response = await requestUrl(reqParams);

    if (response.status === 401) {
        throw new Error('Geçersiz GitHub PAT token veya süresi dolmuş.');
    } else if (response.status !== 200) {
        throw new Error(`GitHub profil bilgisi alınamadı (HTTP ${response.status})`);
    }

    const data = response.json;
    return {
        login: data.login,
        avatarUrl: data.avatar_url,
        name: data.name
    };
}

export async function findExamAppGist(token: string): Promise<string | null> {
    if (!token || !token.trim()) return null;

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists?per_page=100`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    };

    const response = await requestUrl(reqParams);
    if (response.status !== 200) {
        throw new Error(`Gist listesi alınamadı (HTTP ${response.status})`);
    }

    const gists = response.json;
    if (Array.isArray(gists)) {
        for (const gist of gists) {
            if (gist.files && (gist.files[BACKUP_FILENAME] || gist.files[SOURCES_FILENAME] || gist.description?.toLowerCase().includes('exam app'))) {
                return gist.id;
            }
        }
    }

    return null;
}

export async function createExamAppGist(token: string): Promise<string> {
    if (!token || !token.trim()) {
        throw new Error('Gist oluşturmak için geçerli bir token gerekiyor.');
    }

    const now = Date.now();
    const initialBackupPayload = {
        version: 3,
        lastUpdated: now,
        sources: [],
        folders: [],
        deletedSourceIds: [],
        deletedFolderIds: [],
        stats: {},
        totalStats: {},
        recentTests: [],
        settings: {}
    };

    const initialSourcesPayload = {
        sources: [],
        lastUpdated: now
    };

    const reqParams: RequestUrlParam = {
        url: `${GITHUB_API_BASE}/gists`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            description: 'Exam App - User Study & Resource Data Sync (via Obsidian)',
            public: false,
            files: {
                [BACKUP_FILENAME]: {
                    content: JSON.stringify(initialBackupPayload, null, 2)
                },
                [SOURCES_FILENAME]: {
                    content: JSON.stringify(initialSourcesPayload, null, 2)
                }
            }
        })
    };

    const response = await requestUrl(reqParams);

    if (response.status !== 201 && response.status !== 200) {
        throw new Error(`ExamApp Gist oluşturulamadı (HTTP ${response.status})`);
    }

    return response.json.id;
}

