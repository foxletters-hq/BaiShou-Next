import { ipcMain } from 'electron';
import { SettingsRepository } from '@baishou/database';
import { appDb } from '../db';
import { AIProviderConfig, GlobalModelsConfig, FeatureSettingsConfig } from '@baishou/shared';

const settingsRepo = new SettingsRepository(appDb);

export function registerSettingsIPC() {
  ipcMain.handle('settings:get-providers', async () => {
    return await settingsRepo.get<AIProviderConfig[]>('ai_providers') || [];
  });

  ipcMain.handle('settings:set-providers', async (_, providers: AIProviderConfig[]) => {
    await settingsRepo.set('ai_providers', providers);
    return true;
  });

  ipcMain.handle('settings:get-global-models', async () => {
    return await settingsRepo.get<GlobalModelsConfig>('global_models') || null;
  });

  ipcMain.handle('settings:set-global-models', async (_, config: GlobalModelsConfig) => {
    await settingsRepo.set('global_models', config);
    return true;
  });

  ipcMain.handle('settings:get-features', async () => {
    return await settingsRepo.get<FeatureSettingsConfig>('feature_settings') || null;
  });

  ipcMain.handle('settings:set-features', async (_, config: FeatureSettingsConfig) => {
    await settingsRepo.set('feature_settings', config);
    return true;
  });
}
