import { SettingsRepository } from '@baishou/database'
import {
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  migrateUserProfileSettingsKey,
  migrateSummaryConfigLegacyTemplates,
  stripLegacyDefaultSummaryTemplates,
  USER_PROFILE_SETTINGS_KEY,
  normalizePersistedAvatarPath,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  type UserProfile,
  type SummaryConfig,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { SettingsFileService } from './settings-file.service'
import {
  getSettingsDomainFileName,
  SETTINGS_SYNC_EXCLUDED_KEYS,
  shouldApplyDiskSettingsKey
} from './settings-domain.util'
import { emitDomainMutation } from '../events'

const PROMPT_SHORTCUTS_KEY = 'prompt_shortcuts_v2'

function shouldTraceSettingsKey(key: string): boolean {
  return key === PROMPT_SHORTCUTS_KEY || key === 'prompt_shortcuts'
}

/**
 * 掌管全局状态的大设置管理器管线。
 * 将纯单机 SQLite KV转化为多设备系统隐蔽同步字典。
 */
export class SettingsManagerService {
  private flushToDiskTimer: ReturnType<typeof setTimeout> | null = null
  private flushToDiskPromise: Promise<void> | null = null

  constructor(
    private readonly repo: SettingsRepository,
    private readonly fileService: SettingsFileService
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const read = async (): Promise<T | null> => {
      const value = await this.repo.get<T>(key)
      if (key === 'summary_config' && value && typeof value === 'object') {
        return stripLegacyDefaultSummaryTemplates(value as SummaryConfig).config as T
      }
      return value
    }
    if (!shouldTraceSettingsKey(key)) {
      return read()
    }
    return traceCall(SHORTCUT_TRACE_CHAIN, 'SettingsManager.get', () => read(), {
      key,
      payload: key
    })
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!shouldTraceSettingsKey(key)) {
      await this.repo.set(key, value)
      await this.flushToDisk()
      emitDomainMutation({ domain: 'settings', action: 'update', meta: { key } })
      return
    }
    await traceCall(
      SHORTCUT_TRACE_CHAIN,
      'SettingsManager.set',
      async () => {
        await this.repo.set(key, value)
        await this.flushToDisk()
        emitDomainMutation({ domain: 'settings', action: 'update', meta: { key } })
      },
      { key, payload: value }
    )
  }

  /** 仅写 SQLite，不立刻导出全量 settings.json（配合 scheduleFlushToDisk 用于高频轻量更新） */
  async setWithoutFlush<T>(key: string, value: T): Promise<void> {
    await this.repo.set(key, value)
  }

  /** 防抖将 SQLite 全量快照写入磁盘，避免拖拽排序等操作阻塞 UI */
  scheduleFlushToDisk(delayMs = 400): void {
    if (this.flushToDiskTimer) clearTimeout(this.flushToDiskTimer)
    this.flushToDiskTimer = setTimeout(() => {
      this.flushToDiskTimer = null
      void this.flushToDisk()
    }, delayMs)
  }

  async flushToDisk(): Promise<void> {
    if (this.flushToDiskTimer) {
      clearTimeout(this.flushToDiskTimer)
      this.flushToDiskTimer = null
    }
    if (this.flushToDiskPromise) {
      await this.flushToDiskPromise
      return
    }
    this.flushToDiskPromise = this.flushToDiskUnlocked().finally(() => {
      this.flushToDiskPromise = null
    })
    await this.flushToDiskPromise
  }

  async delete(key: string): Promise<void> {
    await this.repo.delete(key)
    await this.flushToDisk()
  }

  async getBaishouAgentGateConfig(): Promise<BaishouAgentGateConfig> {
    return this.repo.getBaishouAgentGateConfig()
  }

  async setBaishouAgentGateConfig(config: BaishouAgentGateConfig): Promise<void> {
    await this.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
  }

  private async flushToDiskUnlocked(): Promise<void> {
    const settingsMap = await this.repo.getAll()
    const shortcutPayload = settingsMap[PROMPT_SHORTCUTS_KEY]
    if (shortcutPayload !== undefined) {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'SettingsManager.flushToDisk',
        () => this.fileService.writeAllSettings(settingsMap),
        { key: PROMPT_SHORTCUTS_KEY, payload: shortcutPayload }
      )
      return
    }
    await this.fileService.writeAllSettings(settingsMap)
  }

  /**
   * Vault 或同步下载后从磁盘灌入 SQLite。
   * `diskAuthoritative: true`：强制磁盘→库，禁止库反写盘（避免同步后改 hash 再次 upload）。
   */
  async fullResyncFromDisk(options?: { diskAuthoritative?: boolean }): Promise<void> {
    const diskAuthoritative = Boolean(options?.diskAuthoritative)
    const { settings: settingsMap, domainFileMtimeMs } =
      await this.fileService.readAllSettingsForResync()
    const sqliteMeta = await this.repo.getAllEntriesMeta()
    let sqliteNewerThanDisk = false

    for (const key of Object.keys(settingsMap)) {
      if (SETTINGS_SYNC_EXCLUDED_KEYS.has(key)) continue

      const fileName = getSettingsDomainFileName(key)
      const diskMtime = domainFileMtimeMs[fileName] ?? 0
      if (
        !diskAuthoritative &&
        !shouldApplyDiskSettingsKey(diskMtime, sqliteMeta[key]?.updatedAt ?? null)
      ) {
        sqliteNewerThanDisk = true
        continue
      }

      let value = settingsMap[key]
      if (key === USER_PROFILE_SETTINGS_KEY && value && typeof value === 'object') {
        const profile = value as UserProfile
        if (profile.avatarPath) {
          const normalized = normalizePersistedAvatarPath(profile.avatarPath)
          if (normalized && normalized !== profile.avatarPath) {
            value = { ...profile, avatarPath: normalized }
          }
        }
      }
      await this.repo.set(key, value)
    }
    const migratedProfile = await migrateUserProfileSettingsKey(this.repo)
    const migratedSummary = await migrateSummaryConfigLegacyTemplates(this.repo)
    if (!diskAuthoritative && (sqliteNewerThanDisk || migratedProfile || migratedSummary)) {
      await this.flushToDiskUnlocked()
    }
  }
}
