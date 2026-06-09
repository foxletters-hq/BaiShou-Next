import { SettingsRepository } from '@baishou/database'
import { SHORTCUT_TRACE_CHAIN, traceCall } from '@baishou/shared'
import { SettingsFileService } from './settings-file.service'

const PROMPT_SHORTCUTS_KEY = 'prompt_shortcuts_v2'

function shouldTraceSettingsKey(key: string): boolean {
  return key === PROMPT_SHORTCUTS_KEY || key === 'prompt_shortcuts'
}

/**
 * 掌管全局状态的大设置管理器管线。
 * 将纯单机 SQLite KV转化为多设备系统隐蔽同步字典。
 */
export class SettingsManagerService {
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
      return
    }
    await traceCall(
      SHORTCUT_TRACE_CHAIN,
      'SettingsManager.set',
      async () => {
        await this.repo.set(key, value)
        await this.flushToDisk()
      },
      { key, payload: value }
    )
  }

  async flushToDisk(): Promise<void> {
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
      await this.repo.set(key, settingsMap[key])
    }
  }
}
