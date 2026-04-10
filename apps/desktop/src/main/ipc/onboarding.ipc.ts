import { ipcMain, dialog, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export function registerOnboardingIPC(onComplete: () => void) {
  const settingsPath = path.join(app.getPath('userData'), 'baishou_settings.json');

  ipcMain.handle('onboarding:check', async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      const root = settings.custom_storage_root;
      return { 
        needsOnboarding: !root || root.trim() === '',
        currentPath: root || path.join(app.getPath('userData'), 'Vaults')
      };
    } catch {
      return { 
        needsOnboarding: true, 
        currentPath: path.join(app.getPath('userData'), 'Vaults')
      };
    }
  });

  ipcMain.handle('onboarding:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('onboarding:set-directory', async (_, dirPath: string) => {
    let settings: any = {};
    try {
      const data = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(data);
    } catch {}
    
    settings.custom_storage_root = dirPath;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  });

  ipcMain.handle('onboarding:finish', async () => {
    onComplete();
    return true;
  });
}
