import { app } from 'electron'
import * as fsp from 'fs/promises'
import { join } from 'path'
import type { SettingsRepository } from '@baishou/database-desktop'
import { DEFAULT_HOTKEY_CONFIG } from '@baishou/database-desktop'
import type { HotkeyConfig } from '@baishou/shared'
import { logger } from '@baishou/shared'

export const DESKTOP_HOTKEY_CONFIG_FILE = 'device_hotkey_config.json'
export const HOTKEY_CONFIG_SETTINGS_KEY = 'hotkey_config'

function configPath(): string {
  return join(app.getPath('userData'), DESKTOP_HOTKEY_CONFIG_FILE)
}

function isValidHotkeyConfig(value: unknown): value is HotkeyConfig {
  if (!value || typeof value !== 'object') return false
  const cfg = value as HotkeyConfig
  return (
    typeof cfg.hotkeyEnabled === 'boolean' &&
    typeof cfg.hotkeyModifier === 'string' &&
    typeof cfg.hotkeyKey === 'string'
  )
}

function recoverPartialJsonObject(content: string): unknown | null {
  const trimmed = content.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    for (let len = trimmed.length - 1; len > 0; len--) {
      const ch = trimmed[len]
      if (ch === '}' || ch === ']') {
        try {
          return JSON.parse(trimmed.slice(0, len + 1))
        } catch {
          continue
        }
      }
    }
    return null
  }
}

async function readLocalConfig(): Promise<HotkeyConfig | null> {
  try {
    const raw = await fsp.readFile(configPath(), 'utf8')
    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch (jsonErr: any) {
      logger.warn(
        `[DesktopHotkeyConfig] JSON parse failed at ${configPath()}: ${jsonErr?.message ?? jsonErr}`
      )
      parsed = recoverPartialJsonObject(raw)
      if (isValidHotkeyConfig(parsed)) {
        logger.warn('[DesktopHotkeyConfig] Recovered hotkey config, rewriting file')
        await writeLocalConfig(parsed)
        return parsed
      }
      logger.error('[DesktopHotkeyConfig] Unable to recover hotkey config file')
      return null
    }

    if (isValidHotkeyConfig(parsed)) {
      return parsed
    }
  } catch (e: any) {
    if (e?.code !== 'ENOENT') {
      throw e
    }
  }
  return null
}

async function writeLocalConfig(config: HotkeyConfig): Promise<void> {
  const userData = app.getPath('userData')
  await fsp.mkdir(userData, { recursive: true })

  const fullPath = configPath()
  const tmpPath = `${fullPath}.tmp`
  const payload = JSON.stringify(config, null, 2)

  await fsp.writeFile(tmpPath, payload, 'utf8')
  try {
    await fsp.rename(tmpPath, fullPath)
  } catch (renameErr: any) {
    if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EEXIST') {
      try {
        await fsp.unlink(fullPath)
      } catch (unlinkErr: any) {
        if (unlinkErr.code !== 'ENOENT') {
          throw unlinkErr
        }
      }
      await fsp.rename(tmpPath, fullPath)
    } else {
      throw renameErr
    }
  }
}

async function removeLegacySharedConfig(settingsRepo: SettingsRepository): Promise<void> {
  const legacy = await settingsRepo.get(HOTKEY_CONFIG_SETTINGS_KEY)
  if (legacy === null || legacy === undefined) return
  await settingsRepo.delete(HOTKEY_CONFIG_SETTINGS_KEY)
}

/**
 * 将历史上写入共享 Agent DB / vault settings 的快捷键迁移到本机 userData。
 */
export async function migrateDesktopHotkeyConfigFromSharedSettings(
  settingsRepo: SettingsRepository,
  flushSharedSettings?: () => Promise<void>
): Promise<void> {
  if (await readLocalConfig()) return

  const legacy = await settingsRepo.get<HotkeyConfig>(HOTKEY_CONFIG_SETTINGS_KEY)
  if (!legacy) return

  await writeLocalConfig(legacy)
  await settingsRepo.delete(HOTKEY_CONFIG_SETTINGS_KEY)
  if (flushSharedSettings) {
    await flushSharedSettings()
  }
}

export async function getDesktopHotkeyConfig(): Promise<HotkeyConfig> {
  return (await readLocalConfig()) ?? DEFAULT_HOTKEY_CONFIG
}

export async function setDesktopHotkeyConfig(
  config: HotkeyConfig,
  settingsRepo?: SettingsRepository,
  flushSharedSettings?: () => Promise<void>
): Promise<void> {
  await writeLocalConfig(config)
  if (settingsRepo) {
    await removeLegacySharedConfig(settingsRepo)
    if (flushSharedSettings) {
      await flushSharedSettings()
    }
  }
}

export const desktopHotkeyConfigStore = {
  getHotkeyConfig: getDesktopHotkeyConfig
}
