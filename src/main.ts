import { Plugin, Notice, addIcon } from 'obsidian';
import { ExamAppGistSyncSettings, DEFAULT_SETTINGS, ExamAppGistSyncSettingTab } from './settings';
import { fetchGistData, pushGistData } from './gistSync';
import { mergeSyncData } from './dataMerger';
import { scanLocalSources, writeLocalSources } from './fileScanner';
import { generateMarkdownSummary } from './markdownGenerator';
import { checkForUpdates } from './updateChecker';

// Infinity Sync Icon matching Obsidian minimalist line-art design
const INFINITY_SYNC_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 12,12 C 8.5,16.5 4,17 2.5,14.5 C 1,12 2.5,8 6.5,8.5 C 10.5,9 13.5,14.5 17.5,15.5 C 21.5,16.5 23,12.5 21.5,10 C 20,7.5 16,7.5 12,12"/><path d="M 17,6.5 L 21.5,10 L 21,5.5"/><path d="M 7,17.5 L 2.5,14.5 L 3,19"/></svg>`;


export default class ExamAppGistSyncPlugin extends Plugin {
	settings: ExamAppGistSyncSettings;

	async onload() {
		await this.loadSettings();

		// Register custom Infinity Sync SVG icon
		addIcon('examapp-infinity-sync', INFINITY_SYNC_ICON_SVG);

		// Add Settings Tab
		this.addSettingTab(new ExamAppGistSyncSettingTab(this.app, this));

		// Ribbon Icon (uses custom registered infinity sync icon)
		const ribbonIconEl = this.addRibbonIcon('examapp-infinity-sync', 'ExamApp Sync', async () => {
			await this.syncWithGist();
		});
		ribbonIconEl.addClass('examapp-sync-ribbon-class');

		// Command to sync via Command Palette
		this.addCommand({
			id: 'sync-examapp-gist',
			name: 'Sync with ExamApp Gist',
			callback: async () => {
				await this.syncWithGist();
			}
		});

		// Auto-sync on startup if enabled
		if (this.settings.autoSyncOnStartup && this.settings.githubToken) {
			this.app.workspace.onLayoutReady(async () => {
				await this.syncWithGist(true);
			});
		}

		// Non-blocking background update check (delayed by 10s post layout ready)
		this.app.workspace.onLayoutReady(() => {
			setTimeout(async () => {
				await checkForUpdates(this, false);
			}, 10000);
		});
	}

	onunload() {
		// Clean up
	}

	async syncWithGist(isAutoSync: boolean = false) {
		if (!this.settings.githubToken) {
			if (!isAutoSync && this.settings.showNotifications) {
				new Notice('[ExamApp Sync] Lütfen önce eklenti ayarlarından GitHub hesabınızla oturum açın.');
			}
			return;
		}

		if (this.settings.showNotifications) {
			new Notice('[ExamApp Sync] Senkronizasyon başlatılıyor...');
		}

		try {
			// 1. Fetch remote Gist data (auto-detects/creates Gist ID if needed)
			const remoteData = await fetchGistData(this.settings);
			
			// Save settings if gistId was auto-resolved
			await this.saveSettings();

			// 2. Scan local JSON files in the specified folder
			const localSources = await scanLocalSources(this.app, this.settings.localFolderPath);

			// 3. Merge data using ExamApp logic ("Güçlü Zayıfı Ezer")
			const mergedData = mergeSyncData(localSources, remoteData);

			// 4. Push merged payload back to Gist
			await pushGistData(this.settings, mergedData);

			// 5. Update local JSON files to reflect the final merged state
			await writeLocalSources(this.app, this.settings.localFolderPath, mergedData.sources);

			// 6. Generate/update Markdown summary dashboard (examApp_data.md)
			await generateMarkdownSummary(this.app, this.settings.localFolderPath, mergedData.sources, 'Success');

			if (this.settings.showNotifications) {
				new Notice(`[ExamApp Sync] Senkronizasyon tamamlandı (${mergedData.sources.length} havuz senkronize edildi).`);
			}
		} catch (error: any) {
			console.error('[ExamApp Sync] Hata:', error);
			if (this.settings.showNotifications) {
				new Notice(`[ExamApp Sync] Senkronizasyon hatası: ${error.message}`);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
