import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron'; 
import { SettingsRepository, UserProfileRepository } from '@baishou/database';
import { DEFAULT_PROFILE } from '@baishou/database';
import type {  
  AIProviderConfig, 
  GlobalModelsConfig, 
  AgentBehaviorConfig, 
  RagConfig, 
  WebSearchConfig, 
  SummaryConfig, 
  ToolManagementConfig, 
  McpServerConfig 
} from '@baishou/shared';
import { 
  DEFAULT_AI_PROVIDERS, 
  DEFAULT_GLOBAL_MODELS, 
  DEFAULT_AGENT_BEHAVIOR, 
  DEFAULT_RAG_CONFIG, 
  DEFAULT_WEB_SEARCH_CONFIG, 
  DEFAULT_SUMMARY_CONFIG, 
  DEFAULT_TOOL_MANAGEMENT_CONFIG, 
  DEFAULT_MCP_SERVER_CONFIG 
} from '@baishou/database';

/**
 * 原版配置的大规模兼容恢复服务
 * 负责解析从旧 Flutter 端导出的 JSON (通常是 SharedPreferences Map)
 * 并将所有旧有配置归整、落入当前系统对应的 8 大领域及 UserProfile 中。
 */
export class LegacyImportService {
  constructor(
    private readonly settingsRepo: SettingsRepository,
    private readonly profileRepo: UserProfileRepository
  ) {}

  /**
   * 恢复用户配置核心入口
   * @param configFromJson 反序列化后的旧 JSON 字典
   */
  async restoreConfig(config: Record<string, any>): Promise<void> {
    // ------------------------------------
    // 1. User Profile
    // ------------------------------------
    const profile = await this.profileRepo.getProfile();
    
    if (config['nickname'] && typeof config['nickname'] === 'string') {
      profile.nickname = config['nickname'];
    }

    if (config['identity_facts'] && typeof config['identity_facts'] === 'object') {
      const activePersona = profile.personas[profile.activePersonaId] || { id: profile.activePersonaId, facts: {} };
      profile.personas[profile.activePersonaId] = {
        ...activePersona,
        facts: { ...activePersona.facts, ...config['identity_facts'] }
      };
    }

    // 恢复头像
    if (config['avatar_base64']) {
      try {
        const ext = config['avatar_ext'] || 'jpg';
        const buffer = Buffer.from(config['avatar_base64'], 'base64');
        const userDataPath = app.getPath('userData');
        const avatarsDir = path.join(userDataPath, 'avatars');
        if (!existsSync(avatarsDir)) {
          await fs.mkdir(avatarsDir, { recursive: true });
        }
        const newPath = path.join(avatarsDir, `avatar_imported_${Date.now()}.${ext}`);
        await fs.writeFile(newPath, buffer);
        profile.avatarPath = newPath;
      } catch (e) {
        console.error('[LegacyImportService] Failed to extract avatar_base64', e);
      }
    }
    
    await this.profileRepo.saveProfile(profile);

    // ------------------------------------
    // 2. 通用主题 & 其它杂项设定 (存入全局通用设定表)
    // ------------------------------------
    if (config['seed_color'] !== undefined) {
      await this.settingsRepo.set('theme_seed_color', config['seed_color']);
    }
    if (config['theme_mode'] !== undefined) {
      const themeMap = ['system', 'light', 'dark'];
      await this.settingsRepo.set('theme_mode', themeMap[config['theme_mode']] || 'system');
    }

    // ------------------------------------
    // 3. 8 大 Config Domain 处理
    // ------------------------------------

    await this.restoreProviders(config);
    await this.restoreGlobalModels(config);
    await this.restoreAgentBehavior(config);
    await this.restoreRagAndTools(config);
    await this.restoreWebSearch(config);
    await this.restoreMcp(config);
    await this.restoreCloudSync(config);
  }

  private async restoreProviders(config: Record<string, any>) {
    let providers = await this.settingsRepo.getAIProviderConfigs();

    // v3 规范导入
    if (Array.isArray(config['ai_providers_list'])) {
      for (const pMap of config['ai_providers_list']) {
        const isExists = providers.find(p => p.id === pMap.id);
        if (isExists) {
          // 合并保留逻辑：如果当前应用端存在 Key/Url，而导入端为空，则保留当前应用端的
          const shouldKeepUrl = !pMap.baseUrl && isExists.baseUrl;
          const shouldKeepKey = !pMap.apiKey && isExists.apiKey;
          Object.assign(isExists, {
            ...pMap,
            baseUrl: shouldKeepUrl ? isExists.baseUrl : (pMap.baseUrl || ''),
            apiKey: shouldKeepKey ? isExists.apiKey : (pMap.apiKey || ''),
          });
        } else {
          providers.push({
             ...pMap,
             models: pMap.models || [],
             enabledModels: pMap.enabledModels || [],
             defaultDialogueModel: pMap.defaultDialogueModel || '',
             defaultNamingModel: pMap.defaultNamingModel || '',
             apiKey: pMap.apiKey || '',
             baseUrl: pMap.baseUrl || ''
          });
        }
      }
    } else {
      // 极古老版本的冗余单独 API Key 存储向下兼容
      const activeId = config['ai_provider'];
      if (!activeId) {
        if (config['gemini_api_key']) {
          const gemini = providers.find(p => p.id === 'gemini');
          if (gemini) {
            gemini.apiKey = config['gemini_api_key'];
            gemini.baseUrl = config['gemini_base_url'] || gemini.baseUrl;
          }
        }
        if (config['openai_api_key']) {
          const openai = providers.find(p => p.id === 'openai');
          if (openai) {
             openai.apiKey = config['openai_api_key'];
             openai.baseUrl = config['openai_base_url'] || openai.baseUrl;
          }
        }
      } else {
        const provider = providers.find(p => p.id === activeId);
        if (provider) {
          provider.apiKey = config['api_key'] || provider.apiKey;
          provider.baseUrl = config['base_url'] || provider.baseUrl;
          provider.defaultDialogueModel = config['ai_model'] || provider.defaultDialogueModel;
          provider.defaultNamingModel = config['ai_naming_model'] || provider.defaultNamingModel;
        }
      }
    }
    await this.settingsRepo.setAIProviderConfigs(providers);
  }

  private async restoreGlobalModels(config: Record<string, any>) {
    let globalModels = await this.settingsRepo.getGlobalModelsConfig();
    
    if (config['global_dialogue_provider_id']) {
      globalModels.globalDialogueProviderId = config['global_dialogue_provider_id'];
      globalModels.globalDialogueModelId = config['global_dialogue_model_id'] || '';
    }
    if (config['global_naming_provider_id']) {
      globalModels.globalNamingProviderId = config['global_naming_provider_id'];
      globalModels.globalNamingModelId = config['global_naming_model_id'] || '';
    }
    if (config['global_summary_provider_id']) {
      globalModels.globalSummaryProviderId = config['global_summary_provider_id'];
      globalModels.globalSummaryModelId = config['global_summary_model_id'] || '';
    }
    if (config['global_embedding_provider_id']) {
      globalModels.globalEmbeddingProviderId = config['global_embedding_provider_id'];
      globalModels.globalEmbeddingModelId = config['global_embedding_model_id'] || '';
    }
    if (config['global_embedding_dimension'] !== undefined) {
      (globalModels as any).globalEmbeddingDimension = config['global_embedding_dimension'];
    }
    if (config['monthly_summary_source']) {
      globalModels.monthlySummarySource = config['monthly_summary_source'];
    }
    
    await this.settingsRepo.setGlobalModelsConfig(globalModels);
  }

  private async restoreAgentBehavior(config: Record<string, any>) {
    let behavior = await this.settingsRepo.getAgentBehaviorConfig();
    if (config['agent_context_window_size'] !== undefined) behavior.agentContextWindowSize = config['agent_context_window_size'];
    if (config['companion_compress_tokens'] !== undefined) behavior.companionCompressTokens = config['companion_compress_tokens'];
    if (config['companion_truncate_tokens'] !== undefined) behavior.companionTruncateTokens = config['companion_truncate_tokens'];
    if (config['agent_persona']) behavior.agentPersona = config['agent_persona'];
    if (config['agent_guidelines']) behavior.agentGuidelines = config['agent_guidelines'];
    
    await this.settingsRepo.setAgentBehaviorConfig(behavior);
  }

  private async restoreRagAndTools(config: Record<string, any>) {
    let rag = await this.settingsRepo.getRagConfig();
    let tools = await this.settingsRepo.getToolManagementConfig();
    let summary = await this.settingsRepo.getSummaryConfig();

    if (config['rag_global_enabled'] !== undefined) rag.ragEnabled = config['rag_global_enabled'];
    if (config['rag_top_k'] !== undefined) rag.ragTopK = config['rag_top_k'];
    if (config['rag_similarity_threshold'] !== undefined) rag.ragSimilarityThreshold = config['rag_similarity_threshold'];
    
    if (Array.isArray(config['disabled_tool_ids'])) {
      tools.disabledToolIds = config['disabled_tool_ids'];
    }
    if (config['all_tool_configs']) {
      tools.customConfigs = { ...tools.customConfigs, ...config['all_tool_configs'] };
    }

    if (config['summary_prompt_instructions'] && !config['all_summary_instructions']) {
      summary.instructions['legacy'] = config['summary_prompt_instructions'];
    } else if (config['all_summary_instructions']) {
      summary.instructions = { ...summary.instructions, ...config['all_summary_instructions'] };
    }

    await this.settingsRepo.setRagConfig(rag);
    await this.settingsRepo.setToolManagementConfig(tools);
    await this.settingsRepo.setSummaryConfig(summary);
  }

  private async restoreWebSearch(config: Record<string, any>) {
    let web = await this.settingsRepo.getWebSearchConfig();
    if (config['web_search_engine']) web.webSearchEngine = config['web_search_engine'];
    if (config['web_search_max_results'] !== undefined) web.webSearchMaxResults = config['web_search_max_results'];
    if (config['web_search_rag_enabled'] !== undefined) web.webSearchRagEnabled = config['web_search_rag_enabled'];
    if (config['tavily_api_key']) web.tavilyApiKey = config['tavily_api_key'];
    if (config['web_search_rag_max_chunks'] !== undefined) web.webSearchRagMaxChunks = config['web_search_rag_max_chunks'];
    if (config['web_search_rag_chunks_per_source'] !== undefined) web.webSearchRagChunksPerSource = config['web_search_rag_chunks_per_source'];
    if (config['web_search_plain_snippet_length'] !== undefined) web.webSearchPlainSnippetLength = config['web_search_plain_snippet_length'];
    
    await this.settingsRepo.setWebSearchConfig(web);
  }

  private async restoreMcp(config: Record<string, any>) {
    let mcp = await this.settingsRepo.getMcpServerConfig();
    if (config['mcp_server_enabled'] !== undefined) mcp.mcpEnabled = config['mcp_server_enabled'];
    if (config['mcp_server_port'] !== undefined) mcp.mcpPort = config['mcp_server_port'];
    await this.settingsRepo.setMcpServerConfig(mcp);
  }

  /**
   * 恢复云同步配置（WebDAV / S3）
   * 旧版将 sync_target / webdav_* / s3_* 平铺在顶层，
   * Next 版统一收纳到 cloud_sync_config settings key 中。
   */
  private async restoreCloudSync(config: Record<string, any>) {
    const syncTargetMap = ['local', 's3', 'webdav'];
    const hasAnySyncField =
      config['sync_target'] !== undefined ||
      config['webdav_url'] ||
      config['s3_endpoint'];

    if (!hasAnySyncField) return;

    const cloudSync: Record<string, any> = {
      target: syncTargetMap[config['sync_target']] || 'local',
      webdavUrl: config['webdav_url'] || '',
      webdavUsername: config['webdav_username'] || '',
      webdavPassword: config['webdav_password'] || '',
      webdavPath: config['webdav_path'] || '/baishou_backup',
      s3Endpoint: config['s3_endpoint'] || '',
      s3AccessKey: config['s3_access_key'] || '',
      s3SecretKey: config['s3_secret_key'] || '',
      s3Bucket: config['s3_bucket'] || '',
      s3Region: config['s3_region'] || '',
      s3Path: config['s3_path'] || '/baishou_backup',
      maxBackupCount: 5,
    };

    await this.settingsRepo.set('cloud_sync_config', cloudSync);
  }
}
