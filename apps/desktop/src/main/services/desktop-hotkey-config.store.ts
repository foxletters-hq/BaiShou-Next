import { app } from 'electron'
import * as fsp from 'fs/promises'
import { join } from 'path'
import type { SettingsRepository } from '@baishou/database-desktop'
import { DEFAULT_HOTKEY_CONFIG } from '@baishou/database-desktop'
import type { HotkeyConfig } from '@baishou/shared'

export const DESKTOP_HOTKEY_CONFIG_FILE = 'device_hotkey_config.json'
export const HOTKEY_CONFIG_SETTINGS_KEY = 'hotkey_config'

function configPath(): string {
  return join(app.getPath('userData'), DESKTOP_HOTKEY_CONFIG_FILE)
}

async function readLocalConfig(): Promise<HotkeyConfig | null> {
  try {
    const raw = await fsp.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as HotkeyConfig
    if (
      parsed &&
      typeof parsed.hotkeyEnabled === 'boolean' &&
      typeof parsed.hotkeyModifier === 'string' &&
      typeof parsed.hotkeyKey === 'string'
    ) {
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
  await fsp.mkdir(app.getPath('userData'), { recursive: true })
  await fsp.writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
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
