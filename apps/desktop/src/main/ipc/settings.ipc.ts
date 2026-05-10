import { ipcMain } from 'electron';
import { SettingsRepository } from '@baishou/database';
import { SettingsFileService, SettingsManagerService } from '@baishou/core';
import { getAppDb } from '../db';
import { pathService } from './vault.ipc';
import { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared';

let _settingsManager: SettingsManagerService | null = null;
export const settingsManager = new Proxy({} as SettingsManagerService, {
  get(target, prop) {
    if (!_settingsManager) {
      const settingsRepo = new SettingsRepository(getAppDb());
      const settingsFileService = new SettingsFileService(pathService);
      _settingsManager = new SettingsManagerService(settingsRepo, settingsFileService);
    }
    const value = Reflect.get(_settingsManager, prop);
    // Bind functions to the actual instance to avoid 'this' context loss
    return typeof value === 'function' ? value.bind(_settingsManager) : value;
  }
});

import type { HotkeyService } from '../services/hotkey.service';
let currentHotkeyService: HotkeyService | null = null;
export function setHotkeyService(service: HotkeyService) {
  currentHotkeyService = service;
}

export function registerSettingsIPC() {
  const knownSystemIds = ['openai', 'anthropic', 'gemini', 'deepseek', 'kimi', 'ollama', 'siliconflow', 'openrouter', 'dashscope', 'doubao', 'grok', 'mistral', 'lmstudio'];

  const getAutoFixedProviders = async () => {
    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    let needsSave = false;
    
    for (const p of providers) {
      const lowerId = p.id.toLowerCase();
      // Even if somewhat marked as isSystem: false, if ID matches fundamentally core providers, fix its type
      if (knownSystemIds.includes(lowerId)) {
        if (p.type === 'custom' || !p.type || p.type !== lowerId) {
          p.type = lowerId as any;
          p.isSystem = true; // Repair isSystem just in case
          needsSave = true;
        }
      }
    }

    if (needsSave) {
      await settingsManager.set('ai_providers', providers);
    }
    return providers;
  };

  ipcMain.handle('settings:get-providers', async () => {
    return await getAutoFixedProviders();
  });

  const pruneGlobalModels = async (providers: AIProviderConfig[]) => {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
    if (!globalModels) return;

    let changed = false;
    const isValid = (pId: string, mId: string) => {
        if (!pId || !mId) return true;
        const prov = providers.find(p => p.id === pId && p.isEnabled);
        if (!prov) return false;
        if (prov.enabledModels && !prov.enabledModels.includes(mId)) return false;
        return true;
    };

    if (!isValid(globalModels.globalDialogueProviderId, globalModels.globalDialogueModelId)) {
        globalModels.globalDialogueProviderId = '';
        globalModels.globalDialogueModelId = '';
        changed = true;
    }
    if (!isValid(globalModels.globalNamingProviderId, globalModels.globalNamingModelId)) {
        globalModels.globalNamingProviderId = '';
        globalModels.globalNamingModelId = '';
        changed = true;
    }
    if (!isValid(globalModels.globalSummaryProviderId, globalModels.globalSummaryModelId)) {
        globalModels.globalSummaryProviderId = '';
        globalModels.globalSummaryModelId = '';
        changed = true;
    }
    if (!isValid(globalModels.globalEmbeddingProviderId, globalModels.globalEmbeddingModelId)) {
        globalModels.globalEmbeddingProviderId = '';
        globalModels.globalEmbeddingModelId = '';
        changed = true;
    }
    if (!isValid(globalModels.globalTtsProviderId, globalModels.globalTtsModelId)) {
        globalModels.globalTtsProviderId = '';
        globalModels.globalTtsModelId = '';
        changed = true;
    }

    if (changed) {
        await settingsManager.set('global_models', globalModels);
    }
  };

  ipcMain.handle('settings:set-providers', async (_, providers: AIProviderConfig[]) => {
    await settingsManager.set('ai_providers', providers);
    await pruneGlobalModels(providers);
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
    return await settingsManager.get<Record<string, any>>('feature_settings') || null;
  });

  ipcMain.handle('settings:set-features', async (_, config: Record<string, any>) => {
    await settingsManager.set('feature_settings', config);
    return true;
  });

  ipcMain.handle('settings:get-agent-behavior-config', async () => {
    return await settingsManager.get<any>('agent_behavior') || null;
  });

  ipcMain.handle('settings:set-agent-behavior-config', async (_, config: any) => {
    await settingsManager.set('agent_behavior', config);
    return true;
  });

  ipcMain.handle('settings:get-rag-config', async () => {
    return await settingsManager.get<any>('rag_config') || null;
  });

  ipcMain.handle('settings:set-rag-config', async (_, config: any) => {
    await settingsManager.set('rag_config', config);
    return true;
  });

  ipcMain.handle('settings:get-web-search-config', async () => {
    return await settingsManager.get<any>('web_search_config') || null;
  });

  ipcMain.handle('settings:set-web-search-config', async (_, config: any) => {
    await settingsManager.set('web_search_config', config);
    return true;
  });

  ipcMain.handle('settings:get-summary-config', async () => {
    return await settingsManager.get<any>('summary_config') || null;
  });

  ipcMain.handle('settings:set-summary-config', async (_, config: any) => {
    await settingsManager.set('summary_config', config);
    return true;
  });

  ipcMain.handle('settings:get-tool-management-config', async () => {
    return await settingsManager.get<any>('tool_management_config') || null;
  });

  ipcMain.handle('settings:set-tool-management-config', async (_, config: any) => {
    await settingsManager.set('tool_management_config', config);
    return true;
  });

  ipcMain.handle('settings:get-search-mode-enabled', async () => {
    return await settingsManager.get<boolean>('search_mode_enabled') || false;
  });

  ipcMain.handle('settings:set-search-mode-enabled', async (_, enabled: boolean) => {
    await settingsManager.set('search_mode_enabled', enabled);
    return true;
  });

  ipcMain.handle('settings:get-mcp-server-config', async () => {
    return await settingsManager.get<any>('mcp_server_config') || null;
  });

  ipcMain.handle('settings:set-mcp-server-config', async (_, config: any) => {
    await settingsManager.set('mcp_server_config', config);
    return true;
  });

  ipcMain.handle('settings:get-hotkey-config', async () => {
    return await settingsManager.get<any>('hotkey_config') || null;
  });

  ipcMain.handle('settings:set-hotkey-config', async (_, config: any) => {
    await settingsManager.set('hotkey_config', config);
    if (currentHotkeyService) {
      currentHotkeyService.update(config);
    }
    return true;
  });
  ipcMain.handle('settings:get-cloud-sync-config', async () => {
    return await settingsManager.get<any>('cloud_sync_config') || null;
  });

  ipcMain.handle('settings:set-cloud-sync-config', async (_, config: any) => {
    await settingsManager.set('cloud_sync_config', config);
    return true;
  });



  ipcMain.handle('settings:add-custom-provider', async (_, input: Partial<AIProviderConfig>) => {
    const providers = await getAutoFixedProviders();
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
    const providers = await getAutoFixedProviders();
    const idx = providers.findIndex(p => p.id === providerId);
    if (idx < 0) throw new Error('Provider not found');
    if (providers[idx].isSystem) throw new Error('Cannot delete system provider');
    providers.splice(idx, 1);
    await settingsManager.set('ai_providers', providers);
    await pruneGlobalModels(providers);
    return true;
  });

  ipcMain.handle('settings:reorder-providers', async (_, orderedIds: string[]) => {
    const providers = await getAutoFixedProviders();
    
    orderedIds.forEach((id, index) => {
      const p = providers.find(pp => pp.id === id);
      if (p) {
        p.sortOrder = index;
      } else {
        // If sorting a default system provider never modified before, inject it completely
        providers.push({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          type: id as any,
          isSystem: true,
          isEnabled: false,
          sortOrder: index,
          apiKey: '',
          baseUrl: '',
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: ''
        } as AIProviderConfig);
      }
    });

    await settingsManager.set('ai_providers', providers);
    return true;
  });

  ipcMain.handle('settings:test-connection', async (_, providerId: string, tempKey?: string, tempUrl?: string, testModelId?: string) => {
    const providers = await getAutoFixedProviders();
    let config = providers.find(p => p.id === providerId);
    if (!config) {
        config = {
            id: providerId,
            type: providerId as any,
            name: providerId.toUpperCase(),
            apiKey: '',
            baseUrl: '',
            isSystem: true,
            isEnabled: false,
            models: [],
            enabledModels: [],
            defaultDialogueModel: '',
            defaultNamingModel: '',
            sortOrder: 999
        } as AIProviderConfig;
    }
    
    const clone = { ...config } as AIProviderConfig;
    if (tempKey !== undefined) clone.apiKey = tempKey;
    if (tempUrl !== undefined) clone.baseUrl = tempUrl;

    // @ts-ignore
    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry');
    const registry = AIProviderRegistry.getInstance();
    const provider = registry.createProviderInstance(clone);
    if (!provider) throw new Error('Provider instance creation failed');
    await provider.testConnection(testModelId);
    return { success: true };
  });

  ipcMain.handle('settings:fetch-models', async (_, providerId: string, tempKey?: string, tempUrl?: string) => {
    const providers = await getAutoFixedProviders();
    let config = providers.find(p => p.id === providerId);
    if (!config) {
        config = {
            id: providerId,
            type: providerId as any,
            name: providerId.toUpperCase(),
            apiKey: '',
            baseUrl: '',
            isSystem: true,
            isEnabled: false,
            models: [],
            enabledModels: [],
            defaultDialogueModel: '',
            defaultNamingModel: '',
            sortOrder: 999
        } as AIProviderConfig;
    }
    
    const clone = { ...config } as AIProviderConfig;
    if (tempKey !== undefined) clone.apiKey = tempKey;
    if (tempUrl !== undefined) clone.baseUrl = tempUrl;

    // @ts-ignore
    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry');
    const registry = AIProviderRegistry.getInstance();
    const provider = registry.createProviderInstance(clone);
    if (!provider) throw new Error('Provider instance creation failed');
    
    const models = await provider.fetchAvailableModels();
    return models;
  });

  ipcMain.handle('settings:get-all-available-models', async () => {
    const providers = await getAutoFixedProviders();
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
