import { ipcMain } from 'electron';
import { PromptShortcut } from '@baishou/shared';
import { PromptShortcutRepository } from '@baishou/database';
import { getAppDb } from '../db';
export function registerShortcutIPC() {
  const repo = new PromptShortcutRepository(getAppDb());

  ipcMain.handle('shortcuts:get-all', async () => {
    return await repo.getShortcuts();
  });
  
  ipcMain.handle('shortcuts:save-all', async (_, list: PromptShortcut[]) => {
    await repo.saveShortcuts(list);
    return true; 
  });
  
  ipcMain.handle('shortcuts:add', async (_, sc: Omit<PromptShortcut, 'id'>) => {
    const list = await repo.getShortcuts();
    const newSc = { ...sc, id: Math.random().toString(36).substring(7) };
    list.push(newSc);
    await repo.saveShortcuts(list);
    return newSc;
  });
  
  ipcMain.handle('shortcuts:update', async (_, id: string, payload: Partial<PromptShortcut>) => {
    const list = await repo.getShortcuts();
    const index = list.findIndex(s => s.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...payload };
      await repo.saveShortcuts(list);
    }
  });
  
  ipcMain.handle('shortcuts:delete', async (_, id: string) => {
    const list = await repo.getShortcuts();
    const filterList = list.filter(s => s.id !== id);
    await repo.saveShortcuts(filterList);
  });
}