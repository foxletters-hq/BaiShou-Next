import * as path from 'path';
import * as fs from 'fs';
import { createClient, WebDAVClient } from 'webdav';
import { ICloudSyncClient, SyncRecord } from '@baishou/core';

/**
 * WebDAV 云客户端服务
 * 支持坚果云、Nextcloud、群晖 (Synology) 和自搭 WebDAV 服务器
 * 1:1 还原老白守 webdav_client_service.dart 的全部能力
 */
export class WebDavSyncClient implements ICloudSyncClient {
  private client: WebDAVClient;
  private basePath: string;

  constructor(url: string, username: string, password: string, basePath: string) {
    this.client = createClient(url, { username, password });
    this.basePath = basePath.endsWith('/') ? basePath : basePath + '/';
  }

  /**
   * 递归地确保远端目录层级存在（WebDAV MKCOL 一次只能建一级）
   */
  private async ensureDirExists(dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      try {
        await this.client.createDirectory(currentPath);
      } catch (e: any) {
        // 目录已存在 (405/409 都可能，取决于服务器实现)
      }
    }
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const filename = path.basename(localFilePath);
    await this.ensureDirExists(this.basePath);

    const remotePath = this.basePath + filename;
    const fileBuffer = fs.readFileSync(localFilePath);
    await this.client.putFileContents(remotePath, fileBuffer, { overwrite: true });
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const remotePath = this.basePath + remoteFilename;
    const buffer = await this.client.getFileContents(remotePath) as Buffer;
    fs.writeFileSync(localDestPath, buffer);
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = [];

    try {
      const items = await this.client.getDirectoryContents(this.basePath) as any[];

      for (const item of items) {
        if (item.type === 'directory') continue;
        records.push({
          filename: item.basename,
          lastModified: new Date(item.lastmod),
          sizeInBytes: item.size || 0,
        });
      }

      records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404')) {
        return [];
      }
      throw new Error(`WebDAV 列出文件失败: ${e.message || e}`);
    }

    return records;
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const remotePath = this.basePath + remoteFilename;
    await this.client.deleteFile(remotePath);
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldPath = this.basePath + oldFilename;
    const newPath = this.basePath + newFilename;
    // WebDAV 使用 MOVE 方法
    await this.client.moveFile(oldPath, newPath);
  }
}
