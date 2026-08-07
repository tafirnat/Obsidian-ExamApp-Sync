import { App, Modal, Notice } from 'obsidian';
import ExamAppGistSyncPlugin from './main';

export class ExamAppSyncModal extends Modal {
	plugin: ExamAppGistSyncPlugin;

	constructor(app: App, plugin: ExamAppGistSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.style.padding = '20px';

		const title = contentEl.createEl('h2', { text: 'ExamApp Senkronizasyon Paneli' });
		title.style.marginTop = '0';
		title.style.marginBottom = '16px';

		const infoCard = contentEl.createDiv();
		infoCard.style.padding = '12px 16px';
		infoCard.style.borderRadius = '8px';
		infoCard.style.backgroundColor = 'var(--background-secondary)';
		infoCard.style.border = '1px solid var(--background-modifier-border)';
		infoCard.style.marginBottom = '20px';
		infoCard.style.fontSize = '0.92em';
		infoCard.style.lineHeight = '1.6';

		const username = this.plugin.settings.githubUsername ? `@${this.plugin.settings.githubUsername}` : 'Oturum Açılmadı';
		const gistId = this.plugin.settings.gistId ? this.plugin.settings.gistId : 'Bağlı Değil';
		const folderPath = this.plugin.settings.localFolderPath || '50_Projects/ExamApp/datasets';

		let lastSyncDateStr = 'Henüz Yapılmadı';
		if (this.plugin.settings.lastSyncTimestamp) {
			try {
				lastSyncDateStr = new Date(this.plugin.settings.lastSyncTimestamp).toISOString().replace('T', ' ').substring(0, 19);
			} catch (e) {
				lastSyncDateStr = String(this.plugin.settings.lastSyncTimestamp);
			}
		}

		const lastSyncModeStr = this.plugin.settings.lastSyncMode || 'Belirtilmedi';
		const lastSyncStatusStr = this.plugin.settings.lastSyncStatus || 'Belirtilmedi';

		infoCard.innerHTML = `
			<div><strong>Hesap:</strong> <span style="color: var(--text-accent); font-weight: 600;">${username}</span></div>
			<div><strong>Gist ID:</strong> <code>${gistId}</code></div>
			<div><strong>Senkron Klasörü:</strong> <code>${folderPath}</code></div>
			<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--background-modifier-border); display: flex; gap: 12px; font-size: 0.9em; opacity: 0.9;">
				<div><strong>Son Senkronizasyon:</strong> <code>${lastSyncDateStr}</code></div>
				<div><strong>Tip:</strong> <code>${lastSyncModeStr}</code></div>
				<div><strong>Durum:</strong> <span style="color: var(--text-success); font-weight: bold;">${lastSyncStatusStr}</span></div>
			</div>
		`;

		const actionsLabel = contentEl.createEl('h4', { text: 'Senkronizasyon Yöntemi Seçin' });
		actionsLabel.style.marginBottom = '12px';

		const btnGroup = contentEl.createDiv();
		btnGroup.style.display = 'flex';
		btnGroup.style.flexDirection = 'column';
		btnGroup.style.gap = '12px';

		// 1. Full Dual Sync Button
		const fullSyncBtn = btnGroup.createEl('button', { cls: 'examapp-sync-btn' });
		fullSyncBtn.title = 'Gist ve Vault verilerini tarih ve içerik durumuna göre akıllıca birleştirir';
		fullSyncBtn.style.width = '100%';
		fullSyncBtn.style.justifyContent = 'flex-start';
		fullSyncBtn.style.padding = '10px 14px';
		fullSyncBtn.innerHTML = `
			<span class="examapp-sync-icon-span">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M2.5 16l1.2 1.3A10 10 0 0 0 22 12.5"/></svg>
			</span>
			<span style="font-weight: 600;">Çift Yönlü Senkronize Et (Full Sync)</span>
			<span class="examapp-sync-badge-span" style="margin-left: auto;">Tavsiye Edilen</span>
		`;
		fullSyncBtn.onclick = async () => {
			this.close();
			await this.plugin.syncWithGist();
		};

		// 2. Pull Only Button
		const pullBtn = btnGroup.createEl('button', { cls: 'examapp-sync-btn' });
		pullBtn.title = 'Gist\'teki soru havuzlarını okur ve Vault klasörlerine (Archived/Deleted) aktarır';
		pullBtn.style.width = '100%';
		pullBtn.style.justifyContent = 'flex-start';
		pullBtn.style.padding = '10px 14px';
		pullBtn.innerHTML = `
			<span class="examapp-sync-icon-span">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
			</span>
			<span style="font-weight: 600;">Gist'ten Yerel Vault'a Çek (Pull Only)</span>
		`;
		pullBtn.onclick = async () => {
			this.close();
			await this.plugin.pullFromGist();
		};

		// 3. Push Only Button
		const pushBtn = btnGroup.createEl('button', { cls: 'examapp-sync-btn' });
		pushBtn.title = 'Vault\'taki aktif soru havuzlarını (Backup haric) Gist\'e yükler';
		pushBtn.style.width = '100%';
		pushBtn.style.justifyContent = 'flex-start';
		pushBtn.style.padding = '10px 14px';
		pushBtn.innerHTML = `
			<span class="examapp-sync-icon-span">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
			</span>
			<span style="font-weight: 600;">Yerel Vault'tan Gist'e Gönder (Push Only)</span>
		`;
		pushBtn.onclick = async () => {
			this.close();
			await this.plugin.pushToGist();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

