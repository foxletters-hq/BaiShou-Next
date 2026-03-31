import { ipcMain } from 'electron';
import { SettingsRepository } from '@baishou/database';
import { SettingsFileService, SettingsManagerService } from '@baishou/core';
import { appDb } from '../db';
import { pathService } from './vault.ipc';
import { AIProviderConfig, GlobalModelsConfig, FeatureSettingsConfig } from '@baishou/shared';

const settingsRepo = new SettingsRepository(appDb);
const settingsFileService = new SettingsFileService(pathService);
export const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService);

export function registerSettingsIPC() {
  ipcMain.handle('settings:get-providers', async () => {
    return await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
  });

  ipcMain.handle('settings:set-providers', async (_, providers: AIProviderConfig[]) => {
    await settingsManager.set('ai_providers', providers);
    return true;
  });

  ipcMain.handle('settings:get-global-models', async () => {
    return await settingsManager.get<GlobalModelsConfig>('global_models') || null;
  });

  ipcMain.handle('settings:set-global-models', async (_, config: GlobalModelsConfig) => {
    await settingsManager.set('global_models', config);
    return true;
  });

  ipcMain.handle('settings:get-features', async () => {
    return await settingsManager.get<FeatureSettingsConfig>('feature_settings') || null;
  });

  ipcMain.handle('settings:set-features', async (_, config: FeatureSettingsConfig) => {
    await settingsManager.set('feature_settings', config);
    return true;
  });
}
