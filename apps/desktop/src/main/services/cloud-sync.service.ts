import * as path from 'path';
import * as fsp from 'fs/promises';
import { app } from 'electron';

import { SyncConfig, ICloudSyncClient, SyncRecord } from '@baishou/core';
import { WebDavSyncClient } from './webdav-sync.client';
import { S3SyncClient } from './s3-sync.client';
import { DesktopArchiveService } from './archive.service';

/**
 * 桌面端云同步服务
 * 完整复刻老白守 DataSyncPage 中的同步逻辑：
 * 1. 生成 ZIP -> 上传至云端
 * 2. 自动清理超限备份（保留最近 N 份）
 * 3. 从云端指定记录下载 ZIP -> 导入覆写本地
 */
export class DesktopCloudSyncService {
  constructor(private archiveService: DesktopArchiveService) {}

  /**
   * 根据配置创建对应的云客户端实例
   */
  private createClient(config: SyncConfig): ICloudSyncClient {
    if (config.target === 'webdav') {
      return new WebDavSyncClient(
        config.webdavUrl,
        config.webdavUsername,
        config.webdavPassword,
        config.webdavPath
      );
    } else if (config.target === 's3') {
      return new S3SyncClient(
        config.s3Endpoint,
        config.s3Region,
        config.s3Bucket,
        config.s3AccessKey,
        config.s3SecretKey,
        config.s3Path
      );
    }
    throw new Error('Unsupported sync target: ' + config.target);
  }

  /**
   * 立即同步：生成 ZIP -> 上传 -> 自动清理超限
   */
  async syncNow(config: SyncConfig): Promise<{ success: boolean; message: string }> {
    if (config.target === 'local') {
      return { success: false, message: '当前同步目标为本地，无需云同步' };
    }

    try {
      const client = this.createClient(config);

      // 1. 生成临时 ZIP
      const zipPath = await this.archiveService.exportToTempFile();
      if (!zipPath) {
        return { success: false, message: '生成备份 ZIP 失败' };
      }

      // 2. 上传
      await client.uploadFile(zipPath);

      // 3. 清除临时文件
      await fsp.unlink(zipPath).catch(() => {});

      // 4. 超限清理
      await this.autoCleanOldBackups(client, config.maxBackupCount);

      return { success: true, message: '同步成功' };
    } catch (e: any) {
      return { success: false, message: `同步失败: ${e.message || e}` };
    }
  }

  /**
   * 列出远端备份记录
   */
  async listRecords(config: SyncConfig): Promise<SyncRecord[]> {
    if (config.target === 'local') return [];
    const client = this.createClient(config);
    return await client.listFiles();
  }

  /**
   * 从远端下载 ZIP 并还原至本地
   */
  async restoreFromCloud(
    config: SyncConfig,
    remoteFilename: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createClient(config);
      const tempPath = path.join(
        app.getPath('temp'),
        `restore_${Date.now()}.zip`
      );

      await client.downloadFile(remoteFilename, tempPath);

      // 调用 archive service 的 importFromZip
      const result = await this.archiveService.importFromZip(tempPath);

      // 清理临时文件
      await fsp.unlink(tempPath).catch(() => {});

      if (result.fileCount > 0 || result.fileCount === -1) {
        const countMsg = result.fileCount > 0 ? `，共还原 ${result.fileCount} 个文件` : '';
        return { success: true, message: `云端恢复成功${countMsg}` };
      } else {
        return { success: false, message: '导入完成但未检测到文件' };
      }
    } catch (e: any) {
      return { success: false, message: `恢复失败: ${e.message || e}` };
    }
  }

  /**
   * 将远端 ZIP 直接下载到本地指定路径
   */
  async downloadToLocal(
    config: SyncConfig,
    remoteFilename: string,
    localDestPath: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createClient(config);
      await client.downloadFile(remoteFilename, localDestPath);
      return { success: true, message: `已成功保存到: ${localDestPath}` };
    } catch (e: any) {
      return { success: false, message: `下载失败: ${e.message || e}` };
    }
  }

  /**
   * 删除云端指定文件
   */
  async deleteRecord(config: SyncConfig, filename: string): Promise<void> {
    const client = this.createClient(config);
    await client.deleteFile(filename);
  }

  /**
   * 批量删除
   */
  async batchDeleteRecords(config: SyncConfig, filenames: string[]): Promise<number> {
    const client = this.createClient(config);
    let deleted = 0;
    for (const f of filenames) {
      try {
        await client.deleteFile(f);
        deleted++;
      } catch (e) {
        console.error(`Failed to delete ${f}:`, e);
      }
    }
    return deleted;
  }

  /**
   * 重命名云端文件
   */
  async renameRecord(config: SyncConfig, oldName: string, newName: string): Promise<void> {
    const client = this.createClient(config);
    await client.renameFile(oldName, newName);
  }

  /**
   * 超限自动清理（保留最近 maxCount 份，删除更早的）
   * 完美还原老白守的 _autoCleanOldBackups 逻辑
   */
  private async autoCleanOldBackups(client: ICloudSyncClient, maxCount: number): Promise<number> {
    const records = await client.listFiles();
    if (records.length <= maxCount) return 0;

    const toDelete = records.slice(maxCount);
    let deleted = 0;
    for (const record of toDelete) {
      try {
        await client.deleteFile(record.filename);
        deleted++;
      } catch (e) {
        console.error('Auto-clean failed for:', record.filename, e);
      }
    }
    return deleted;
  }
}
