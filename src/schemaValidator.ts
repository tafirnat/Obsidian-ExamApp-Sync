const VALID_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false', 'text_input', 'text', 'open_ended', 'fill_in_the_blank', 'flashcard']);

export function validateExamSchema(data: any): { valid: boolean, isExamAppSource: boolean } {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, isExamAppSource: false };
    }

    // ExamApp source usually has an id and questions array
    if (!data.id || typeof data.id !== 'string') {
        return { valid: false, isExamAppSource: false };
    }

    if (!Array.isArray(data.questions)) {
        return { valid: false, isExamAppSource: false };
    }

    // Since this plugin should silently ignore non-ExamApp sources, 
    // we consider it an ExamApp source if it has 'id' and 'questions' array.
    // We then validate the questions. If questions are entirely malformed, we might reject it.
    for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        
        if (q.id === undefined || q.id === null) {
            return { valid: false, isExamAppSource: true };
        }
        
        const text = q.content?.text || q.text;
        if (!text || String(text).trim() === '') {
             return { valid: false, isExamAppSource: true };
        }
        
        if (!q.type || !VALID_TYPES.has(q.type)) {
             return { valid: false, isExamAppSource: true };
        }
        
        // Basic answer structure check based on type is optional for sync 
        // as ExamApp does it upon import, but we can do a minimal check.
        if (q.type !== 'flashcard' && (!q.answer || typeof q.answer !== 'object')) {
             return { valid: false, isExamAppSource: true };
        }
    }

    return { valid: true, isExamAppSource: true };
}
