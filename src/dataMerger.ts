export function mergeSyncData(localSources: any[], remotePayload: any): any {
    let hasLocalChanges = false;

    // 0. Tombstone birleştirme
    const mergedDeletedIds = Array.from(new Set([
        ...(remotePayload.deletedSourceIds || [])
    ]));

    // 1. Kaynakları Birleştir
    const sourcesMap = new Map<string, any>();
    
    // Gist kaynaklarını ekle (silinenleri filtrele)
    (remotePayload.sources || []).forEach((s: any) => {
        if (s && s.id && !mergedDeletedIds.includes(s.id)) {
            sourcesMap.set(s.id, s);
        }
    });

    // Yerel kaynakları dahil et ve karşılaştır (Güçlü zayıfı ezer)
    (localSources || []).forEach((s: any) => {
        if (!s || !s.id || mergedDeletedIds.includes(s.id)) return;
        
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
                // Keep existing remote source which has questions
            } else if ((s.lastUsed || 0) > (existing.lastUsed || 0)) {
                sourcesMap.set(s.id, s);
                hasLocalChanges = true;
            }
        }
    });

    const mergedSources = Array.from(sourcesMap.values());

    return {
        version: remotePayload.version || 2,
        lastUpdated: Date.now(),
        sources: mergedSources,
        deletedSourceIds: mergedDeletedIds,
        stats: remotePayload.stats || {},
        totalStats: remotePayload.totalStats || {},
        recentTests: remotePayload.recentTests || [],
        settings: remotePayload.settings || {},
        hasLocalChanges
    };
}
