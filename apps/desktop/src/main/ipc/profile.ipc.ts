import { ipcMain } from 'electron';
import { UserProfileRepository } from '@baishou/database';
import { appDb } from '../db';
import { profileService } from '../services/profile.service';

const repo = new UserProfileRepository(appDb);

export function registerProfileIPC() {
  ipcMain.handle('profile:get-all', async () => {
    return await repo.getProfile();
  });

  ipcMain.handle('profile:save', async (_, diff: any) => {
    const current = await repo.getProfile();
    const updated = { ...current, ...diff };
    await repo.saveProfile(updated);
    return updated;
  });

  ipcMain.handle('profile:pick-avatar', async () => {
    return await profileService.pickAndSaveAvatar();
  });
}