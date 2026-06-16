function stripFlutterKeyPrefix(key: string): string {
  return key.startsWith('flutter.') ? key.slice('flutter.'.length) : key
}

function parseJsonValue<T>(value: unknown): T | undefined {
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

/** 解析 Flutter Linux/macOS/Windows 的 shared_preferences.json */
export function parseFlutterSharedPreferencesJson(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed)) {
    normalized[stripFlutterKeyPrefix(key)] = value
  }
  return normalized
}

/** 解析 Flutter Android 的 FlutterSharedPreferences.xml（仅覆盖迁移所需类型） */
export function parseFlutterSharedPreferencesXml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  const stringPattern = /<string name="([^"]+)">([\s\S]*?)<\/string>/g
  let match: RegExpExecArray | null
  while ((match = stringPattern.exec(raw)) !== null) {
    const key = stripFlutterKeyPrefix(match[1]!)
    result[key] = match[2]!
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#10;/g, '\n')
  }

  const intPattern = /<int name="([^"]+)" value="(-?\d+)"\s*\/>/g
  while ((match = intPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = Number(match[2])
  }

  const longPattern = /<long name="([^"]+)" value="(-?\d+)"\s*\/>/g
  while ((match = longPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = Number(match[2])
  }

  const floatPattern = /<float name="([^"]+)" value="([^"]+)"\s*\/>/g
  while ((match = floatPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = Number(match[2])
  }

  const boolPattern = /<boolean name="([^"]+)" value="(true|false)"\s*\/>/g
  while ((match = boolPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = match[2] === 'true'
  }

  return result
}

/** 解析 Flutter iOS 的 UserDefaults plist（flutter.* 键） */
export function parseFlutterSharedPreferencesPlist(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  const stringPattern = /<key>([^<]+)<\/key>\s*<string>([\s\S]*?)<\/string>/g
  let match: RegExpExecArray | null
  while ((match = stringPattern.exec(raw)) !== null) {
    const key = stripFlutterKeyPrefix(match[1]!)
    result[key] = match[2]!
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
  }

  const intPattern = /<key>([^<]+)<\/key>\s*<integer>(-?\d+)<\/integer>/g
  while ((match = intPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = Number(match[2])
  }

  const realPattern = /<key>([^<]+)<\/key>\s*<real>([^<]+)<\/real>/g
  while ((match = realPattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = Number(match[2])
  }

  const truePattern = /<key>([^<]+)<\/key>\s*<true\s*\/>/g
  while ((match = truePattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = true
  }

  const falsePattern = /<key>([^<]+)<\/key>\s*<false\s*\/>/g
  while ((match = falsePattern.exec(raw)) !== null) {
    result[stripFlutterKeyPrefix(match[1]!)] = false
  }

  return result
}

function collectToolConfigs(sp: Record<string, unknown>): Record<string, unknown> {
  const configs: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith('tool_config_')) continue
    const toolId = key.slice('tool_config_'.length)
    configs[toolId] = parseJsonValue(value) ?? value
  }
  return configs
}

function collectSummaryInstructions(sp: Record<string, unknown>): Record<string, string> {
  const instructions: Record<string, string> = {}
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith('summary_prompt_instructions_')) continue
    if (typeof value === 'string' && value.trim()) {
      instructions[key.slice('summary_prompt_instructions_'.length)] = value
    }
  }
  const legacy = sp['summary_prompt_instructions']
  if (typeof legacy === 'string' && legacy.trim()) {
    instructions['legacy'] = legacy
  }
  return instructions
}

function resolveIdentityFacts(sp: Record<string, unknown>): Record<string, string> | undefined {
  const personasRaw = sp['user_personas']
  const activeId = sp['user_active_persona_id']
  if (typeof personasRaw === 'string') {
    const personas = parseJsonValue<Record<string, Record<string, string>>>(personasRaw)
    if (personas) {
      if (typeof activeId === 'string' && personas[activeId]) return personas[activeId]
      const first = Object.values(personas)[0]
      if (first) return first
    }
  }

  const legacy = sp['user_identity_facts']
  if (typeof legacy === 'string') {
    return parseJsonValue<Record<string, string>>(legacy)
  }
  return undefined
}

/**
 * 将 Flutter SharedPreferences 原始键值映射为 device_preferences.json 形状，
 * 与 Flutter DataArchiveManager._gatherDevicePreferences 对齐。
 */
export function assembleDevicePreferencesFromFlutterSp(
  sp: Record<string, unknown>
): Record<string, unknown> {
  const aiProvidersList = parseJsonValue<unknown[]>(sp['ai_providers_list'])
  const disabledToolIds = parseJsonValue<string[]>(sp['disabled_tool_ids'])
  const allToolConfigs = collectToolConfigs(sp)
  const allSummaryInstructions = collectSummaryInstructions(sp)
  const identityFacts = resolveIdentityFacts(sp)

  const config: Record<string, unknown> = {
    nickname: sp['user_nickname'],
    identity_facts: identityFacts,
    theme_mode: sp['theme_mode'],
    seed_color: sp['theme_seed_color'],
    ai_providers_list: aiProvidersList,
    global_dialogue_provider_id: sp['global_dialogue_provider_id'],
    global_dialogue_model_id: sp['global_dialogue_model_id'],
    global_naming_provider_id: sp['global_naming_provider_id'],
    global_naming_model_id: sp['global_naming_model_id'],
    global_summary_provider_id: sp['global_summary_provider_id'],
    global_summary_model_id: sp['global_summary_model_id'],
    ai_provider: sp['active_ai_provider_id'],
    sync_target: sp['sync_target'],
    webdav_url: sp['webdav_url'],
    webdav_username: sp['webdav_username'],
    webdav_password: sp['webdav_password'],
    webdav_path: sp['webdav_path'],
    s3_endpoint: sp['s3_endpoint'],
    s3_access_key: sp['s3_access_key'],
    s3_secret_key: sp['s3_secret_key'],
    s3_bucket: sp['s3_bucket'],
    s3_region: sp['s3_region'],
    s3_path: sp['s3_path'],
    global_embedding_provider_id: sp['global_embedding_provider_id'],
    global_embedding_model_id: sp['global_embedding_model_id'],
    global_embedding_dimension: sp['global_embedding_dimension'],
    monthly_summary_source: sp['monthly_summary_source'],
    agent_context_window_size: sp['agent_context_window_size'],
    companion_compress_tokens: sp['companion_compress_tokens'],
    companion_truncate_tokens: sp['companion_truncate_tokens'],
    agent_persona: sp['agent_persona'],
    agent_guidelines: sp['agent_guidelines'],
    disabled_tool_ids: disabledToolIds,
    rag_global_enabled: sp['rag_global_enabled'],
    rag_top_k: sp['rag_top_k'],
    rag_similarity_threshold: sp['rag_similarity_threshold'],
    summary_prompt_instructions: sp['summary_prompt_instructions'],
    mcp_server_enabled: sp['mcp_server_enabled'],
    mcp_server_port: sp['mcp_server_port'],
    web_search_engine: sp['web_search_engine'],
    web_search_max_results: sp['web_search_max_results'],
    web_search_rag_enabled: sp['web_search_rag_enabled'],
    tavily_api_key: sp['tavily_api_key'],
    exa_api_key: sp['exa_api_key'],
    anysearch_api_key: sp['anysearch_api_key'],
    web_search_rag_max_chunks: sp['web_search_rag_max_chunks'],
    web_search_rag_chunks_per_source: sp['web_search_rag_chunks_per_source'],
    web_search_plain_snippet_length: sp['web_search_plain_snippet_length'],
    user_avatar_path: sp['user_avatar_path'],
    custom_storage_root: sp['custom_storage_root']
  }

  if (Object.keys(allToolConfigs).length > 0) {
    config['all_tool_configs'] = allToolConfigs
  }
  if (Object.keys(allSummaryInstructions).length > 0) {
    config['all_summary_instructions'] = allSummaryInstructions
  }

  return config
}

export const IOS_FLUTTER_SETTINGS_MIGRATION_NOTE =
  'iOS 覆盖升级时日记、会话等内容可自动迁移；API Key 等应用设置需在新版中重新配置。'

export function isFlutterSettingsMigrationFullySupported(platform: string): boolean {
  return platform === 'android'
}

export function extractFlutterCustomStorageRoot(
  sp: Record<string, unknown>
): string | null {
  const raw = sp['custom_storage_root']
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function hasMeaningfulFlutterPreferences(config: Record<string, unknown>): boolean {
  return Object.entries(config).some(([, value]) => {
    if (value === undefined || value === null) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object') return Object.keys(value as object).length > 0
    return true
  })
}
