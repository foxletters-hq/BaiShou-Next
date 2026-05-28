import { SettingsRepository } from '@baishou/database-desktop'
import { SettingsFileService, SettingsManagerService } from '@baishou/core-desktop'
import { getAppDb, onAppDbReset } from '../db'
import { pathService } from './vault.ipc'
import { fileSystem } from '../services/node-file-system'
import type { HotkeyService } from '../services/hotkey.service'
import { registerSettingsAppIPC } from './settings-app.ipc'
import { registerSettingsModelsIPC } from './settings-models.ipc'

let _settingsManager: SettingsManagerService | null = null
export const settingsManager = new Proxy({} as SettingsManagerService, {
  get(_target, prop) {
    if (!_settingsManager) {
      const settingsRepo = new SettingsRepository(getAppDb())
      const settingsFileService = new SettingsFileService(pathService, fileSystem)
      _settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)
    }
    const value = Reflect.get(_settingsManager, prop)
    return typeof value === 'function' ? value.bind(_settingsManager) : value
  }
})

onAppDbReset(() => {
  _settingsManager = null
})

let currentHotkeyService: HotkeyService | null = null
export function setHotkeyService(service: HotkeyService) {
  currentHotkeyService = service
}

export function getHotkeyService() {
  return currentHotkeyService
}

export function registerSettingsIPC() {
  registerSettingsAppIPC()
  registerSettingsModelsIPC()
}
