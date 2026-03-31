import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegacyImportService } from '../legacy-import.service';
import { SettingsRepository, UserProfileRepository, DEFAULT_PROFILE } from '@baishou/database';

// 这里仅仅使用 vi.mock 进行最简单的单元测试
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));
vi.mock('@baishou/database');

describe('LegacyImportService', () => {
  let settingsRepo: vi.Mocked<SettingsRepository>;
  let profileRepo: vi.Mocked<UserProfileRepository>;
  let service: LegacyImportService;

  beforeEach(() => {
    settingsRepo = new SettingsRepository({} as any) as any;
    settingsRepo.set = vi.fn();
    settingsRepo.getAIProviderConfigs = vi.fn().mockResolvedValue([]);
    settingsRepo.setAIProviderConfigs = vi.fn();
    settingsRepo.getGlobalModelsConfig = vi.fn().mockResolvedValue({});
    settingsRepo.setGlobalModelsConfig = vi.fn();
    settingsRepo.getAgentBehaviorConfig = vi.fn().mockResolvedValue({});
    settingsRepo.setAgentBehaviorConfig = vi.fn();
    settingsRepo.getRagConfig = vi.fn().mockResolvedValue({});
    settingsRepo.setRagConfig = vi.fn();
    settingsRepo.getWebSearchConfig = vi.fn().mockResolvedValue({});
    settingsRepo.setWebSearchConfig = vi.fn();
    settingsRepo.getSummaryConfig = vi.fn().mockResolvedValue({ instructions: {} });
    settingsRepo.setSummaryConfig = vi.fn();
    settingsRepo.getToolManagementConfig = vi.fn().mockResolvedValue({ disabledToolIds: [], customConfigs: {} });
    settingsRepo.setToolManagementConfig = vi.fn();
    settingsRepo.getMcpServerConfig = vi.fn().mockResolvedValue({});
    settingsRepo.setMcpServerConfig = vi.fn();

    profileRepo = new UserProfileRepository({} as any) as any;
    profileRepo.getProfile = vi.fn().mockResolvedValue(JSON.parse(JSON.stringify(DEFAULT_PROFILE)));
    profileRepo.saveProfile = vi.fn();

    service = new LegacyImportService(settingsRepo as any, profileRepo as any);
  });

  it('should restore nickname and facts', async () => {
    const config = {
      nickname: '导入的名字',
      identity_facts: { '喜好': '测试跑通' }
    };
    await service.restoreConfig(config);
    
    expect(profileRepo.saveProfile).toHaveBeenCalled();
    const savedProfile = profileRepo.saveProfile.mock.calls[0][0];
    expect(savedProfile.nickname).toBe('导入的名字');
    expect(savedProfile.personas['默认身份卡'].facts['喜好']).toBe('测试跑通');
  });

  it('should restore legacy AI Provider API Keys', async () => {
    // 模拟非常旧的版本，只有全局配置没有数组
    settingsRepo.getAIProviderConfigs.mockResolvedValue([
      { id: 'openai', apiKey: '', baseUrl: '' } as any
    ]);
    const config = {
      ai_provider: 'openai',
      api_key: 'sk-legacy-test',
      ai_model: 'gpt-4'
    };

    await service.restoreConfig(config);
    const setList = settingsRepo.setAIProviderConfigs.mock.calls[0][0];
    expect(setList[0].apiKey).toBe('sk-legacy-test');
    expect(setList[0].defaultDialogueModel).toBe('gpt-4');
  });

  it('should map various primitive values cleanly', async () => {
    const config = {
       rag_global_enabled: false,
       rag_top_k: 80,
       web_search_engine: 'bing',
       mcp_server_enabled: true
    };
    
    await service.restoreConfig(config);
    expect(settingsRepo.setRagConfig.mock.calls[0][0].ragEnabled).toBe(false);
    expect(settingsRepo.setRagConfig.mock.calls[0][0].ragTopK).toBe(80);
    expect(settingsRepo.setWebSearchConfig.mock.calls[0][0].webSearchEngine).toBe('bing');
    expect(settingsRepo.setMcpServerConfig.mock.calls[0][0].mcpEnabled).toBe(true);
  });
});
