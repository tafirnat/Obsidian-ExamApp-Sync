import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import ExamAppGistSyncPlugin from './main';
import { fetchGitHubUser, findExamAppGist, createExamAppGist } from './githubApi';
import { scanLocalSources, writeLocalSources, cleanupOldDirectory } from './fileScanner';
import { generateMarkdownSummary } from './markdownGenerator';
import { checkForUpdates } from './updateChecker';


export interface ExamAppGistSyncSettings {
	githubToken: string;
	gistId: string;
	localFolderPath: string;
	githubUsername: string;
	autoSyncOnStartup: boolean;
	showNotifications: boolean;
	autoCheckUpdates: boolean;
	lastUpdateCheckTimestamp: number;
	autoInstallUpdates: boolean;
	lastSyncTimestamp?: number;
	lastSyncMode?: string;
	lastSyncStatus?: string;
}

export const DEFAULT_SETTINGS: ExamAppGistSyncSettings = {
	githubToken: '',
	gistId: '',
	localFolderPath: '50_Projects/ExamApp/datasets',
	githubUsername: '',
	autoSyncOnStartup: false,
	showNotifications: true,
	autoCheckUpdates: true,
	lastUpdateCheckTimestamp: 0,
	autoInstallUpdates: true,
	lastSyncTimestamp: 0,
	lastSyncMode: 'None',
	lastSyncStatus: 'None'
};


const ICONS = {
	github: `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>`,
	key: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><path d="M21 2l-2 2m-1.5 1.5l-3 3m-5 5a7 7 0 1 1 3-3l7-7v3h3v3h-3z"/></svg>`,
	syncInfinity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><path d="M 12,12 C 8.5,16.5 4,17 2.5,14.5 C 1,12 2.5,8 6.5,8.5 C 10.5,9 13.5,14.5 17.5,15.5 C 21.5,16.5 23,12.5 21.5,10 C 20,7.5 16,7.5 12,12"/><path d="M 17,6.5 L 21.5,10 L 21,5.5"/><path d="M 7,17.5 L 2.5,14.5 L 3,19"/></svg>`,
	folder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
	sliders: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
	info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="examapp-info-icon" style="vertical-align: middle; margin-left: 6px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;" title="PAT Hakkında Detaylı Bilgi"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
	checkBadge: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
	alertBadge: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
	externalLink: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 4px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
	shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--interactive-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
	refresh: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
	play: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
	search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
	plus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
	syncNow: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 1.3A10 10 0 0 0 22 12.5"/></svg>`
};

export class ExamAppGistSyncSettingTab extends PluginSettingTab {
	plugin: ExamAppGistSyncPlugin;

	constructor(app: App, plugin: ExamAppGistSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'ExamApp Gist Sync - Ayarlar' });

		// -------------------------------------------------------------
		// 1. OTURUM YÖNETİMİ (LOGIN / LOGOUT)
		// -------------------------------------------------------------
		const authHeader = containerEl.createEl('h3');
		authHeader.innerHTML = `${ICONS.key}GitHub Oturum Yönetimi`;

		if (this.plugin.settings.githubToken && this.plugin.settings.githubUsername) {
			// LOGGED IN STATE
			const accountCard = containerEl.createDiv({ cls: 'examapp-account-card' });
			accountCard.style.padding = '14px';
			accountCard.style.borderRadius = '8px';
			accountCard.style.backgroundColor = 'var(--background-secondary)';
			accountCard.style.border = '1px solid var(--background-modifier-border)';
			accountCard.style.marginBottom = '18px';

			const statusEl = accountCard.createEl('div');
			statusEl.innerHTML = `${ICONS.github}<strong>Bağlı Hesap:</strong> @${this.plugin.settings.githubUsername} <span style="color: var(--text-success); font-weight: bold; margin-left: 8px;">${ICONS.checkBadge}Aktif</span>`;
			statusEl.style.fontSize = '1.05em';
			statusEl.style.marginBottom = '12px';

			new Setting(accountCard)
				.setName('Oturumu Kapat')
				.setDesc('GitHub bağlantısını ve kaydedilen Gist kimliğini kaldırır.')
				.addButton(button => button
					.setButtonText('Oturumu Kapat')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.githubToken = '';
						this.plugin.settings.githubUsername = '';
						this.plugin.settings.gistId = '';
						await this.plugin.saveSettings();
						new Notice('[ExamApp Sync] GitHub oturumu kapatıldı.');
						this.display();
					})
				);
		} else {
			// LOGGED OUT STATE
			let inputToken = '';
			let showInfo = false;

			const loginSetting = new Setting(containerEl);

			// Title with SVG Info Icon
			const nameEl = loginSetting.nameEl;
			nameEl.innerHTML = `GitHub Personal Access Token (PAT) ${ICONS.info}`;

			loginSetting.setDesc('GitHub hesabınızdan alınan ("gist" yetkisine sahip) token. Oturum açıldığında senkronizasyon otomatik başlar.');

			loginSetting.addText(text => text
				.setPlaceholder('ghp_...')
				.setValue(this.plugin.settings.githubToken)
				.onChange((val) => { inputToken = val.trim(); })
			);

			loginSetting.controlEl.querySelector('input')?.setAttribute('type', 'password');

			// PAT Info Container (Hidden by default, toggled via info icon)
			const infoBox = containerEl.createDiv({ cls: 'examapp-pat-info-box' });
			infoBox.style.display = 'none';
			infoBox.style.padding = '14px 16px';
			infoBox.style.borderRadius = '8px';
			infoBox.style.backgroundColor = 'var(--background-secondary)';
			infoBox.style.borderLeft = '4px solid var(--interactive-accent)';
			infoBox.style.marginBottom = '16px';
			infoBox.style.fontSize = '0.92em';
			infoBox.style.lineHeight = '1.5';

			infoBox.innerHTML = `
				<div style="font-weight: bold; font-size: 1.05em; margin-bottom: 6px;">PAT (Personal Access Token) Nedir ve Nasıl Alınır?</div>
				<p style="margin: 0 0 10px 0; color: var(--text-normal);">
					<strong>Nedir?</strong> GitHub, güvenlik gerekçesiyle üçüncü taraf uygulamaların kullanıcı adı/şifre ile doğrudan giriş yapmasını yasaklar. 
					PAT, ana şifrenizi vermeden sadece soru havuzlarınızı yedeklememiz için verilen <strong>güvenli bir erişim anahtarıdır</strong>.
				</p>
				<div style="font-weight: bold; margin-bottom: 4px;">3 Adımda Kolayca Alın:</div>
				<ol style="margin: 0 0 12px 18px; padding: 0;">
					<li style="margin-bottom: 6px;">
						<a href="https://github.com/settings/tokens/new?scopes=gist&description=Obsidian%20ExamApp%20Sync" target="_blank" style="color: var(--text-accent); font-weight: bold; text-decoration: underline;">
							GitHub Token Oluşturma Sayfasını Açın ${ICONS.externalLink}
						</a>
						<br><span style="color: var(--text-muted); font-size: 0.9em;">(Gereken "gist" yetkisi otomatik seçili gelecektir)</span>
					</li>
					<li style="margin-bottom: 4px;">Sayfanın en altındaki <strong>"Generate token"</strong> butonuna basın.</li>
					<li>Ekranda çıkan <code>ghp_...</code> ile başlayan kodu kopyalayıp yukarıdaki alana yapıştırın.</li>
				</ol>
			`;

			// Toggle Info Box on Icon Click
			const iconEl = nameEl.querySelector('.examapp-info-icon');
			if (iconEl) {
				iconEl.addEventListener('click', () => {
					showInfo = !showInfo;
					infoBox.style.display = showInfo ? 'block' : 'none';
				});
				iconEl.addEventListener('mouseenter', () => { (iconEl as HTMLElement).style.opacity = '1'; });
				iconEl.addEventListener('mouseleave', () => { (iconEl as HTMLElement).style.opacity = '0.6'; });
			}

			loginSetting.addButton(button => {
				button.buttonEl.className = 'examapp-sync-btn';
				button.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.github}</span><span>GitHub ile Oturum Aç</span>`;
				button.onClick(async () => {
					const tokenToUse = inputToken || this.plugin.settings.githubToken;
					if (!tokenToUse) {
						new Notice('[ExamApp Sync] Lütfen bir GitHub PAT token girin.');
						return;
					}

					button.setDisabled(true);
					button.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.github}</span><span>Oturum Açılıyor...</span>`;

					try {
						// 1. Validate User
						const user = await fetchGitHubUser(tokenToUse);
						this.plugin.settings.githubToken = tokenToUse;
						this.plugin.settings.githubUsername = user.login;

						// 2. Auto-detect Gist
						let detectedGistId = await findExamAppGist(tokenToUse);
						if (!detectedGistId) {
							// Auto-create if none exists
							detectedGistId = await createExamAppGist(tokenToUse);
						}
						this.plugin.settings.gistId = detectedGistId;
						await this.plugin.saveSettings();

						new Notice(`[ExamApp Sync] Hoş geldiniz @${user.login}! Oturum açıldı. Senkronizasyon başlatılıyor...`);

						// 3. AUTOMATIC IMMEDIATE SYNC
						await this.plugin.syncWithGist();

						this.display();
					} catch (err: any) {
						console.error('[ExamApp Login Error]', err);
						new Notice(`[ExamApp Sync] Oturum Açma Başarısız: ${err.message}`);
					} finally {
						button.setDisabled(false);
						button.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.github}</span><span>GitHub ile Oturum Aç</span>`;
					}
				});
			});
		}

		// -------------------------------------------------------------
		// 2. GIST OTOMATİK ALGILAMA & DURUM
		// -------------------------------------------------------------
		if (this.plugin.settings.githubToken) {
			const gistHeader = containerEl.createEl('h3');
			gistHeader.innerHTML = `${ICONS.syncInfinity}Gist Durumu & Senkronizasyon Eylemleri`;

			const gistCard = containerEl.createDiv();
			gistCard.style.padding = '12px';
			gistCard.style.borderRadius = '6px';
			gistCard.style.backgroundColor = 'var(--background-secondary)';
			gistCard.style.marginBottom = '18px';

			if (this.plugin.settings.gistId) {
				const infoEl = gistCard.createEl('div');
				infoEl.innerHTML = `${ICONS.checkBadge}<strong>Bağlı Gist ID:</strong> <code>${this.plugin.settings.gistId}</code> <span style="color: var(--text-muted); font-size: 0.9em;">(Otomatik Bağlandı)</span>`;
				infoEl.style.marginBottom = '10px';
			} else {
				const infoEl = gistCard.createEl('div');
				infoEl.innerHTML = `${ICONS.alertBadge}<strong>Henüz bir ExamApp Gist bağlı değil.</strong>`;
				infoEl.style.color = 'var(--text-accent)';
				infoEl.style.marginBottom = '10px';
			}

			new Setting(gistCard)
				.setName('Manuel Senkronizasyon')
				.setDesc('Gist ile Vault verilerinizi canlı olarak çift yönlü eşitleyin.')
				.addButton(btn => {
					btn.buttonEl.className = 'examapp-sync-btn';
					btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.syncNow}</span><span>Şimdi Senkronize Et</span>`;
					btn.onClick(async () => {
						await this.plugin.syncWithGist();
					});
				});

			new Setting(gistCard)
				.setName('Gist Otomatik Yeniden Tara / Oluştur')
				.setDesc('Hesabınızdaki ExamApp Gist varlığını tarar veya yoksa otomatik oluşturur.')
				.addButton(btn => {
					btn.buttonEl.className = 'examapp-sync-btn';
					btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.search}</span><span>Yeniden Tara</span>`;
					btn.onClick(async () => {
						try {
							const id = await findExamAppGist(this.plugin.settings.githubToken);
							if (id) {
								this.plugin.settings.gistId = id;
								await this.plugin.saveSettings();
								new Notice('[ExamApp Sync] ExamApp Gist başarıyla tespit edildi.');
								this.display();
							} else {
								new Notice('[ExamApp Sync] Hesabınızda henüz ExamApp Gist bulunamadı.');
							}
						} catch (e: any) {
							new Notice(`[ExamApp Sync] Taramada hata: ${e.message}`);
						}
					});
				})
				.addButton(btn => {
					btn.buttonEl.className = 'examapp-sync-btn';
					btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.plus}</span><span>Yeni Gist Oluştur</span>`;
					btn.onClick(async () => {
						try {
							const newId = await createExamAppGist(this.plugin.settings.githubToken);
							this.plugin.settings.gistId = newId;
							await this.plugin.saveSettings();
							new Notice('[ExamApp Sync] Yeni ExamApp Gist oluşturuldu ve bağlandı.');
							this.display();
						} catch (e: any) {
							new Notice(`[ExamApp Sync] Gist oluşturma hatası: ${e.message}`);
						}
					});
				});

			// Gelişmiş Ayarlar (Manuel Gist ID Override)
			const detailsEl = containerEl.createEl('details');
			detailsEl.style.marginBottom = '18px';
			detailsEl.style.cursor = 'pointer';
			const summaryEl = detailsEl.createEl('summary');
			summaryEl.innerHTML = `${ICONS.sliders} Gelişmiş: Manuel Gist ID Düzenleme`;
			summaryEl.style.color = 'var(--text-muted)';
			summaryEl.style.fontWeight = 'bold';

			new Setting(detailsEl)
				.setName('Manuel Gist ID (Özel)')
				.setDesc('Gist ID otomatik tespit edilir. Yalnızca özel bir Gist ID zorlamak istiyorsanız değiştirin.')
				.addText(text => text
					.setPlaceholder('e.g. 1a2b3c4d5e6f7g8h9i0j')
					.setValue(this.plugin.settings.gistId)
					.onChange(async (val) => {
						this.plugin.settings.gistId = val.trim();
						await this.plugin.saveSettings();
					})
				);
		}

		// -------------------------------------------------------------
		// 3. SENKRON KLASÖR YOLU & ŞEMA DOĞRULAMA
		// -------------------------------------------------------------
		const folderHeader = containerEl.createEl('h3');
		folderHeader.innerHTML = `${ICONS.folder}Vault Senkronizasyon Klasörü`;

		new Setting(containerEl)
			.setName('Klasör Yolu')
			.setDesc('Senkronize edilecek JSON dosyalarının ve ExamApp_Overview.md özet panosunun bulunduğu Vault içi klasör.')
			.addText(text => text
				.setPlaceholder('ExamApp Sync')
				.setValue(this.plugin.settings.localFolderPath)
				.onChange(async (val) => {
					const oldFolderPath = this.plugin.settings.localFolderPath;
					const newFolderPath = val.trim() || 'ExamApp Sync';

					if (oldFolderPath === newFolderPath) {
						return;
					}

					// 1. Scan existing dataset sources in old directory before cleanup
					let sources = await scanLocalSources(this.app, oldFolderPath);

					// 2. Perform garbage collection in old directory
					const deletedCount = await cleanupOldDirectory(this.app, oldFolderPath, newFolderPath);

					// 3. Update settings with new path
					this.plugin.settings.localFolderPath = newFolderPath;
					await this.plugin.saveSettings();

					// 4. If sources existed in new path, also include them
					const newFolderSources = await scanLocalSources(this.app, newFolderPath);
					if (sources.length === 0 && newFolderSources.length > 0) {
						sources = newFolderSources;
					}

					// 5. Write sources & generate dashboard in new directory
					if (sources.length > 0) {
						await writeLocalSources(this.app, newFolderPath, sources);
					}
					await generateMarkdownSummary(this.app, newFolderPath, sources, 'Success');

					if (this.plugin.settings.showNotifications) {
						new Notice(`[ExamApp Sync] Klasör değiştirildi. Eski konumdan ${deletedCount} dosya temizlendi, veriler "${newFolderPath}" klasörüne taşındı.`);
					}
				})
			);

		const schemaInfoBox = containerEl.createDiv();
		schemaInfoBox.style.padding = '10px 14px';
		schemaInfoBox.style.borderRadius = '6px';
		schemaInfoBox.style.backgroundColor = 'var(--background-secondary)';
		schemaInfoBox.style.borderLeft = '4px solid var(--interactive-accent)';
		schemaInfoBox.style.marginBottom = '12px';
		schemaInfoBox.style.fontSize = '0.92em';
		schemaInfoBox.innerHTML = `${ICONS.shield} <strong>Şema Güvenlik Filtresi:</strong> Bu klasör içerisindeki dosyalar taranırken sadece geçerli ExamApp soru şemasına (<code>{ id, questions: [...] }</code>) sahip <code>.json</code> dosyaları işlenir. Diğer uyumsuz JSON veya not dosyaları güvenle atlanır.`;

		new Setting(containerEl)
			.setName('Klasör Taramasını Test Et')
			.setDesc('Belirtilen klasördeki uyumlu ExamApp soru havuzlarını canlı olarak tarar ve sayısını doğrular.')
			.addButton(btn => {
				btn.buttonEl.className = 'examapp-sync-btn';
				btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.search}</span><span>Şimdi Tara ve Doğrula</span>`;
				btn.onClick(async () => {
					const sources = await scanLocalSources(this.app, this.plugin.settings.localFolderPath);
					new Notice(`[ExamApp Sync] Tarama Tamamlandı: "${this.plugin.settings.localFolderPath}" klasöründe ${sources.length} adet geçerli ExamApp soru havuzu bulundu.`);
				});
			});

		// -------------------------------------------------------------
		// 4. GENEL AYARLAR
		// -------------------------------------------------------------
		const settingsHeader = containerEl.createEl('h3');
		settingsHeader.innerHTML = `${ICONS.sliders}Genel Otomasyon Ayarları`;

		new Setting(containerEl)
			.setName('Obsidian Açılışında Otomatik Senkronize Et')
			.setDesc('Obsidian başlatıldığında Gist senkronizasyonunu arka planda otomatik olarak tetikler.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncOnStartup)
				.onChange(async (val) => {
					this.plugin.settings.autoSyncOnStartup = val;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Senkronizasyon Bildirimlerini Göster')
			.setDesc('Senkronizasyon başladığında ve tamamlandığında ekranda bilgi bildirimleri (toast Notice) gösterir.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (val) => {
					this.plugin.settings.showNotifications = val;
					await this.plugin.saveSettings();
				})
			);

		// -------------------------------------------------------------
		// 5. EKLENTİ GÜNCELLEMELERİ (AUTO-UPDATER)
		// -------------------------------------------------------------
		const updateHeader = containerEl.createEl('h3');
		updateHeader.innerHTML = `${ICONS.refresh}Eklenti Güncellemeleri`;

		new Setting(containerEl)
			.setName('Arka Planda Otomatik Güncelleme Kontrolü')
			.setDesc('Obsidian açıldıktan 10 saniye sonra, 24 saatte bir arka planda güncellemeleri kontrol eder (Açılış performansına yük bindirmez).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoCheckUpdates)
				.onChange(async (val) => {
					this.plugin.settings.autoCheckUpdates = val;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Güncellemeleri Otomatik İndir ve Kur')
			.setDesc('Yeni bir sürüm tespit edildiğinde eklenti dosyalarını otomatik günceller.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoInstallUpdates)
				.onChange(async (val) => {
					this.plugin.settings.autoInstallUpdates = val;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Güncellemeleri Şimdi Kontrol Et')
			.setDesc(`Mevcut Sürüm: v${this.plugin.manifest.version}. GitHub deposundaki en son sürümü canlı olarak kontrol eder.`)
			.addButton(btn => {
				btn.buttonEl.className = 'examapp-sync-btn';
				btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.refresh}</span><span>Şimdi Kontrol Et</span>`;
				btn.onClick(async () => {
					btn.setDisabled(true);
					btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.refresh}</span><span>Kontrol Ediliyor...</span>`;
					try {
						await checkForUpdates(this.plugin, true);
					} finally {
						btn.setDisabled(false);
						btn.buttonEl.innerHTML = `<span class="examapp-sync-icon-span">${ICONS.refresh}</span><span>Şimdi Kontrol Et</span>`;
					}
				});
			});
	}
}

