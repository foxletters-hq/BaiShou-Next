import { eq } from 'drizzle-orm'
import {
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  normalizeToolManagementConfig,
  normalizeReasoningEffortBySlot,
  stripLegacyDefaultSummaryTemplates
} from '@baishou/shared'
import { systemSettingsTable } from '../schema/system-settings'

const TRACED_SETTINGS_KEYS = new Set(['prompt_shortcuts_v2', 'prompt_shortcuts'])
import type {
  AIProviderConfig,
  GlobalModelsConfig,
  AgentBehaviorConfig,
  RagConfig,
  WebSearchConfig,
  SummaryConfig,
  ToolManagementConfig,
  McpServerConfig,
  HotkeyConfig,
  BaishouAgentGateConfig
} from '@baishou/shared'
import { withExpoAgentDatabaseLock } from '../expo-agent-db.lock'
import {
  DEFAULT_AI_PROVIDERS,
  DEFAULT_GLOBAL_MODELS,
  DEFAULT_AGENT_BEHAVIOR,
  DEFAULT_RAG_CONFIG,
  DEFAULT_WEB_SEARCH_CONFIG,
  DEFAULT_SUMMARY_CONFIG,
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  DEFAULT_MCP_SERVER_CONFIG,
  DEFAULT_HOTKEY_CONFIG,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG
} from './settings.defaults'
import { BAISHOU_AGENT_GATE_CONFIG_KEY } from '@baishou/shared'

/**
 * 供同进程内绕过 SettingsRepository 直接写 system_settings 的仓储（如 UserProfileRepository、
 * PromptShortcutRepository）触发单调版本递增，避免不同实例缓存读到过期值且零引用泄漏。
 */
const externalKeyMutationEpoch = new Map<string, number>()
let externalGlobalMutationEpoch = 0

export function notifySystemSettingsExternalMutation(key?: string): void {
  if (key) {
    externalKeyMutationEpoch.set(key, (externalKeyMutationEpoch.get(key) ?? 0) + 1)
  } else {
    externalGlobalMutationEpoch += 1
  }
}

export class SettingsRepository {
  /** 实例级写穿缓存：保存库中原始 JSON 字符串，不存在的键存 null；每次读再 JSON.parse 防外部篡改引用 */
  private readonly cache = new Map<string, string | null>()
  private readonly cacheKeyEpochs = new Map<string, number>()
  private cacheGlobalEpoch = externalGlobalMutationEpoch

  constructor(private readonly db: any) {}

  /** 清空内存读缓存（传 key 仅清单个键，不传全量清空） */
  invalidateCache(key?: string): void {
    if (key !== undefined) {
      this.cache.delete(key)
      this.cacheKeyEpochs.delete(key)
      return
    }
    this.cache.clear()
    this.cacheKeyEpochs.clear()
    this.cacheGlobalEpoch = externalGlobalMutationEpoch
  }

  private syncExternalGlobalEpoch(): void {
    if (this.cacheGlobalEpoch !== externalGlobalMutationEpoch) {
      this.cache.clear()
      this.cacheKeyEpochs.clear()
      this.cacheGlobalEpoch = externalGlobalMutationEpoch
    }
  }

  private isKeyCacheFresh(key: string): boolean {
    this.syncExternalGlobalEpoch()
    if (!this.cache.has(key)) return false
    const currentKeyEpoch = externalKeyMutationEpoch.get(key) ?? 0
    return (this.cacheKeyEpochs.get(key) ?? 0) === currentKeyEpoch
  }

  private setCacheEntry(key: string, raw: string | null): void {
    this.syncExternalGlobalEpoch()
    this.cache.set(key, raw)
    this.cacheKeyEpochs.set(key, externalKeyMutationEpoch.get(key) ?? 0)
  }

  private parseCachedJson<T>(key: string, raw: string | null): T | null {
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch (e) {
      console.error(`[SettingsRepository] Failed to parse JSON for key: ${key}`, e)
      this.setCacheEntry(key, null)
      return null
    }
  }

  /**
   * 获取指定键的配置，并反序列化为模型 T。若不存在则返回 null。
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isKeyCacheFresh(key)) {
      return this.parseCachedJson<T>(key, this.cache.get(key) ?? null)
    }
    if (!TRACED_SETTINGS_KEYS.has(key)) {
      return withExpoAgentDatabaseLock(this.db, async () => this.getUnlocked<T>(key), 'high')
    }
    return traceCall(
      SHORTCUT_TRACE_CHAIN,
      'SettingsRepository.get',
      () => withExpoAgentDatabaseLock(this.db, async () => this.getUnlocked<T>(key), 'high'),
      { key }
    )
  }

  private async getUnlocked<T>(key: string): Promise<T | null> {
    if (this.isKeyCacheFresh(key)) {
      return this.parseCachedJson<T>(key, this.cache.get(key) ?? null)
    }

    const result = await this.db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, key))
      .limit(1)

    if (result.length === 0) {
      this.setCacheEntry(key, null)
      return null
    }

    const rawValue = String(result[0].value)
    try {
      const parsed = JSON.parse(rawValue) as T
      this.setCacheEntry(key, rawValue)
      return parsed
    } catch (e) {
      console.error(`[SettingsRepository] Failed to parse JSON for key: ${key}`, e)
      this.setCacheEntry(key, null)
      return null
    }
  }

  /**
   * 将全量配置抽出，并顺带预热写穿缓存
   */
  async getAll(): Promise<Record<string, any>> {
    return withExpoAgentDatabaseLock(this.db, () => this.getAllUnlocked(), 'high')
  }

  private hydrateCacheFromRows(rows: Array<{ key: string; value: string }>): void {
    this.syncExternalGlobalEpoch()
    const presentKeys = new Set<string>()
    for (const r of rows) {
      presentKeys.add(r.key)
      this.setCacheEntry(r.key, r.value)
    }
    // 此前缓存过但库中已不存在的键更新为 null，避免保留过期正缓存同时维持负缓存命中
    for (const cachedKey of this.cache.keys()) {
      if (!presentKeys.has(cachedKey)) {
        this.setCacheEntry(cachedKey, null)
      }
    }
  }

  private async getAllUnlocked(): Promise<Record<string, any>> {
    const rows = await this.db.select().from(systemSettingsTable)
    this.hydrateCacheFromRows(rows)
    const result: Record<string, any> = {}
    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value)
      } catch {
        // preserve unparseable raw str
        result[r.key] = r.value
      }
    }
    return result
  }

  /** 含 updatedAt，供设置磁盘重同步时与域文件 mtime 比较 */
  async getAllEntriesMeta(): Promise<Record<string, { value: unknown; updatedAt: Date }>> {
    return withExpoAgentDatabaseLock(this.db, () => this.getAllEntriesMetaUnlocked(), 'high')
  }

  private async getAllEntriesMetaUnlocked(): Promise<
    Record<string, { value: unknown; updatedAt: Date }>
  > {
    const rows = await this.db.select().from(systemSettingsTable)
    this.hydrateCacheFromRows(rows)
    const result: Record<string, { value: unknown; updatedAt: Date }> = {}
    for (const r of rows) {
      try {
        result[r.key] = {
          value: JSON.parse(r.value),
          updatedAt: r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)
        }
      } catch {
        // skip unparseable entries
      }
    }
    return result
  }

  /**
   * 将任意数据模型序列化为 JSON 字符串，并保存至数据库。支持插入和更新 (Upsert)。
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!TRACED_SETTINGS_KEYS.has(key)) {
      return withExpoAgentDatabaseLock(this.db, () => this.setUnlocked(key, value), 'high')
    }
    return traceCall(
      SHORTCUT_TRACE_CHAIN,
      'SettingsRepository.set',
      () => withExpoAgentDatabaseLock(this.db, () => this.setUnlocked(key, value), 'high'),
      { key, payload: value }
    )
  }

  private async setUnlocked<T>(key: string, value: T): Promise<void> {
    const jsonStr = JSON.stringify(value)
    if (jsonStr === undefined) {
      throw new Error(`[SettingsRepository] Cannot persist undefined value for key: ${key}`)
    }

    await this.db
      .insert(systemSettingsTable)
      .values({
        key,
        value: jsonStr,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: {
          value: jsonStr,
          updatedAt: new Date()
        }
      })

    this.setCacheEntry(key, jsonStr)
  }

  /**
   * 删除指定的配置键。
   */
  async delete(key: string): Promise<void> {
    return withExpoAgentDatabaseLock(
      this.db,
      async () => {
        await this.db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, key))
        this.setCacheEntry(key, null)
      },
      'high'
    )
  }

  // --- 领域配置获取与保存 (Domain Configs) ---

  async getAIProviderConfigs(): Promise<AIProviderConfig[]> {
    return (await this.get<AIProviderConfig[]>('ai_providers')) ?? DEFAULT_AI_PROVIDERS
  }
  async setAIProviderConfigs(config: AIProviderConfig[]): Promise<void> {
    await this.set('ai_providers', config)
  }

  async getGlobalModelsConfig(): Promise<GlobalModelsConfig> {
    const raw = (await this.get<GlobalModelsConfig>('global_models')) ?? DEFAULT_GLOBAL_MODELS
    return {
      ...DEFAULT_GLOBAL_MODELS,
      ...raw,
      reasoningEffortBySlot: normalizeReasoningEffortBySlot(raw.reasoningEffortBySlot)
    }
  }
  async setGlobalModelsConfig(config: GlobalModelsConfig): Promise<void> {
    await this.set('global_models', config)
  }

  async getAgentBehaviorConfig(): Promise<AgentBehaviorConfig> {
    const raw = await this.get<Partial<AgentBehaviorConfig> & Record<string, unknown>>(
      'agent_behavior'
    )
    if (!raw) return { ...DEFAULT_AGENT_BEHAVIOR }
    return {
      agentContextWindowSize:
        raw.agentContextWindowSize ?? DEFAULT_AGENT_BEHAVIOR.agentContextWindowSize,
      companionCompressTokens:
        raw.companionCompressTokens ?? DEFAULT_AGENT_BEHAVIOR.companionCompressTokens,
      companionTruncateTokens:
        raw.companionTruncateTokens ?? DEFAULT_AGENT_BEHAVIOR.companionTruncateTokens,
      agentPersona: raw.agentPersona ?? DEFAULT_AGENT_BEHAVIOR.agentPersona,
      agentGuidelines: raw.agentGuidelines ?? DEFAULT_AGENT_BEHAVIOR.agentGuidelines,
      pinnedAssistantIds: raw.pinnedAssistantIds ?? DEFAULT_AGENT_BEHAVIOR.pinnedAssistantIds,
      restoreLastSessionOnReturn: raw.restoreLastSessionOnReturn !== false,
      reasoningEffortDefault:
        raw.reasoningEffortDefault ?? DEFAULT_AGENT_BEHAVIOR.reasoningEffortDefault
    }
  }
  async setAgentBehaviorConfig(config: AgentBehaviorConfig): Promise<void> {
    await this.set('agent_behavior', config)
  }

  async getRagConfig(): Promise<RagConfig> {
    return (await this.get<RagConfig>('rag_config')) ?? DEFAULT_RAG_CONFIG
  }
  async setRagConfig(config: RagConfig): Promise<void> {
    await this.set('rag_config', config)
  }

  async getWebSearchConfig(): Promise<WebSearchConfig> {
    return (await this.get<WebSearchConfig>('web_search_config')) ?? DEFAULT_WEB_SEARCH_CONFIG
  }
  async setWebSearchConfig(config: WebSearchConfig): Promise<void> {
    await this.set('web_search_config', config)
  }

  async getSummaryConfig(): Promise<SummaryConfig> {
    const raw = (await this.get<SummaryConfig>('summary_config')) ?? DEFAULT_SUMMARY_CONFIG
    return stripLegacyDefaultSummaryTemplates(raw).config
  }
  async setSummaryConfig(config: SummaryConfig): Promise<void> {
    await this.set('summary_config', config)
  }

  async getToolManagementConfig(): Promise<ToolManagementConfig> {
    const raw =
      (await this.get<ToolManagementConfig>('tool_management_config')) ??
      DEFAULT_TOOL_MANAGEMENT_CONFIG
    return normalizeToolManagementConfig(raw)
  }
  async setToolManagementConfig(config: ToolManagementConfig): Promise<void> {
    await this.set('tool_management_config', config)
  }

  async getMcpServerConfig(): Promise<McpServerConfig> {
    return (await this.get<McpServerConfig>('mcp_server_config')) ?? DEFAULT_MCP_SERVER_CONFIG
  }
  async setMcpServerConfig(config: McpServerConfig): Promise<void> {
    await this.set('mcp_server_config', config)
  }

  async getHotkeyConfig(): Promise<HotkeyConfig> {
    return (await this.get<HotkeyConfig>('hotkey_config')) ?? DEFAULT_HOTKEY_CONFIG
  }
  async setHotkeyConfig(config: HotkeyConfig): Promise<void> {
    await this.set('hotkey_config', config)
  }

  async getBaishouAgentGateConfig(): Promise<BaishouAgentGateConfig> {
    return (
      (await this.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
      DEFAULT_BAISHOU_AGENT_GATE_CONFIG
    )
  }
  async setBaishouAgentGateConfig(config: BaishouAgentGateConfig): Promise<void> {
    await this.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
  }
}
