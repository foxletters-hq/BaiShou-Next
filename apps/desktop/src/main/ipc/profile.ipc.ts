import { ipcMain } from 'electron';
import { UserProfileRepository } from '@baishou/database';
import { getAppDb } from '../db';
import { profileService } from '../services/profile.service';
export function registerProfileIPC() {
  const repo = new UserProfileRepository(getAppDb());

  ipcMain.handle('profile:get-all', async () => {
    const raw = await repo.getProfile();
    return await profileService.mapProfileOutput(raw);
  });

  ipcMain.handle('profile:save', async (_, diff: any) => {
    const current = await repo.getProfile();
    const updated = { ...current, ...diff };
    await profileService.processProfileInput(updated);
    await repo.saveProfile(updated);
    return await profileService.mapProfileOutput(updated);
  });

  ipcMain.handle('profile:update', async (_, diff: any) => {
    const current = await repo.getProfile();
    const updated = { ...current, ...diff };
    await profileService.processProfileInput(updated);
    await repo.saveProfile(updated);
    return await profileService.mapProfileOutput(updated);
  });

  ipcMain.handle('profile:pick-avatar', async () => {
    return await profileService.pickAndSaveAvatar();
  });
}