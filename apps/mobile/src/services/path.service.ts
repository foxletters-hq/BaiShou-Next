import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStoragePathService } from '@baishou/core';

export class MobileStoragePathService implements IStoragePathService {
  private customRootKey = 'baishou_custom_storage_root';

  public async getCustomRootPath(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.customRootKey);
    } catch {
      return null;
    }
  }

  public async updateRootDirectory(newPath: string): Promise<void> {
    await AsyncStorage.setItem(this.customRootKey, newPath);
  }

  /**
   * Triggers the Android MANAGE_EXTERNAL_STORAGE native settings page
   */
  public async requestAllFilesAccess(): Promise<void> {
    if (Application.applicationId) {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        { data: `package:${Application.applicationId}` }
      );
    }
  }

  public async getRootDirectory(): Promise<string> {
    const customPath = await this.getCustomRootPath();

    if (customPath && customPath.trim() !== '') {
      try {
        const info = await FileSystem.getInfoAsync(customPath);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(customPath, { intermediates: true });
        }
        
        // Writeability test
        const testFile = `${customPath}/.write_test`;
        await FileSystem.writeAsStringAsync(testFile, 'test');
        try {
          await FileSystem.deleteAsync(testFile, { idempotent: true });
        } catch (e) {
          // ignore
        }
        return customPath;
      } catch (e) {
        console.warn(`StoragePathService: Custom physical path ${customPath} is inaccessible.`, e);
        // Fallback or trigger intent
        await this.requestAllFilesAccess();
      }
    }

    // Default Fallback: Raw local emulated public storage fallback if not customized
    const fallbackPath = 'file:///storage/emulated/0/BaiShou_Root';
    try {
      const info = await FileSystem.getInfoAsync(fallbackPath);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(fallbackPath, { intermediates: true });
      }
      return fallbackPath;
    } catch (e) {
      console.warn('Fallback to App sandbox due to extreme permission denial', e);
      // Extreme fallback to pure internal scoped storage if permission was denied and user hasn't granted it yet
      const base = (FileSystem as any).documentDirectory || 'file:///data/user/0/com.anonymous.mobile/files/';
      const internalFallback = `${base}Vaults`;
      const docInfo = await FileSystem.getInfoAsync(internalFallback);
      if (!docInfo.exists) {
        await FileSystem.makeDirectoryAsync(internalFallback, { intermediates: true });
      }
      return internalFallback;
    }
  }

  public async getGlobalRegistryDirectory(): Promise<string> {
    // Registry should safely always be in the internal document directory so it isn't accidentally formatted
    const base = (FileSystem as any).documentDirectory || 'file:///data/user/0/com.anonymous.mobile/files/';
    return `${base}.baishou_global`;
  }

  public async getVaultDirectory(vaultName: string): Promise<string> {
    const root = await this.getRootDirectory();
    // sanitize
    const safeName = vaultName.replace(/[/\\]/g, '_');
    const vaultDir = `${root}/${safeName}`;
    const info = await FileSystem.getInfoAsync(vaultDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });
    }
    return vaultDir;
  }

  public async getVaultSystemDirectory(vaultName: string): Promise<string> {
    const vaultDir = await this.getVaultDirectory(vaultName);
    const vaultSysDir = `${vaultDir}/.baishou`;
    const info = await FileSystem.getInfoAsync(vaultSysDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(vaultSysDir, { intermediates: true });
    }
    return vaultSysDir;
  }
}
