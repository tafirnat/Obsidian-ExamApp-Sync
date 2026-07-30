import { Notice, requestUrl } from 'obsidian';
import ExamAppGistSyncPlugin from './main';

function isNewerVersion(remoteVer: string, currentVer: string): boolean {
	const r = remoteVer.replace(/^v/, '').split('.').map(Number);
	const c = currentVer.replace(/^v/, '').split('.').map(Number);
	for (let i = 0; i < Math.max(r.length, c.length); i++) {
		const rv = r[i] || 0;
		const cv = c[i] || 0;
		if (rv > cv) return true;
		if (rv < cv) return false;
	}
	return false;
}

export async function checkForUpdates(plugin: ExamAppGistSyncPlugin, isManual: boolean = false): Promise<void> {
	const now = Date.now();
	const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

	// Skip if not manual and autoCheckUpdates is disabled or 24h haven't passed
	if (!isManual) {
		if (!plugin.settings.autoCheckUpdates) return;
		if (now - plugin.settings.lastUpdateCheckTimestamp < TWENTY_FOUR_HOURS) return;
	}

	if (isManual && plugin.settings.showNotifications) {
		new Notice('[ExamApp Sync] Eklenti güncellemeleri kontrol ediliyor...');
	}

	try {
		plugin.settings.lastUpdateCheckTimestamp = now;
		await plugin.saveSettings();

		const currentVersion = plugin.manifest.version;
		let latestVersion = '';
		let downloadUrlMainJs = '';
		let downloadUrlManifest = '';

		// 1. Try GitHub Release API first
		try {
			const releaseRes = await requestUrl({
				url: 'https://api.github.com/repos/tafirnat/Obsidian-ExamApp-Sync/releases/latest',
				headers: { 'User-Agent': 'Obsidian-ExamApp-Sync-Plugin' }
			});

			if (releaseRes.status === 200) {
				const releaseData = releaseRes.json;
				latestVersion = (releaseData.tag_name || releaseData.name || '').replace(/^v/, '');

				const assets = releaseData.assets || [];
				const mainJsAsset = assets.find((a: any) => a.name === 'main.js');
				const manifestAsset = assets.find((a: any) => a.name === 'manifest.json');

				if (mainJsAsset) downloadUrlMainJs = mainJsAsset.browser_download_url;
				if (manifestAsset) downloadUrlManifest = manifestAsset.browser_download_url;
			}
		} catch (e) {
			console.log('[ExamApp Sync] Release API unavailable or no release tagged, checking raw main branch.');
		}

		// 2. Fallback to raw GitHub main branch if release assets not found
		if (!latestVersion) {
			try {
				const rawManifestRes = await requestUrl({
					url: 'https://raw.githubusercontent.com/tafirnat/Obsidian-ExamApp-Sync/main/manifest.json'
				});
				if (rawManifestRes.status === 200) {
					const remoteManifest = rawManifestRes.json;
					latestVersion = remoteManifest.version;
					downloadUrlMainJs = 'https://raw.githubusercontent.com/tafirnat/Obsidian-ExamApp-Sync/main/main.js';
					downloadUrlManifest = 'https://raw.githubusercontent.com/tafirnat/Obsidian-ExamApp-Sync/main/manifest.json';
				}
			} catch (e) {
				console.log('[ExamApp Sync] Raw GitHub main branch unreachable.');
			}
		}

		if (!latestVersion) {
			if (isManual && plugin.settings.showNotifications) {
				new Notice('[ExamApp Sync] Güncelleme sunucusuna ulaşılamadı veya sürüm bulunamadı.');
			}
			return;
		}

		if (isNewerVersion(latestVersion, currentVersion)) {
			new Notice(`[ExamApp Sync] Yeni güncelleme mevcut: v${latestVersion} (Mevcut: v${currentVersion})`);

			if (plugin.settings.autoInstallUpdates && downloadUrlMainJs && downloadUrlManifest) {
				new Notice('[ExamApp Sync] Yeni eklenti dosyaları indiriliyor...');

				const mainJsRes = await requestUrl({ url: downloadUrlMainJs });
				const manifestRes = await requestUrl({ url: downloadUrlManifest });

				if (mainJsRes.status === 200 && manifestRes.status === 200) {
					const pluginDir = plugin.manifest.dir;
					if (pluginDir) {
						const adapter = plugin.app.vault.adapter;
						await adapter.write(`${pluginDir}/main.js`, mainJsRes.text);
						await adapter.write(`${pluginDir}/manifest.json`, manifestRes.text);

						new Notice(`[ExamApp Sync] Eklenti v${latestVersion} sürümüne güncellendi! Lütfen eklentiyi veya Obsidian'ı yeniden başlatın.`);
					}
				}
			}
		} else {
			if (isManual && plugin.settings.showNotifications) {
				new Notice(`[ExamApp Sync] Eklentiniz güncel! (v${currentVersion})`);
			}
		}
	} catch (err: any) {
		console.error('[ExamApp Sync] Güncelleme kontrolü hatası:', err);
		if (isManual && plugin.settings.showNotifications) {
			new Notice(`[ExamApp Sync] Güncelleme kontrolü hatası: ${err.message}`);
		}
	}
}
