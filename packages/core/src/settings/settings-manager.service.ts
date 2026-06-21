import { SettingsRepository } from '@baishou/database'
import {
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  migrateUserProfileSettingsKey,
  USER_PROFILE_SETTINGS_KEY,
  normalizePersistedAvatarPath,
  type UserProfile
} from '@baishou/shared'
import { SettingsFileService } from './settings-file.service'
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
    if (!shouldTraceSettingsKey(key)) {
      return this.repo.get<T>(key)
    }
    return traceCall(SHORTCUT_TRACE_CHAIN, 'SettingsManager.get', () => this.repo.get<T>(key), {
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
   * Vault或网口新数据接连时
   */
  async fullResyncFromDisk(): Promise<void> {
    const settingsMap = await this.fileService.readAllSettings()
    // 如果外层是 {} 依然继续，只是不更新罢了。
    for (const key of Object.keys(settingsMap)) {
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
    const migrated = await migrateUserProfileSettingsKey(this.repo)
    if (migrated) {
      await this.flushToDiskUnlocked()
    }
  }
}
