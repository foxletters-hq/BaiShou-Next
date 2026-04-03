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

  ipcMain.handle('settings:fetch-models', async (_, providerId: string) => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    const config = providers.find((p: any) => p.id === providerId);
    if (!config) throw new Error(`Provider ${providerId} not found`);
    
    // @ts-ignore
    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry');
    const registry = AIProviderRegistry.getInstance();
    if (!registry.hasProvider(config.id)) {
        registry.registerProvider(registry.createProviderInstance(config));
    }
    const providerInstance = registry.getProvider(config.id);
    return await providerInstance.fetchAvailableModels();
  });

  ipcMain.handle('settings:add-custom-provider', async (_, input: Partial<AIProviderConfig>) => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    const maxSort = providers.reduce((max, p) => Math.max(max, p.sortOrder || 0), 0);
    const newProvider: AIProviderConfig = {
      id: `custom_${Date.now()}`,
      name: input.name || 'Custom Provider',
      type: input.type || 'openai',
      baseUrl: input.baseUrl || '',
      apiKey: input.apiKey || '',
      isSystem: false,
      isEnabled: true,
      sortOrder: maxSort + 1,
      enabledModels: [],
      ...input
    } as any;
    providers.push(newProvider);
    await settingsManager.set('ai_providers', providers);
    return newProvider;
  });

  ipcMain.handle('settings:delete-provider', async (_, providerId: string) => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    const idx = providers.findIndex(p => p.id === providerId);
    if (idx < 0) throw new Error('Provider not found');
    if (providers[idx].isSystem) throw new Error('Cannot delete system provider');
    providers.splice(idx, 1);
    await settingsManager.set('ai_providers', providers);
    return true;
  });

  ipcMain.handle('settings:reorder-providers', async (_, orderedIds: string[]) => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    orderedIds.forEach((id, index) => {
      const p = providers.find(pp => pp.id === id);
      if (p) p.sortOrder = index;
    });
    await settingsManager.set('ai_providers', providers);
    return true;
  });

  ipcMain.handle('settings:test-connection', async (_, providerId: string) => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    const config = providers.find(p => p.id === providerId);
    if (!config) throw new Error('Provider not found');
    
    // @ts-ignore
    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry');
    const registry = AIProviderRegistry.getInstance();
    if (!registry.hasProvider(config.id)) {
        registry.registerProvider(registry.createProviderInstance(config));
    }
    const provider = registry.getProvider(config.id);
    await provider.testConnection();
    return { success: true };
  });

  ipcMain.handle('settings:get-all-available-models', async () => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    return providers
      .filter((p: any) => p.isEnabled || p.isActive)
      .map((p: any) => ({
        providerId: p.id,
        providerName: p.name,
        models: p.enabledModels || p.models || []
      }));
  });

  ipcMain.handle('settings:get-tool-config-value', async (_, key: string) => {
    const toolConfigs = await settingsManager.get<Record<string, unknown>>('tool_configs') || {};
    return toolConfigs[key];
  });

  ipcMain.handle('settings:set-tool-config-value', async (_, key: string, value: unknown) => {
    const toolConfigs = await settingsManager.get<Record<string, unknown>>('tool_configs') || {};
    toolConfigs[key] = value;
    await settingsManager.set('tool_configs', toolConfigs);
    return true;
  });
}
