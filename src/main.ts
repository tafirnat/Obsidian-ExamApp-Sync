import { Plugin, Notice } from 'obsidian';
import { ExamAppGistSyncSettings, DEFAULT_SETTINGS, ExamAppGistSyncSettingTab } from './settings';
import { fetchGistData, pushGistData } from './gistSync';
import { mergeSyncData } from './dataMerger';
import { scanLocalSources, writeLocalSources } from './fileScanner';

export default class ExamAppGistSyncPlugin extends Plugin {
	settings: ExamAppGistSyncSettings;

	async onload() {
		await this.loadSettings();

		// Add Settings Tab
		this.addSettingTab(new ExamAppGistSyncSettingTab(this.app, this));

		// Ribbon Icon
		const ribbonIconEl = this.addRibbonIcon('refresh-cw', 'ExamApp Sync', async () => {
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
	}

	onunload() {
		// Clean up
	}

	async syncWithGist(isAutoSync: boolean = false) {
		if (!this.settings.githubToken) {
			if (!isAutoSync && this.settings.showNotifications) {
				new Notice('❌ ExamApp Sync: Lütfen önce eklenti ayarlarından GitHub hesabınızla oturum açın.');
			}
			return;
		}

		if (this.settings.showNotifications) {
			new Notice('⏳ ExamApp: Senkronizasyon başlatılıyor...');
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

			if (this.settings.showNotifications) {
				new Notice(`✅ ExamApp: Senkronizasyon Başarılı! (${mergedData.sources.length} havuz senkronize edildi)`);
			}
		} catch (error: any) {
			console.error('[ExamApp Sync] Hata:', error);
			if (this.settings.showNotifications) {
				new Notice(`❌ ExamApp: Senkronizasyon hatası! ${error.message}`);
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
