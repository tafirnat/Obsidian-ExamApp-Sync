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

    // ExamApp source must have a string id and a questions array to be recognized as an ExamApp source
    if (!data.id || typeof data.id !== 'string') {
        return { valid: false, isExamAppSource: false };
    }

    if (!Array.isArray(data.questions)) {
        return { valid: false, isExamAppSource: false };
    }

    // Sanitize and auto-repair questions structure gracefully
    for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        if (!q || typeof q !== 'object') continue;
        
        // Repair missing question ID
        if (q.id === undefined || q.id === null || String(q.id).trim() === '') {
            q.id = `q_${Math.random().toString(36).substring(2, 9)}`;
        }
        
        // Repair missing text
        const currentText = q.content?.text || q.text;
        if (!currentText || String(currentText).trim() === '') {
            q.content = q.content || {};
            q.content.text = '(Soru metni belirtilmedi)';
        } else if (!q.content) {
            q.content = { text: String(currentText) };
        }
        
        // Repair invalid or missing question type
        if (!q.type || !VALID_TYPES.has(q.type)) {
            q.type = 'single_choice';
        }
        
        // Repair missing answer object for non-text types
        if (q.type !== 'flashcard' && q.type !== 'reading' && q.type !== 'topic_review') {
            if (!q.answer || typeof q.answer !== 'object') {
                q.answer = { choices: [], correctChoice: '' };
            }
        }
    }

    return { valid: true, isExamAppSource: true };
}


