import { App, PluginSettingTab, Setting } from 'obsidian';
import ExamAppGistSyncPlugin from './main';

export interface ExamAppGistSyncSettings {
	githubToken: string;
	gistId: string;
	localFolderPath: string;
}

export const DEFAULT_SETTINGS: ExamAppGistSyncSettings = {
	githubToken: '',
	gistId: '',
	localFolderPath: 'ExamApp Sync'
}

export class ExamAppGistSyncSettingTab extends PluginSettingTab {
	plugin: ExamAppGistSyncPlugin;

	constructor(app: App, plugin: ExamAppGistSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('GitHub Personal Access Token (PAT)')
			.setDesc('Gist okuma/yazma yetkisine (gist scope) sahip bir token.')
			.addText(text => text
				.setPlaceholder('ghp_...')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				})
			).controlEl.querySelector('input')?.setAttribute('type', 'password');

		new Setting(containerEl)
			.setName('Gist ID')
			.setDesc('ExamApp verilerinin tutulduğu hedef Gist\'in ID\'si.')
			.addText(text => text
				.setPlaceholder('e.g. 1a2b3c4d5e6f7g8h9i0j')
				.setValue(this.plugin.settings.gistId)
				.onChange(async (value) => {
					this.plugin.settings.gistId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Local Folder Path')
			.setDesc('Senkronize edilecek JSON dosyalarının bulunduğu Vault içi klasör (örn. "ExamApp Sync"). Bu klasör altındaki uyumlu JSON dosyaları taranır.')
			.addText(text => text
				.setPlaceholder('ExamApp Sync')
				.setValue(this.plugin.settings.localFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.localFolderPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
