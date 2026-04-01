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
    return await repo.updateProfile(diff);
  });

  ipcMain.handle('profile:pick-avatar', async () => {
    return await profileService.pickAndSaveAvatar();
  });
}