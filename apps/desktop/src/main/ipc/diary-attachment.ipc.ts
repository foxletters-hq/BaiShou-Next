import { ipcMain, shell } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@baishou/shared';
import { pathService } from './vault.ipc';

/**
 * 日记附件管理 IPC
 * 
 * 功能：
 * 1. 上传附件到日记月份目录
 * 2. 打开附件所在文件夹
 * 3. 复制附件到剪贴板
 * 4. 获取附件列表
 */
export function registerDiaryAttachmentIPC() {
  /**
   * 上传附件到日记月份目录
   * @param date 日期字符串 YYYY-MM-DD
   * @param attachments 附件数组，包含文件路径或base64数据
   */
  ipcMain.handle('diary:upload-attachments', async (_event, args: {
    date: string;
    attachments: Array<{
      filePath?: string;
      fileName?: string;
      data?: string; // base64
      mimeType?: string;
    }>;
  }) => {
    try {
      const date = new Date(args.date);
      const attachDir = await pathService.getDiaryAttachmentDirectory(date);

      const results = await Promise.all(args.attachments.map(async (att) => {
        try {
          let fileName = att.fileName || 'unknown';
          let filePath: string;

          if (att.filePath) {
            // 从文件路径复制
            const ext = path.extname(att.filePath) || path.extname(fileName);
            const baseName = path.parse(fileName).name;
            const newFileName = `${baseName}_${Date.now()}${ext}`;
            filePath = path.join(attachDir, newFileName);

            await fs.copyFile(att.filePath, filePath);
          } else if (att.data) {
            // 从base64数据写入
            const ext = getExtensionFromMimeType(att.mimeType) || '.png';
            const newFileName = `pasted_${Date.now()}${ext}`;
            filePath = path.join(attachDir, newFileName);

            const buffer = Buffer.from(att.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
            await fs.writeFile(filePath, buffer);
          } else {
            return { success: false, error: 'No file path or data provided' };
          }

          // 返回相对路径，用于存储到日记的mediaPaths
          const relativePath = path.relative(await pathService.getJournalsBaseDirectory(), filePath);

          return {
            success: true,
            filePath: filePath,
            relativePath: relativePath.replace(/\\/g, '/'),
            fileName: path.basename(filePath)
          };
        } catch (err: any) {
          logger.error('Failed to upload attachment:', err);
          return { success: false, error: err.message };
        }
      }));

      return results;
    } catch (err: any) {
      logger.error('Failed to upload attachments:', err);
      return [{ success: false, error: err.message }];
    }
  });

  /**
   * 打开附件所在文件夹
   */
  ipcMain.handle('diary:open-attachment-folder', async (_event, filePath: string) => {
    try {
      const folderPath = path.dirname(filePath);
      await shell.openPath(folderPath);
      return { success: true };
    } catch (err: any) {
      logger.error('Failed to open folder:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * 复制附件到剪贴板
   */
  ipcMain.handle('diary:copy-attachment', async (_event, filePath: string) => {
    try {
      const { clipboard, nativeImage } = await import('electron');
      const ext = path.extname(filePath).toLowerCase();

      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) {
        // 图片文件
        const image = nativeImage.createFromPath(filePath);
        clipboard.writeImage(image);
      } else {
        // 其他文件，复制文件路径
        clipboard.writeText(filePath);
      }

      return { success: true };
    } catch (err: any) {
      logger.error('Failed to copy attachment:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * 获取附件目录路径（用于预览时解析 attachment/ 引用）
   */
  ipcMain.handle('diary:get-attachment-dir', async (_event, dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const attachDir = await pathService.getDiaryAttachmentDirectory(date);
      return { success: true, path: attachDir };
    } catch (err: any) {
      logger.error('Failed to get attachment dir:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * 获取日记附件列表
   */
  ipcMain.handle('diary:list-attachments', async (_event, dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const attachDir = await pathService.getDiaryAttachmentDirectory(date);

      try {
        await fs.access(attachDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(attachDir);
      const attachments = await Promise.all(files.map(async (fileName) => {
        const filePath = path.join(attachDir, fileName);
        const stats = await fs.stat(filePath);
        const ext = path.extname(fileName).toLowerCase();

        return {
          fileName,
          filePath,
          size: stats.size,
          isImage: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext),
          isVideo: ['.mp4', '.webm', '.ogg', '.mov'].includes(ext),
          isAudio: ['.mp3', '.wav', '.ogg', '.aac'].includes(ext),
          createdAt: stats.birthtime,
        };
      }));

      return attachments;
    } catch (err: any) {
      logger.error('Failed to list attachments:', err);
      return [];
    }
  });

  /**
   * 删除附件
   */
  ipcMain.handle('diary:delete-attachment', async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (err: any) {
      logger.error('Failed to delete attachment:', err);
      return { success: false, error: err.message };
    }
  });
}

/**
 * 根据MIME类型获取文件扩展名
 */
function getExtensionFromMimeType(mimeType?: string): string {
  if (!mimeType) return '.png';

  const mimeToExt: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
  };

  return mimeToExt[mimeType] || '.png';
}
