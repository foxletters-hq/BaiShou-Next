import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { zip, unzip } from 'react-native-zip-archive';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { IArchiveService, ImportResult, StoragePathService, VaultService } from '@baishou/core';
import { connectionManager } from '@baishou/database';
import { MobileStoragePathService } from './path.service';

export class MobileArchiveService implements IArchiveService {
  constructor(
    private pathService: MobileStoragePathService,
    private vaultService: VaultService
  ) {}

  public async exportToTempFile(): Promise<string | null> {
    const rootDir = await this.pathService.getRootDirectory();
    const cacheDir = `${FileSystem.cacheDirectory}baishou_archive_prep_${Date.now()}`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });

    // Step 1: Copy files from Root to Cache, intentionally ignoring -wal, -shm etc.
    const rootInfo = await FileSystem.getInfoAsync(rootDir);
    if (rootInfo.exists && rootInfo.isDirectory) {
      await this.selectiveCopy(rootDir, cacheDir);
    }

    // Step 2: Inject Global Preferences natively from AsyncStorage
    try {
      const configDir = `${cacheDir}/config`;
      await FileSystem.makeDirectoryAsync(configDir, { intermediates: true });

      const prefs: Record<string, any> = {};
      const keys = await AsyncStorage.getAllKeys();
      // Collect anything relevant to backup config if Agent A implemented it via AsyncStorage
      for (const k of keys) {
        if (k.startsWith('@settings:')) {
          prefs[k] = await AsyncStorage.getItem(k);
        }
      }

      await FileSystem.writeAsStringAsync(
        `${configDir}/device_preferences.json`, 
        JSON.stringify(prefs, null, 2)
      );
    } catch (e) {
      console.warn('[MobileArchive] Failed to dump device preferences', e);
    }

    // Step 3: Zip the prepared folder
    const targetZip = `${FileSystem.cacheDirectory}BaiShou_Backup_${Date.now()}.zip`;
    try {
      await zip(cacheDir, targetZip);
      // Clean up the prep folder once zipped
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      return targetZip;
    } catch (err) {
      console.error('[MobileArchive] ZIP operation failed', err);
      return null;
    }
  }

  public async exportToUserDevice(): Promise<string | null> {
    const zipPath = await this.exportToTempFile();
    if (!zipPath) return null;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: '保存 BaiShou 物理系统备份'
      });
      return zipPath;
    }
    return null;
  }

  public async importFromZip(zipFilePath: string, createSnapshotBefore: boolean = true): Promise<ImportResult> {
    let snapshotPath: string | undefined;

    if (createSnapshotBefore) {
      const snap = await this.createSnapshot();
      if (snap) snapshotPath = snap;
    }

    // 1. Cut off SQLite bindings globally
    await connectionManager.disconnect();

    // 2. Erase existing Vault Workspace Root (MANAGE_EXTERNAL_STORAGE handles it well)
    const rootDir = await this.pathService.getRootDirectory();
    try {
      await FileSystem.deleteAsync(rootDir, { idempotent: true });
    } catch (e) {
      console.warn('[MobileArchive] Wipe root warning', e);
    }
    await FileSystem.makeDirectoryAsync(rootDir, { intermediates: true });

    // 3. Extract Archive directly into the Root Directory
    try {
      // Clean the file:// prefix if it exists for react-native-zip-archive
      const sourceZip = zipFilePath.replace('file://', '');
      const targetDir = rootDir.replace('file://', '');
      await unzip(sourceZip, targetDir);
    } catch (e) {
      console.error('[MobileArchive] Failed to extract physical payload', e);
      throw new Error('导入解压失败，请检查文件格式或存储权限');
    }

    // 4. Remap cross-device paths in vault_registry.json
    try {
      const registryFile = `${rootDir}/.baishou/vault_registry.json`;
      const regStat = await FileSystem.getInfoAsync(registryFile);
      
      if (regStat.exists) {
        const raw = await FileSystem.readAsStringAsync(registryFile);
        const vaults: any[] = JSON.parse(raw);
        let modified = false;

        for (const v of vaults) {
          const correctPath = `${rootDir}/${v.name}`;
          if (v.path !== correctPath) {
            v.path = correctPath;
            modified = true;
          }
        }
        if (modified) {
          await FileSystem.writeAsStringAsync(registryFile, JSON.stringify(vaults, null, 2));
        }
      }
    } catch (e) {
      console.warn('[MobileArchive] Failed to remap vault paths', e);
    }

    // 5. Restore Global configurations from config/
    try {
      const configPath = `${rootDir}/config/device_preferences.json`;
      const configStat = await FileSystem.getInfoAsync(configPath);
      if (configStat.exists) {
        const raw = await FileSystem.readAsStringAsync(configPath);
        const prefs = JSON.parse(raw);

        // Inject back into AsyncStorage
        for (const [k, v] of Object.entries(prefs)) {
          if (typeof v === 'string') {
            await AsyncStorage.setItem(k, v);
          }
        }
        await FileSystem.deleteAsync(`${rootDir}/config`, { idempotent: true });
      }
    } catch (e) {
      console.warn('[MobileArchive] Failed to restore device preferences', e);
    }

    // 6. Regenerate and reload system registry completely
    await this.vaultService.initRegistry();

    return {
      fileCount: -1,
      profileRestored: true,
      snapshotPath
    };
  }

  public async createSnapshot(): Promise<string | null> {
    const zipPath = await this.exportToTempFile();
    if (!zipPath) return null;

    const snapshotDir = `${FileSystem.documentDirectory}snapshots`;
    await FileSystem.makeDirectoryAsync(snapshotDir, { intermediates: true });

    const dt = new Date();
    const ts = `${dt.getFullYear()}${(dt.getMonth()+1).toString().padStart(2,'0')}${dt.getDate().toString().padStart(2,'0')}_${dt.getHours().toString().padStart(2,'0')}${dt.getMinutes().toString().padStart(2,'0')}`;
    const finalSnapPath = `${snapshotDir}/snapshot_${ts}.zip`;

    await FileSystem.copyAsync({ from: zipPath, to: finalSnapPath });
    await FileSystem.deleteAsync(zipPath, { idempotent: true });
    return finalSnapPath;
  }

  // --- Helpers ---
  private async selectiveCopy(sourceDirPath: string, targetDirPath: string) {
    const dirContent = await FileSystem.readDirectoryAsync(sourceDirPath);

    for (const itemName of dirContent) {
      if (itemName === 'snapshots' || itemName === 'temp') continue;
      if (itemName.endsWith('-wal') || itemName.endsWith('-shm') || itemName.endsWith('-journal')) continue;

      const fullSourcePath = `${sourceDirPath}/${itemName}`;
      const fullTargetPath = `${targetDirPath}/${itemName}`;
      
      const stat = await FileSystem.getInfoAsync(fullSourcePath);
      if (stat.isDirectory) {
        await FileSystem.makeDirectoryAsync(fullTargetPath, { intermediates: true });
        await this.selectiveCopy(fullSourcePath, fullTargetPath);
      } else {
        await FileSystem.copyAsync({ from: fullSourcePath, to: fullTargetPath });
      }
    }
  }
}
