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
		const ribbonIconEl = this.addRibbonIcon('refresh-cw', 'ExamApp Sync', async (evt: MouseEvent) => {
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
	}

	onunload() {
		// Nothing specific to unload
	}

	async syncWithGist() {
		if (!this.settings.githubToken || !this.settings.gistId) {
			new Notice('❌ ExamApp Sync: GitHub PAT veya Gist ID eksik. Ayarları kontrol edin.');
			return;
		}

		new Notice('⏳ ExamApp: Senkronizasyon başlatılıyor...');

		try {
			// 1. Gist verisini çek
			const remoteData = await fetchGistData(this.settings);
			
			// 2. Yerel JSON'ları oku
			const localSources = await scanLocalSources(this.app, this.settings.localFolderPath);
			
			// 3. Güçlü zayıfı ezer mantığı ile birleştir
			const mergedData = mergeSyncData(localSources, remoteData);
			
			// 4. Gist'e gönder
			await pushGistData(this.settings, mergedData);
			
			// 5. Yereli Gist'teki son duruma göre eşitle (isteğe bağlı ama tavsiye edilen)
			await writeLocalSources(this.app, this.settings.localFolderPath, mergedData.sources);

			new Notice('✅ ExamApp: Senkronizasyon Başarılı!');
		} catch (error: any) {
			console.error('[ExamApp Sync] Hata:', error);
			new Notice(`❌ ExamApp: Senkronizasyon hatası! ${error.message}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
