import { ipcMain } from 'electron'
import { UserProfileRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { profileService } from '../services/profile.service'
import { settingsManager } from './settings.ipc'
export function registerProfileIPC() {
  ipcMain.handle('profile:get-all', async () => {
    const repo = new UserProfileRepository(getAppDb())
    const raw = await repo.getProfile()
    return await profileService.mapProfileOutput(raw)
  })

  ipcMain.handle('profile:save', async (_, diff: any) => {
    const repo = new UserProfileRepository(getAppDb())
    const current = await repo.getProfile()
    const updated = { ...current, ...diff }
    await profileService.processProfileInput(updated)
    await repo.saveProfile(updated)
    await settingsManager.flushToDisk()
    return await profileService.mapProfileOutput(updated)
  })

  ipcMain.handle('profile:update', async (_, diff: any) => {
    const repo = new UserProfileRepository(getAppDb())
    const current = await repo.getProfile()
    const updated = { ...current, ...diff }
    await profileService.processProfileInput(updated)
    await repo.saveProfile(updated)
    await settingsManager.flushToDisk()
    return await profileService.mapProfileOutput(updated)
  })

  ipcMain.handle('profile:pick-avatar', async () => {
    return await profileService.pickAndSaveAvatar()
  })
}
