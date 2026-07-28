# Obsidian ExamApp Gist Sync

A dedicated Obsidian community plugin that provides seamless, two-way synchronization between your local Obsidian question pools (JSON format) and your [ExamApp](https://github.com/tafirnat/exam-app/) data hosted on GitHub Gists.

## 🚀 Features
- **Zero External Dependencies**: Pure TypeScript plugin utilizing Obsidian's native `requestUrl`. No need for external Python scripts, CLI tools, or Node.js runtime in the background.
- **Two-way Syncing (Pull & Push)**: Syncs your local questions to Gist, and updates your local workspace with any newer data on the Gist.
- **Smart Data Merging ("Güçlü Zayıfı Ezer")**: Ensures data integrity by prioritizing sources that actually contain questions or have a newer `lastUsed` timestamp. Safely preserves your ExamApp user statistics, recent tests, and global settings.
- **Tombstone Protection**: Prevents "Zombie data" by correctly filtering out deleted sources based on the `deletedSourceIds` tracker in the Gist.
- **Strict Schema Validation**: Automatically parses and filters local `.json` files to ensure they conform to the official ExamApp schema. Non-ExamApp JSON files in the sync folder are gracefully ignored.

## 🛠️ How to Setup

1. **Install the Plugin** (Manual Installation):
   - Download the `main.js` and `manifest.json` files from the latest release.
   - Place them in your Obsidian vault inside `.obsidian/plugins/examapp-gist-sync/`.
   - Restart Obsidian and enable the plugin from **Settings > Community Plugins**.

2. **Configure Settings**:
   - Go to **Settings > ExamApp Gist Sync**.
   - **GitHub Personal Access Token (PAT)**: Create a token on GitHub with `gist` scope.
   - **Gist ID**: The unique ID of the Gist where your `exam_app_backup.json` is located.
   - **Local Folder Path**: Set the relative folder path inside your Obsidian vault where you keep your JSON questions (e.g., `ExamApp Sync`).

3. **Start Syncing**:
   - Click the "Sync" icon on the left Ribbon menu, or use the command palette (`Sync with ExamApp Gist`).

## ⚙️ Development

If you want to modify or compile the plugin yourself:

```bash
# Clone the repository
git clone https://github.com/tafirnat/Obsidian-ExamApp-Sync.git

# Navigate to the folder
cd Obsidian-ExamApp-Sync

# Install dependencies
npm install

# Compile the plugin
npm run build
# OR run in watch mode for development
npm run dev
```

## 🤝 Contributing
Contributions are always welcome. Feel free to open issues or submit Pull Requests for enhancements or bug fixes.

## 📝 License
This project is licensed under the MIT License.
