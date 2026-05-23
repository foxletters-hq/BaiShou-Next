import { ipcMain, shell } from 'electron';
import { AttachmentManagerService } from '@baishou/core';
import { DesktopStoragePathService } from '../services/path.service';
import { SessionRepository, connectionManager } from '@baishou/database';
import path from 'node:path';

export function registerAttachmentIPC() {
  const pathService = new DesktopStoragePathService();
  const attachmentManager = new AttachmentManagerService(pathService);

  ipcMain.handle('attachment:listAll', async () => {
    const db = connectionManager.getDb();
    const sessionRepo = new SessionRepository(db);
    // 尽量拉取所有的会话以供标题映射
    const sessions = await sessionRepo.findAllSessions(5000);
    const activeSessionIds = new Set(sessions.map(s => s.id));

    const groups = await attachmentManager.listSessionGroups(activeSessionIds);

    // 将数据库中的会话标题匹配并写入对应的附件分组
    for (const group of groups) {
      const matched = sessions.find(s => s.id === group.sessionId);
      if (matched) {
        group.sessionTitle = matched.title || undefined;
      }
    }

    return groups;
  });

  ipcMain.handle('attachment:deleteBatch', async (_, ids: string[]) => {
    await attachmentManager.deleteBatch(ids);
    return true;
  });

  ipcMain.handle('attachment:openInFolder', async (_, absolutePath: string) => {
    try {
      const attachmentsBase = await pathService.getAttachmentsBaseDirectory();
      const resolvedPath = path.resolve(absolutePath);
      
      // 严格的安全限制：防止目录穿越攻击
      if (!resolvedPath.startsWith(attachmentsBase)) {
        throw new Error('Access denied: target path is outside the attachments root directory.');
      }
      
      shell.showItemInFolder(resolvedPath);
      return true;
    } catch (e) {
      console.error('[AttachmentIPC] Error in openInFolder:', e);
      throw e;
    }
  });

  ipcMain.handle('attachment:deleteFile', async (_, sessionId: string, fileName: string) => {
    await attachmentManager.deleteFile(sessionId, fileName);
    return true;
  });
}

