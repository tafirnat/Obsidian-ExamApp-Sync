import { Plugin, Notice, addIcon } from 'obsidian';
import { ExamAppGistSyncSettings, DEFAULT_SETTINGS, ExamAppGistSyncSettingTab } from './settings';
import { fetchGistData, pushGistData } from './gistSync';
import { mergeSyncData } from './dataMerger';
import { scanLocalSources, writeLocalSources } from './fileScanner';
import { generateMarkdownSummary } from './markdownGenerator';
import { checkForUpdates } from './updateChecker';
import { ExamAppSyncModal } from './syncModal';

// Modern ExamApp Dataset & Sync Transfer Icon (Exam Card + Curved Sync Arrow)
const EXAMAPP_MODERN_SYNC_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="13" rx="2.5"/><path d="M7 8h5"/><path d="M7 11h3"/><path d="M17 9v8a2.5 2.5 0 0 1-2.5 2.5H7"/><polyline points="14 17 17 20 20 17"/></svg>`;


export default class ExamAppGistSyncPlugin extends Plugin {
	settings: ExamAppGistSyncSettings;

	async onload() {
		await this.loadSettings();

		// Inject dark-mode compatible CSS for examapp-sync-btn buttons and spans
		this.injectStyles();

		// Register custom modern ExamApp Sync SVG icon
		addIcon('examapp-infinity-sync', EXAMAPP_MODERN_SYNC_ICON_SVG);

		// Add Settings Tab
		this.addSettingTab(new ExamAppGistSyncSettingTab(this.app, this));

		// Ribbon Icon click opens the interactive Sync Modal Popup
		const ribbonIconEl = this.addRibbonIcon('examapp-infinity-sync', 'ExamApp Sync', () => {
			new ExamAppSyncModal(this.app, this).open();
		});
		if (ribbonIconEl) {
			ribbonIconEl.addClass('examapp-sync-ribbon-class');
		}


		// Command to sync via Command Palette
		this.addCommand({
			id: 'sync-examapp-gist',
			name: 'Sync with ExamApp Gist',
			callback: async () => {
				await this.syncWithGist();
			}
		});

		// Command to open Sync Modal Popup
		this.addCommand({
			id: 'open-examapp-sync-modal',
			name: 'Open ExamApp Sync Panel Modal',
			callback: () => {
				new ExamAppSyncModal(this.app, this).open();
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
			
			// 2. Scan local JSON files in the specified folder (Backup subfolder is excluded!)
			const localSources = await scanLocalSources(this.app, this.settings.localFolderPath);

			// 3. Merge data using ExamApp logic ("Güçlü Zayıfı Ezer")
			const mergedData = mergeSyncData(localSources, remoteData);

			// 4. Push merged payload back to Gist
			await pushGistData(this.settings, mergedData);

			// 5. Update local JSON files to reflect the final merged state
			await writeLocalSources(this.app, this.settings.localFolderPath, mergedData.sources);

			// 6. Generate/update Markdown summary dashboard (00_ExamApp_Overview.md)
			await generateMarkdownSummary(this.app, this.settings.localFolderPath, mergedData.sources, 'Success');

			this.settings.lastSyncTimestamp = Date.now();
			this.settings.lastSyncMode = 'Çift Yönlü (Full Sync)';
			this.settings.lastSyncStatus = 'Başarılı';
			await this.saveSettings();

			if (this.settings.showNotifications) {
				new Notice(`[ExamApp Sync] Senkronizasyon tamamlandı (${mergedData.sources.length} havuz senkronize edildi).`);
			}
		} catch (error: any) {
			console.error('[ExamApp Sync] Hata:', error);
			this.settings.lastSyncStatus = 'Hata';
			await this.saveSettings();
			if (this.settings.showNotifications) {
				new Notice(`[ExamApp Sync] Senkronizasyon hatası: ${error.message}`);
			}
		}
	}

	async pullFromGist() {
		if (!this.settings.githubToken) {
			new Notice('[ExamApp Sync] Lütfen önce eklenti ayarlarından oturum açın.');
			return;
		}
		new Notice('[ExamApp Sync] Gist verileri çekiliyor...');
		try {
			const remoteData = await fetchGistData(this.settings);
			const sources = remoteData?.sources || [];
			await writeLocalSources(this.app, this.settings.localFolderPath, sources);
			await generateMarkdownSummary(this.app, this.settings.localFolderPath, sources, 'Pull Success');
			
			this.settings.lastSyncTimestamp = Date.now();
			this.settings.lastSyncMode = 'Gist\'ten Çek (Pull Only)';
			this.settings.lastSyncStatus = 'Başarılı';
			await this.saveSettings();

			new Notice(`[ExamApp Sync] Gist'ten ${sources.length} havuz başarıyla çekildi.`);
		} catch (error: any) {
			console.error('[ExamApp Pull Error]', error);
			this.settings.lastSyncStatus = 'Hata';
			await this.saveSettings();
			new Notice(`[ExamApp Sync] Çekme hatası: ${error.message}`);
		}
	}

	async pushToGist() {
		if (!this.settings.githubToken) {
			new Notice('[ExamApp Sync] Lütfen önce eklenti ayarlarından oturum açın.');
			return;
		}
		new Notice('[ExamApp Sync] Yerel veriler Gist\'e gönderiliyor...');
		try {
			const localSources = await scanLocalSources(this.app, this.settings.localFolderPath);
			const remoteData = await fetchGistData(this.settings);
			const payload = {
				...remoteData,
				sources: localSources,
				lastUpdated: Date.now()
			};
			await pushGistData(this.settings, payload);
			await generateMarkdownSummary(this.app, this.settings.localFolderPath, localSources, 'Push Success');
			
			this.settings.lastSyncTimestamp = Date.now();
			this.settings.lastSyncMode = 'Gist\'e Gönder (Push Only)';
			this.settings.lastSyncStatus = 'Başarılı';
			await this.saveSettings();

			new Notice(`[ExamApp Sync] Yereldeki ${localSources.length} havuz Gist'e gönderildi.`);
		} catch (error: any) {
			console.error('[ExamApp Push Error]', error);
			this.settings.lastSyncStatus = 'Hata';
			await this.saveSettings();
			new Notice(`[ExamApp Sync] Gönderme hatası: ${error.message}`);
		}
	}



	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	injectStyles() {
		const styleId = 'examapp-sync-custom-styles';
		if (document.getElementById(styleId)) return;

		const styleEl = document.createElement('style');
		styleEl.id = styleId;
		styleEl.textContent = `
			.examapp-sync-btn {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				padding: 6px 14px;
				border-radius: 6px;
				font-weight: 500;
				font-size: 0.9em;
				cursor: pointer;
				border: 1px solid var(--background-modifier-border, rgba(255, 255, 255, 0.15));
				background-color: var(--interactive-normal, #2d2d2d);
				color: var(--text-normal, #dcddde);
				transition: background-color 0.2s ease, border-color 0.2s ease;
			}
			.examapp-sync-btn:hover {
				background-color: var(--interactive-hover, #3d3d3d);
				border-color: var(--interactive-accent, #7f6df2);
			}
			.examapp-sync-btn span {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 3px 8px;
				border-radius: 4px;
				background-color: var(--background-secondary-alt, rgba(255, 255, 255, 0.08));
				color: var(--text-normal, #dcddde);
				font-size: 0.88em;
				font-weight: 500;
			}
			.examapp-sync-btn span.examapp-sync-icon-span {
				padding: 0;
				background-color: transparent;
				color: currentColor;
			}
			.examapp-sync-btn span.examapp-sync-badge-span {
				background-color: var(--background-secondary-alt, rgba(255, 255, 255, 0.12));
				color: var(--text-accent, #a78bfa);
				font-weight: 600;
			}
		`;
		document.head.appendChild(styleEl);
	}
}

