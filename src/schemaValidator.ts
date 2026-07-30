const VALID_TYPES = new Set([
    'single_choice',
    'multiple_choice',
    'true_false',
    'short_answer',
    'text_input',
    'fill_in_the_blank',
    'flashcard',
    'reading',
    'topic_review',
    'text',
    'open_ended'
]);

export function validateExamSchema(data: any): { valid: boolean, isExamAppSource: boolean } {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, isExamAppSource: false };
    }

    // ExamApp source has an id (string) and questions array
    if (!data.id || typeof data.id !== 'string') {
        return { valid: false, isExamAppSource: false };
    }

    if (!Array.isArray(data.questions)) {
        return { valid: false, isExamAppSource: false };
    }

    // Check questions structure cleanly
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
        
        // Flashcard and Reading question types might not require standard answer objects
        if (q.type !== 'flashcard' && q.type !== 'reading' && q.type !== 'topic_review' && (!q.answer || typeof q.answer !== 'object')) {
             return { valid: false, isExamAppSource: true };
        }
    }

    return { valid: true, isExamAppSource: true };
}

