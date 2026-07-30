export function mergeSyncData(localSources: any[], remotePayload: any): any {
    let hasLocalChanges = false;

    // 0. Tombstone merging for sources & folders
    const mergedDeletedSourceIds = Array.from(new Set([
        ...(remotePayload?.deletedSourceIds || [])
    ]));

    const mergedDeletedFolderIds = Array.from(new Set([
        ...(remotePayload?.deletedFolderIds || [])
    ]));

    // Preserve active folders
    const activeFolders = (remotePayload?.folders || []).filter(
        (f: any) => f && f.id && !mergedDeletedFolderIds.includes(f.id)
    );

    // 1. Merge sources
    const sourcesMap = new Map<string, any>();
    
    // Add remote sources (filter out tombstones)
    (remotePayload?.sources || []).forEach((s: any) => {
        if (s && s.id && !mergedDeletedSourceIds.includes(s.id)) {
            sourcesMap.set(s.id, s);
        }
    });

    // Merge local sources
    (localSources || []).forEach((s: any) => {
        if (!s || !s.id || mergedDeletedSourceIds.includes(s.id)) return;
        
        if (!sourcesMap.has(s.id)) {
            sourcesMap.set(s.id, s);
            hasLocalChanges = true;
        } else {
            const existing = sourcesMap.get(s.id);
            const localHasQuestions = Array.isArray(s.questions) && s.questions.length > 0;
            const existingHasQuestions = Array.isArray(existing.questions) && existing.questions.length > 0;

            if (!existingHasQuestions && localHasQuestions) {
                sourcesMap.set(s.id, s);
                hasLocalChanges = true;
            } else if (existingHasQuestions && !localHasQuestions) {
                // Keep existing remote source (may be offloaded archive or remote updated)
            } else if ((s.lastUsed || 0) > (existing.lastUsed || 0)) {
                sourcesMap.set(s.id, s);
                hasLocalChanges = true;
            }
        }
    });

    const mergedSources = Array.from(sourcesMap.values());

    return {
        version: 3,
        lastUpdated: Date.now(),
        sources: mergedSources,
        folders: activeFolders,
        deletedSourceIds: mergedDeletedSourceIds,
        deletedFolderIds: mergedDeletedFolderIds,
        stats: remotePayload?.stats || {},
        totalStats: remotePayload?.totalStats || {},
        recentTests: remotePayload?.recentTests || [],
        settings: remotePayload?.settings || {},
        hasLocalChanges
    };
}

