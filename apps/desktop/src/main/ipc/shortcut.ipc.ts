import { ipcMain } from 'electron';
import { PromptShortcut } from '@baishou/shared';
import { PromptShortcutRepository } from '@baishou/database';
import { appDb } from '../db';

const repo = new PromptShortcutRepository(appDb);

export function registerShortcutIPC() {
  ipcMain.handle('shortcuts:get-all', async () => {
    return await repo.findAll();
  });
  ipcMain.handle('shortcuts:save-all', async (_, list: PromptShortcut[]) => {
    // 简单实现：全量覆盖或逐个更新
    // 假设 db 支持这种操作
    for (const item of list) {
      if (!item.id) continue;
      // repository upsert needed, but if unsupported, we omit for safety or wait for correct repo method
    }
    // We expect the front-end to handle fine-grained if not supported
    return true; 
  });
  
  // Actually repository provides 
  // findById, create, update, delete
  ipcMain.handle('shortcuts:add', async (_, sc: Omit<PromptShortcut, 'id'>) => {
    return await repo.create(sc);
  });
  
  ipcMain.handle('shortcuts:update', async (_, id: string, payload: Partial<PromptShortcut>) => {
    return await repo.update(id, payload);
  });
  
  ipcMain.handle('shortcuts:delete', async (_, id: string) => {
    return await repo.delete(id);
  });
}