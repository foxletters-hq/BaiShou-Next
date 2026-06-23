import type { SettingsRepository, UserProfileRepository } from '@baishou/database'

export interface LegacyConfigRestoreOptions {
  /** 处理 ZIP 内嵌的 avatar_base64 字段，返回写入后的绝对路径 */
  importAvatarBase64?: (base64: string, ext: string) => Promise<string | null>
  /** 选择性迁移：身份卡/头像由独立板块处理时不改写 profile */
  skipProfileFields?: boolean
  /** 为 true 时跳过云同步凭据恢复，保留当前 Next 版 cloud_sync_config */
  preserveCloudSync?: boolean
}

/**
 * 将 Flutter 导出的 device_preferences 形状恢复进 Next 设置库（平台无关）。
 */
export async function restoreLegacyDevicePreferences(
  settingsRepo: SettingsRepository,
  profileRepo: UserProfileRepository,
  config: Record<string, unknown>,
  options?: LegacyConfigRestoreOptions
): Promise<void> {
  if (!options?.skipProfileFields) {
    const profile = await profileRepo.getProfile()

    if (config['nickname'] && typeof config['nickname'] === 'string') {
      profile.nickname = config['nickname']
    }

    if (config['identity_facts'] && typeof config['identity_facts'] === 'object') {
      const activePersona = profile.personas[profile.activePersonaId] || {
        id: profile.activePersonaId,
        facts: {}
      }
      profile.personas[profile.activePersonaId] = {
        ...activePersona,
        facts: {
          ...activePersona.facts,
          ...(config['identity_facts'] as Record<string, string>)
        }
      }
    }

    if (config['avatar_base64'] && typeof config['avatar_base64'] === 'string') {
      try {
        const ext = (config['avatar_ext'] as string) || 'jpg'
        const newPath = await options?.importAvatarBase64?.(config['avatar_base64'], ext)
        if (newPath) {
          profile.avatarPath = newPath
        }
      } catch {
        // avatar restore failure should not abort migration
      }
    }

    await profileRepo.saveProfile(profile)
  }

  if (config['seed_color'] !== undefined) {
    await settingsRepo.set('theme_seed_color', config['seed_color'])
  }
  if (config['theme_mode'] !== undefined) {
    const themeMap = ['system', 'light', 'dark']
    await settingsRepo.set('theme_mode', themeMap[config['theme_mode'] as number] || 'system')
  }

  await restoreProviders(settingsRepo, config)
  await restoreGlobalModels(settingsRepo, config)
  await restoreAgentBehavior(settingsRepo, config)
  await restoreRagAndTools(settingsRepo, config)
  await restoreWebSearch(settingsRepo, config)
  await restoreMcp(settingsRepo, config)
  if (!options?.preserveCloudSync) {
    await restoreCloudSync(settingsRepo, config)
  }
}

async function restoreProviders(settingsRepo: SettingsRepository, config: Record<string, unknown>) {
  let providers = await settingsRepo.getAIProviderConfigs()

  if (Array.isArray(config['ai_providers_list'])) {
    for (const pMap of config['ai_providers_list'] as Record<string, unknown>[]) {
      const isExists = providers.find((p) => p.id === pMap.id)
      if (isExists) {
        const shouldKeepUrl = !pMap.baseUrl && isExists.baseUrl
        const shouldKeepKey = !pMap.apiKey && isExists.apiKey
        Object.assign(isExists, {
          ...pMap,
          baseUrl: shouldKeepUrl ? isExists.baseUrl : (pMap.baseUrl as string) || '',
          apiKey: shouldKeepKey ? isExists.apiKey : (pMap.apiKey as string) || ''
        })
      } else {
        providers.push({
          ...pMap,
          models: (pMap.models as unknown[]) || [],
          enabledModels: (pMap.enabledModels as unknown[]) || [],
          defaultDialogueModel: (pMap.defaultDialogueModel as string) || '',
          defaultNamingModel: (pMap.defaultNamingModel as string) || '',
          apiKey: (pMap.apiKey as string) || '',
          baseUrl: (pMap.baseUrl as string) || ''
        } as (typeof providers)[number])
      }
    }
  } else {
    const activeId = config['ai_provider'] as string | undefined
    if (!activeId) {
      if (config['gemini_api_key']) {
        const gemini = providers.find((p) => p.id === 'gemini')
        if (gemini) {
          gemini.apiKey = config['gemini_api_key'] as string
          gemini.baseUrl = (config['gemini_base_url'] as string) || gemini.baseUrl
        }
      }
      if (config['openai_api_key']) {
        const openai = providers.find((p) => p.id === 'openai')
        if (openai) {
          openai.apiKey = config['openai_api_key'] as string
          openai.baseUrl = (config['openai_base_url'] as string) || openai.baseUrl
        }
      }
    } else {
      const provider = providers.find((p) => p.id === activeId)
      if (provider) {
        provider.apiKey = (config['api_key'] as string) || provider.apiKey
        provider.baseUrl = (config['base_url'] as string) || provider.baseUrl
        provider.defaultDialogueModel =
          (config['ai_model'] as string) || provider.defaultDialogueModel
        provider.defaultNamingModel =
          (config['ai_naming_model'] as string) || provider.defaultNamingModel
      }
    }
  }
  await settingsRepo.setAIProviderConfigs(providers)
}

async function restoreGlobalModels(
  settingsRepo: SettingsRepository,
  config: Record<string, unknown>
) {
  const globalModels = await settingsRepo.getGlobalModelsConfig()

  if (config['global_dialogue_provider_id']) {
    globalModels.globalDialogueProviderId = config['global_dialogue_provider_id'] as string
    globalModels.globalDialogueModelId = (config['global_dialogue_model_id'] as string) || ''
  }
  if (config['global_naming_provider_id']) {
    globalModels.globalNamingProviderId = config['global_naming_provider_id'] as string
    globalModels.globalNamingModelId = (config['global_naming_model_id'] as string) || ''
  }
  if (config['global_summary_provider_id']) {
    globalModels.globalSummaryProviderId = config['global_summary_provider_id'] as string
    globalModels.globalSummaryModelId = (config['global_summary_model_id'] as string) || ''
  }
  if (config['global_embedding_provider_id']) {
    globalModels.globalEmbeddingProviderId = config['global_embedding_provider_id'] as string
    globalModels.globalEmbeddingModelId = (config['global_embedding_model_id'] as string) || ''
  }
  if (config['global_embedding_dimension'] !== undefined) {
    ;(globalModels as unknown as Record<string, unknown>).globalEmbeddingDimension =
      config['global_embedding_dimension']
  }
  if (config['monthly_summary_source']) {
    globalModels.monthlySummarySource = config[
      'monthly_summary_source'
    ] as typeof globalModels.monthlySummarySource
  }

  await settingsRepo.setGlobalModelsConfig(globalModels)
}

async function restoreAgentBehavior(
  settingsRepo: SettingsRepository,
  config: Record<string, unknown>
) {
  const behavior = await settingsRepo.getAgentBehaviorConfig()
  if (config['agent_context_window_size'] !== undefined) {
    behavior.agentContextWindowSize = config['agent_context_window_size'] as number
  }
  if (config['agent_persona']) behavior.agentPersona = config['agent_persona'] as string
  if (config['agent_guidelines']) behavior.agentGuidelines = config['agent_guidelines'] as string
  await settingsRepo.setAgentBehaviorConfig(behavior)
}

async function restoreRagAndTools(
  settingsRepo: SettingsRepository,
  config: Record<string, unknown>
) {
  const rag = await settingsRepo.getRagConfig()
  const tools = await settingsRepo.getToolManagementConfig()
  const summary = await settingsRepo.getSummaryConfig()

  if (config['rag_global_enabled'] !== undefined)
    rag.ragEnabled = config['rag_global_enabled'] as boolean
  if (config['rag_top_k'] !== undefined) rag.ragTopK = config['rag_top_k'] as number
  if (config['rag_similarity_threshold'] !== undefined) {
    rag.ragSimilarityThreshold = config['rag_similarity_threshold'] as number
  }

  if (Array.isArray(config['disabled_tool_ids'])) {
    tools.disabledToolIds = config['disabled_tool_ids'] as string[]
  }
  if (config['all_tool_configs']) {
    tools.customConfigs = {
      ...tools.customConfigs,
      ...(config['all_tool_configs'] as Record<string, Record<string, unknown>>)
    }
  }

  if (!summary.instructions) summary.instructions = {}
  if (config['summary_prompt_instructions'] && !config['all_summary_instructions']) {
    ;(summary.instructions as Record<string, string>)['legacy'] = config[
      'summary_prompt_instructions'
    ] as string
  } else if (config['all_summary_instructions']) {
    summary.instructions = {
      ...summary.instructions,
      ...(config['all_summary_instructions'] as Record<string, string>)
    }
  }

  await settingsRepo.setRagConfig(rag)
  await settingsRepo.setToolManagementConfig(tools)
  await settingsRepo.setSummaryConfig(summary)
}

async function restoreWebSearch(settingsRepo: SettingsRepository, config: Record<string, unknown>) {
  const web = await settingsRepo.getWebSearchConfig()
  if (config['web_search_engine']) web.webSearchEngine = config['web_search_engine'] as string
  if (config['web_search_max_results'] !== undefined) {
    web.webSearchMaxResults = config['web_search_max_results'] as number
  }
  if (config['web_search_rag_enabled'] !== undefined) {
    web.webSearchRagEnabled = config['web_search_rag_enabled'] as boolean
  }
  if (config['tavily_api_key']) web.tavilyApiKey = config['tavily_api_key'] as string
  if (config['exa_api_key']) web.exaApiKey = config['exa_api_key'] as string
  if (config['anysearch_api_key']) web.anysearchApiKey = config['anysearch_api_key'] as string
  if (config['web_search_rag_max_chunks'] !== undefined) {
    web.webSearchRagMaxChunks = config['web_search_rag_max_chunks'] as number
  }
  if (config['web_search_rag_chunks_per_source'] !== undefined) {
    web.webSearchRagChunksPerSource = config['web_search_rag_chunks_per_source'] as number
  }
  if (config['web_search_plain_snippet_length'] !== undefined) {
    web.webSearchPlainSnippetLength = config['web_search_plain_snippet_length'] as number
  }
  await settingsRepo.setWebSearchConfig(web)
}

async function restoreMcp(settingsRepo: SettingsRepository, config: Record<string, unknown>) {
  const mcp = await settingsRepo.getMcpServerConfig()
  if (config['mcp_server_enabled'] !== undefined)
    mcp.mcpEnabled = config['mcp_server_enabled'] as boolean
  if (config['mcp_server_port'] !== undefined) mcp.mcpPort = config['mcp_server_port'] as number
  await settingsRepo.setMcpServerConfig(mcp)
}

async function restoreCloudSync(settingsRepo: SettingsRepository, config: Record<string, unknown>) {
  const syncTargetMap = ['local', 's3', 'webdav']
  const hasAnySyncField =
    config['sync_target'] !== undefined || config['webdav_url'] || config['s3_endpoint']
  if (!hasAnySyncField) return

  const cloudSync: Record<string, unknown> = {
    target: syncTargetMap[config['sync_target'] as number] || 'local',
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
    maxSnapshotCount: 5
  }

  await settingsRepo.set('cloud_sync_config', cloudSync)
}
