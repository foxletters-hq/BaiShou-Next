import { ipcMain } from 'electron';
import { AttachmentManagerService } from '@baishou/core';
import { DesktopStoragePathService } from '../services/path.service';
import { SessionRepository, connectionManager } from '@baishou/database';

export function registerAttachmentIPC() {
  const pathService = new DesktopStoragePathService();
  const attachmentManager = new AttachmentManagerService(pathService);

  ipcMain.handle('attachment:listAll', async () => {
    // Collect active session UUIDs to supply for orphan checking
    const db = connectionManager.getDb();
    const sessionRepo = new SessionRepository(db);
    const sessions = await sessionRepo.findAllSessions();
    const activeSessionIds = new Set(sessions.map(s => s.id));

    return await attachmentManager.listOrphans(activeSessionIds);
  });

  ipcMain.handle('attachment:deleteBatch', async (_, ids: string[]) => {
    await attachmentManager.deleteBatch(ids);
    return true;
  });
}
