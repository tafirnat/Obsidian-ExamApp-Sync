import { App, TFile, TFolder } from 'obsidian';

/**
 * Safe filename generation matching writeLocalSources in fileScanner.ts
 */
function getDatasetFilename(source: any): string {
    const title = source.name || source.exam_metadata?.title || source.title || source.id || 'Unknown_Source';
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    const shortId = (source.id || '00000000').substring(0, 8);
    return `${safeName}_${shortId}.json`;
}

/**
 * Resolves parent folder path and relative dataset subfolder name.
 */
function getSummaryLocation(folderPath: string): { parentFolderPath: string; relativeSubfolder: string } {
    const normalized = folderPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlashIndex = normalized.lastIndexOf('/');
    
    if (lastSlashIndex > 0) {
        const parentFolderPath = normalized.substring(0, lastSlashIndex);
        const relativeSubfolder = normalized.substring(lastSlashIndex + 1);
        return {
            parentFolderPath,
            relativeSubfolder
        };
    }
    
    return {
        parentFolderPath: normalized,
        relativeSubfolder: ''
    };
}

/**
 * Generates and updates 00_ExamApp_Overview.md in the parent folder of the dataset directory.
 */
export async function generateMarkdownSummary(
    app: App,
    folderPath: string,
    sources: any[],
    syncStatus: string = 'Success'
): Promise<void> {
    const { parentFolderPath, relativeSubfolder } = getSummaryLocation(folderPath);
    const summaryFilePath = `${parentFolderPath}/00_ExamApp_Overview.md`;

    // Ensure parent folder exists
    let targetFolder = app.vault.getAbstractFileByPath(parentFolderPath);
    if (!targetFolder || !(targetFolder instanceof TFolder)) {
        try {
            await app.vault.createFolder(parentFolderPath);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create directory for summary: ${parentFolderPath}`, e);
            return;
        }
    }

    const now = new Date();

    // Statistics calculation
    const totalDatasets = sources.length;
    let totalQuestions = 0;
    sources.forEach(s => {
        if (Array.isArray(s.questions)) {
            totalQuestions += s.questions.length;
        }
    });

    const formattedSyncTime = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:mm:ss

    // Header & Content (100% English, no YAML frontmatter to prevent localized Properties panel)
    let markdown = `# 📊 ExamApp Datasets & Sync Overview

> [!abstract] System Overview
> - 📁 **Total Datasets**: \`${totalDatasets}\`
> - ❓ **Total Questions**: \`${totalQuestions}\`
> - 🔄 **Last Sync**: \`${formattedSyncTime}\` (\`${syncStatus}\`)
> - 📘 **Guide & AI Prompt**: [[01_ExamApp_About.md|01_ExamApp_About.md]]

## 📑 Datasets Index

| Dataset Title | Questions | App Version | Categories / Tags | Last Modified |
| :--- | :---: | :---: | :--- | :--- |
`;

    if (sources.length === 0) {
        markdown += `| *No datasets found* | 0 | - | - | - |\n`;
    } else {
        sources.forEach(s => {
            const title = s.name || s.exam_metadata?.title || s.title || s.id || 'Untitled Dataset';
            const fileName = getDatasetFilename(s);
            const relativeFilePath = relativeSubfolder ? `${relativeSubfolder}/${fileName}` : fileName;
            const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
            const appVersion = s.target_version || s.version || s.exam_metadata?.version || 'N/A';
            
            let categories = '-';
            if (Array.isArray(s.categories) && s.categories.length > 0) {
                categories = s.categories.join(', ');
            } else if (Array.isArray(s.tags) && s.tags.length > 0) {
                categories = s.tags.join(', ');
            } else if (s.exam_metadata?.category) {
                categories = String(s.exam_metadata.category);
            }

            let lastMod = '-';
            if (s.lastUsed || s.lastUpdated || s.updatedAt) {
                const ts = s.lastUsed || s.lastUpdated || s.updatedAt;
                try {
                    lastMod = new Date(ts).toISOString().split('T')[0];
                } catch (e) {
                    lastMod = String(ts);
                }
            }

            // Clean markdown table special characters
            const safeTitle = title.replace(/\|/g, '\\|');
            const safeCategories = categories.replace(/\|/g, '\\|');

            // Escape pipe with \\| so Obsidian table renderer keeps the link within column 1
            markdown += `| [[${relativeFilePath}\\|${safeTitle}]] | ${qCount} | \`${appVersion}\` | ${safeCategories} | ${lastMod} |\n`;
        });
    }

    // Write Overview file (00_ExamApp_Overview.md - Live dynamic dataset index)
    const existingFile = app.vault.getAbstractFileByPath(summaryFilePath);
    if (existingFile instanceof TFile) {
        try {
            const currentContent = await app.vault.read(existingFile);
            if (currentContent !== markdown) {
                await app.vault.modify(existingFile, markdown);
            }
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to update summary file: ${summaryFilePath}`, e);
        }
    } else {
        try {
            await app.vault.create(summaryFilePath, markdown);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create summary file: ${summaryFilePath}`, e);
        }
    }

    // Also ensure the static documentation guide (01_ExamApp_About.md) exists
    await generateAboutExamAppMarkdown(app, parentFolderPath);
}

/**
 * Task 2: Generates and maintains 01_ExamApp_About.md in the parent folder.
 * This is a static reference guide explaining ExamApp, JSON schemas, AI prompts, and GitHub links.
 */
export async function generateAboutExamAppMarkdown(
    app: App,
    parentFolderPath: string
): Promise<void> {
    const aboutFilePath = `${parentFolderPath}/01_ExamApp_About.md`;
    const oldAboutFilePath = `${parentFolderPath}/01_About_ExamApp.md`;

    // Clean up legacy filename if present
    const oldFile = app.vault.getAbstractFileByPath(oldAboutFilePath);
    if (oldFile instanceof TFile) {
        try {
            await app.vault.delete(oldFile);
        } catch (e) {
            // ignore cleanup error
        }
    }

    const markdown = `# 📘 About ExamApp & AI Dataset Guide

> [!info] Open Source Project Reference
> **ExamApp** is an open-source, web-based interactive flashcard and exam preparation application.
> - 🌐 **GitHub Repository**: [https://github.com/tafirnat/exam-app](https://github.com/tafirnat/exam-app)
> - 📊 **Dynamic Datasets Dashboard**: [[00_ExamApp_Overview.md|00_ExamApp_Overview.md]]

---


## 💡 What is ExamApp?

**ExamApp** allows students, developers, and educators to create, manage, and study custom question banks (datasets). Key features include:
- Interactive flashcards with spaced repetition and confidence tracking.
- Multiple question format support (Single Choice, Multiple Choice, True/False, Flashcards, Open Ended/Text Input).
- Seamless synchronization with GitHub Gists and Obsidian Vault via the **Obsidian ExamApp Sync Plugin**.

---

## 🤖 AI & Human Dataset Schema Specification

To ensure any JSON dataset file is recognized and synced properly by ExamApp, it **must** strictly conform to the following JSON structure.

### 1. Root Dataset Schema

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| \`id\` | \`string\` | **Yes** | Unique identifier (UUID v4 or slug string) |
| \`name\` / \`title\` | \`string\` | **Yes** | Title of the dataset / question pool |
| \`description\` | \`string\` | No | Short description of the dataset topic |
| \`target_version\` | \`string\` | No | Compatible ExamApp version (e.g. \`"1.0.0"\`) |
| \`categories\` / \`tags\` | \`array<string>\` | No | List of category names or tags |
| \`questions\` | \`array<object>\` | **Yes** | Array of question objects (defined below) |

### 2. Question Item Schema

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| \`id\` | \`string\` | **Yes** | Unique ID within the dataset (e.g. \`"q_01"\`) |
| \`order\` | \`number\` | No | Sequence index (1, 2, 3...) |
| \`type\` | \`string\` | **Yes** | Question type: \`flashcard\`, \`single_choice\`, \`multiple_choice\`, \`true_false\`, \`open_ended\` |
| \`difficulty\` | \`number\` | No | Rating from 1 (Easy) to 5 (Hard) |
| \`tags\` | \`array<string>\` | No | Specific topic tags for this question |
| \`content\` | \`object\` | **Yes** | Must contain \`{ "text": "Question prompt here" }\` and option list if choice-based |
| \`answer\` | \`object\` | **Yes** | Structure depends on \`type\` (see examples below) |

---

## 📝 Question Type Examples & Templates

### 1. Flashcard (\`flashcard\`)
- \`content.text\`: Front side of card (Question / Prompt)
- \`answer.back\`: Back side of card (Explanation / Answer)

\`\`\`json
{
  "id": "q_fc_01",
  "order": 1,
  "type": "flashcard",
  "difficulty": 2,
  "tags": ["Networking", "OSI"],
  "content": {
    "text": "What is the primary function of the OSI Network Layer (Layer 3)?"
  },
  "answer": {
    "back": "The Network Layer is responsible for packet forwarding including routing through intermediate routers."
  }
}
\`\`\`

### 2. Single Choice (\`single_choice\`)
- \`content.text\`: Question prompt
- \`content.options\`: Array of string options
- \`answer.correct\`: 0-based index of correct option

\`\`\`json
{
  "id": "q_sc_01",
  "order": 2,
  "type": "single_choice",
  "difficulty": 1,
  "tags": ["Protocols"],
  "content": {
    "text": "Which port is used by standard HTTPS by default?",
    "options": ["80", "443", "22", "8080"]
  },
  "answer": {
    "correct": 1
  }
}
\`\`\`

### 3. Multiple Choice (\`multiple_choice\`)
- \`content.text\`: Question prompt
- \`content.options\`: Array of string options
- \`answer.correct\`: Array of 0-based indices of correct options

\`\`\`json
{
  "id": "q_mc_01",
  "order": 3,
  "type": "multiple_choice",
  "difficulty": 3,
  "tags": ["Protocols"],
  "content": {
    "text": "Which of the following protocols operate at the Transport Layer (Layer 4)?",
    "options": ["TCP", "IP", "UDP", "HTTP"]
  },
  "answer": {
    "correct": [0, 2]
  }
}
\`\`\`

### 4. True / False (\`true_false\`)
- \`content.text\`: Statement
- \`answer.correct\`: Boolean \`true\` or \`false\`

\`\`\`json
{
  "id": "q_tf_01",
  "order": 4,
  "type": "true_false",
  "difficulty": 1,
  "tags": ["Security"],
  "content": {
    "text": "UDP provides connection-oriented reliable transmission with error checking."
  },
  "answer": {
    "correct": false
  }
}
\`\`\`

### 5. Open Ended / Text Input (\`open_ended\` / \`text_input\`)
- \`content.text\`: Question prompt
- \`answer.text\`: Reference answer string

\`\`\`json
{
  "id": "q_oe_01",
  "order": 5,
  "type": "open_ended",
  "difficulty": 3,
  "tags": ["Storage"],
  "content": {
    "text": "Explain the difference between RAID 0 and RAID 1 in terms of redundancy."
  },
  "answer": {
    "text": "RAID 0 offers striping without redundancy (data loss if one disk fails). RAID 1 offers mirroring with 100% data redundancy."
  }
}
\`\`\`

---

## ⚡ Complete Dataset JSON Template

\`\`\`json
{
  "id": "sample-dataset-uuid-001",
  "name": "Sample ExamApp Dataset",
  "description": "Example question pool for testing and AI generation reference.",
  "target_version": "1.0.0",
  "categories": ["General Knowledge", "IT Basics"],
  "questions": [
    {
      "id": "q_01",
      "order": 1,
      "type": "flashcard",
      "difficulty": 2,
      "tags": ["Basics"],
      "content": {
        "text": "What is ExamApp?"
      },
      "answer": {
        "back": "ExamApp is an open-source web application for interactive studying and question management."
      }
    }
  ]
}
\`\`\`

---

## 🤖 AI Prompt Template (Copy & Paste for ChatGPT / Claude / Gemini)

You can copy and paste the following prompt into any AI assistant to automatically generate valid ExamApp question datasets matching the official open-source schema:

\`\`\`text
You are an expert AI dataset generator for ExamApp (Open Source Repository: https://github.com/tafirnat/exam-app).
Please generate a valid, high-quality ExamApp dataset JSON file for the topic: [YOUR TOPIC HERE].

Context & Repository Reference:
- GitHub Repository: https://github.com/tafirnat/exam-app
- App Version Compatibility: 1.0.0

Strict Schema Requirements:
1. Root JSON must contain:
   - "id": UUID string (e.g. "a1b2c3d4-e5f6-7890-abcd-1234567890ab")
   - "name": Topic Title (string)
   - "description": Brief overview of the topic / question set
   - "target_version": "1.0.0"
   - "categories": array of topic category strings
   - "questions": array of question objects
2. Each item in "questions" MUST have:
   - "id": string (unique ID within dataset, e.g. "q_01")
   - "order": number starting from 1
   - "type": "flashcard" | "single_choice" | "multiple_choice" | "true_false" | "open_ended"
   - "difficulty": number (1 = Easy to 5 = Hard)
   - "tags": array of strings
   - "content": object containing:
     - "text": question prompt / statement
     - "options": array of string choices (ONLY for "single_choice" and "multiple_choice")
   - "answer": object containing:
     - "back": explanation string (ONLY for "flashcard")
     - "correct": 0-based index (single_choice), array of indices (multiple_choice), or boolean (true_false)
     - "text": reference answer string (ONLY for "open_ended")
3. Return ONLY valid JSON, wrapped inside a \`\`\`json ... \`\`\` code block.
\`\`\`

---

## 🔗 Related Resources
- 📦 **ExamApp Main GitHub Repository**: [https://github.com/tafirnat/exam-app](https://github.com/tafirnat/exam-app)
- 📊 **Dynamic Datasets Dashboard**: [[00_ExamApp_Overview.md|00_ExamApp_Overview.md]]
`;

    const existingFile = app.vault.getAbstractFileByPath(aboutFilePath);
    if (existingFile instanceof TFile) {
        try {
            const currentContent = await app.vault.read(existingFile);
            if (currentContent !== markdown) {
                await app.vault.modify(existingFile, markdown);
            }
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to update About file: ${aboutFilePath}`, e);
        }
    } else {
        try {
            await app.vault.create(aboutFilePath, markdown);
        } catch (e) {
            console.error(`[ExamApp Sync] Failed to create About file: ${aboutFilePath}`, e);
        }
    }
}


