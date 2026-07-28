import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import ExamAppGistSyncPlugin from './main';
import { fetchGitHubUser, findExamAppGist, createExamAppGist } from './githubApi';
import { scanLocalSources } from './fileScanner';

export interface ExamAppGistSyncSettings {
	githubToken: string;
	gistId: string;
	localFolderPath: string;
	githubUsername: string;
	autoSyncOnStartup: boolean;
	showNotifications: boolean;
}

export const DEFAULT_SETTINGS: ExamAppGistSyncSettings = {
	githubToken: '',
	gistId: '',
	localFolderPath: 'ExamApp Sync',
	githubUsername: '',
	autoSyncOnStartup: false,
	showNotifications: true
};

const GITHUB_SVG_ICON = `<svg height="16" width="16" viewBox="0 0 16 16" version="1.1" fill="currentColor" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>`;

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
		containerEl.createEl('h3', { text: '🔑 GitHub Oturum Yönetimi' });

		if (this.plugin.settings.githubToken && this.plugin.settings.githubUsername) {
			// LOGGED IN STATE
			const accountCard = containerEl.createDiv({ cls: 'examapp-account-card' });
			accountCard.style.padding = '14px';
			accountCard.style.borderRadius = '8px';
			accountCard.style.backgroundColor = 'var(--background-secondary)';
			accountCard.style.border = '1px solid var(--background-modifier-border)';
			accountCard.style.marginBottom = '18px';

			const statusEl = accountCard.createEl('div');
			statusEl.innerHTML = `${GITHUB_SVG_ICON}<strong>Bağlı Hesap:</strong> @${this.plugin.settings.githubUsername} <span style="color: var(--text-success); font-weight: bold; margin-left: 8px;">● Aktif</span>`;
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
						new Notice('🔒 GitHub oturumu kapatıldı.');
						this.display();
					})
				);
		} else {
			// LOGGED OUT STATE
			let inputToken = '';
			let showInfo = false;

			const loginSetting = new Setting(containerEl);

			// Title with Info Icon
			const nameEl = loginSetting.nameEl;
			nameEl.innerHTML = `GitHub Personal Access Token (PAT) <span class="examapp-info-icon" style="cursor: pointer; color: var(--text-muted); font-size: 0.9em; margin-left: 6px; padding: 2px 6px; border-radius: 50%; background: var(--background-modifier-border);" title="PAT Nedir ve Nasıl Alınır?">ℹ️</span>`;

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
				<div style="font-weight: bold; font-size: 1.05em; margin-bottom: 6px;">ℹ️ PAT (Personal Access Token) Nedir ve Nasıl Alınır?</div>
				<p style="margin: 0 0 10px 0; color: var(--text-normal);">
					<strong>Nedir?</strong> GitHub, güvenlik gerekçesiyle uygulamaların kullanıcı adı/şifre ile doğrudan giriş yapmasını yasaklar. 
					PAT, ana şifrenizi vermeden sadece soru havuzlarınızı yedeklememiz için verilen <strong>güvenli bir erişim anahtarıdır</strong>.
				</p>
				<div style="font-weight: bold; margin-bottom: 4px;">🚀 3 Adımda Kolayca Alın:</div>
				<ol style="margin: 0 0 12px 18px; padding: 0;">
					<li style="margin-bottom: 4px;">
						<a href="https://github.com/settings/tokens/new?scopes=gist&description=Obsidian%20ExamApp%20Sync" target="_blank" style="color: var(--text-accent); font-weight: bold; text-decoration: underline;">
							🔗 Buraya Tıklayarak GitHub Token Oluşturma Sayfasını Açın
						</a>
						<em>(Gereken "gist" yetkisi otomatik seçili gelecektir)</em>
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
			}

			loginSetting.addButton(button => {
				button.buttonEl.innerHTML = `${GITHUB_SVG_ICON} GitHub ile Oturum Aç`;
				button.buttonEl.style.backgroundColor = '#24292f';
				button.buttonEl.style.color = '#ffffff';
				button.buttonEl.style.fontWeight = '600';
				button.buttonEl.style.padding = '6px 14px';
				button.buttonEl.style.borderRadius = '6px';
				button.buttonEl.style.border = 'none';
				button.buttonEl.style.cursor = 'pointer';
				button.buttonEl.style.display = 'inline-flex';
				button.buttonEl.style.alignItems = 'center';
				button.buttonEl.style.transition = 'background-color 0.2s ease';

				button.buttonEl.addEventListener('mouseenter', () => {
					button.buttonEl.style.backgroundColor = '#333942';
				});
				button.buttonEl.addEventListener('mouseleave', () => {
					button.buttonEl.style.backgroundColor = '#24292f';
				});

				button.onClick(async () => {
					const tokenToUse = inputToken || this.plugin.settings.githubToken;
					if (!tokenToUse) {
						new Notice('⚠️ Lütfen bir GitHub PAT token girin.');
						return;
					}

					button.setDisabled(true);
					button.buttonEl.innerHTML = `${GITHUB_SVG_ICON} Oturum Açılıyor...`;

					try {
						// 1. Validate User
						const user = await fetchGitHubUser(tokenToUse);
						this.plugin.settings.githubToken = tokenToUse;
						this.plugin.settings.githubUsername = user.login;

						// 2. Auto-detect Gist
						let detectedGistId = await findExamAppGist(tokenToUse);
						if (!detectedGistId) {
							// Auto-create if none exists so user doesn't have to do anything!
							detectedGistId = await createExamAppGist(tokenToUse);
						}
						this.plugin.settings.gistId = detectedGistId;
						await this.plugin.saveSettings();

						new Notice(`✅ Hoş geldiniz @${user.login}! Oturum açıldı. Senkronizasyon başlatılıyor...`);

						// 3. AUTOMATIC IMMEDIATE SYNC
						await this.plugin.syncWithGist();

						this.display();
					} catch (err: any) {
						console.error('[ExamApp Login Error]', err);
						new Notice(`❌ Oturum Açma Başarısız: ${err.message}`);
					} finally {
						button.setDisabled(false);
						button.buttonEl.innerHTML = `${GITHUB_SVG_ICON} GitHub ile Oturum Aç`;
					}
				});
			});
		}

		// -------------------------------------------------------------
		// 2. GIST OTOMATİK ALGILAMA & DURUM
		// -------------------------------------------------------------
		if (this.plugin.settings.githubToken) {
			containerEl.createEl('h3', { text: '☁️ Gist Durumu & Otomatik Tespit' });

			const gistCard = containerEl.createDiv();
			gistCard.style.padding = '12px';
			gistCard.style.borderRadius = '6px';
			gistCard.style.backgroundColor = 'var(--background-secondary)';
			gistCard.style.marginBottom = '18px';

			if (this.plugin.settings.gistId) {
				const infoEl = gistCard.createEl('div');
				infoEl.innerHTML = `<strong>🟢 Bağlı Gist ID:</strong> <code>${this.plugin.settings.gistId}</code> <span style="color: var(--text-muted); font-size: 0.9em;">(Otomatik Bağlandı)</span>`;
				infoEl.style.marginBottom = '10px';
			} else {
				const infoEl = gistCard.createEl('div');
				infoEl.innerHTML = `<strong>⚠️ Henüz bir ExamApp Gist bağlı değil.</strong>`;
				infoEl.style.color = 'var(--text-accent)';
				infoEl.style.marginBottom = '10px';
			}

			new Setting(gistCard)
				.setName('Gist Otomatik Yeniden Tara / Oluştur')
				.setDesc('Hesabınızdaki ExamApp Gist varlığını tarar veya yoksa otomatik oluşturur.')
				.addButton(btn => btn
					.setButtonText('Yeniden Tara')
					.onClick(async () => {
						try {
							const id = await findExamAppGist(this.plugin.settings.githubToken);
							if (id) {
								this.plugin.settings.gistId = id;
								await this.plugin.saveSettings();
								new Notice('✅ ExamApp Gist başarıyla tespit edildi!');
								this.display();
							} else {
								new Notice('⚠️ Hesabınızda henüz ExamApp Gist bulunamadı.');
							}
						} catch (e: any) {
							new Notice(`❌ Taramada hata: ${e.message}`);
						}
					})
				)
				.addButton(btn => btn
					.setButtonText('Yeni Gist Oluştur')
					.setCta()
					.onClick(async () => {
						try {
							const newId = await createExamAppGist(this.plugin.settings.githubToken);
							this.plugin.settings.gistId = newId;
							await this.plugin.saveSettings();
							new Notice('🎉 Yeni ExamApp Gist başarıyla oluşturuldu ve bağlandı!');
							this.display();
						} catch (e: any) {
							new Notice(`❌ Gist oluşturma hatası: ${e.message}`);
						}
					})
				);

			// Gelişmiş Ayarlar (Manuel Gist ID Override)
			const detailsEl = containerEl.createEl('details');
			detailsEl.style.marginBottom = '18px';
			detailsEl.style.cursor = 'pointer';
			const summaryEl = detailsEl.createEl('summary', { text: '⚙️ Gelişmiş: Manuel Gist ID Düzenleme' });
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
		containerEl.createEl('h3', { text: '📂 Vault Senkronizasyon Klasörü' });

		new Setting(containerEl)
			.setName('Klasör Yolu')
			.setDesc('Senkronize edilecek JSON dosyalarının bulunduğu Vault içi klasör. (Varsayılan: "ExamApp Sync")')
			.addText(text => text
				.setPlaceholder('ExamApp Sync')
				.setValue(this.plugin.settings.localFolderPath)
				.onChange(async (val) => {
					this.plugin.settings.localFolderPath = val.trim() || 'ExamApp Sync';
					await this.plugin.saveSettings();
				})
			);

		const schemaInfoBox = containerEl.createDiv();
		schemaInfoBox.style.padding = '10px 14px';
		schemaInfoBox.style.borderRadius = '6px';
		schemaInfoBox.style.backgroundColor = 'var(--background-secondary)';
		schemaInfoBox.style.borderLeft = '4px solid var(--interactive-accent)';
		schemaInfoBox.style.marginBottom = '12px';
		schemaInfoBox.innerHTML = `ℹ️ <strong>Şema Güvenlik Filtresi:</strong> Bu klasör içerisindeki dosyalar taranırken sadece geçerli ExamApp soru şemasına (<code>{ id, questions: [...] }</code>) sahip <code>.json</code> dosyaları işlenir. Diğer uyumsuz JSON veya not dosyaları güvenle atlanır.`;

		new Setting(containerEl)
			.setName('Klasör Taramasını Test Et')
			.setDesc('Belirtilen klasördeki uyumlu ExamApp soru havuzlarını canlı olarak tarar ve sayısını doğrular.')
			.addButton(btn => btn
				.setButtonText('Şimdi Tara ve Doğrula')
				.onClick(async () => {
					const sources = await scanLocalSources(this.app, this.plugin.settings.localFolderPath);
					new Notice(`🔍 Tarama Tamamlandı: "${this.plugin.settings.localFolderPath}" klasöründe ${sources.length} adet geçerli ExamApp soru havuzu bulundu.`);
				})
			);

		// -------------------------------------------------------------
		// 4. GENEL AYARLAR
		// -------------------------------------------------------------
		containerEl.createEl('h3', { text: '⚙️ Genel Otomasyon Ayarları' });

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
	}
}
