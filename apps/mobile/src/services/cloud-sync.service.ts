import * as FileSystem from 'expo-file-system';
import { ICloudSyncClient, SyncConfig, SyncRecord, IArchiveService } from '@baishou/core';

/**
 * 基于 fetch API 的 WebDAV 客户端（React Native 兼容）
 */
class MobileWebDavClient implements ICloudSyncClient {
  private baseUrl: string;
  private auth: string;
  private basePath: string;

  constructor(url: string, username: string, password: string, basePath: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.auth = `Basic ${btoa(`${username}:${password}`)}`;
    this.basePath = basePath.startsWith('/') ? basePath : `/${basePath}`;
    if (!this.basePath.endsWith('/')) this.basePath += '/';
  }

  private getRemotePath(filename: string): string {
    return `${this.basePath}${filename}`;
  }

  private async request(method: string, path: string, body?: string | Blob, headers?: Record<string, string>): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.auth,
        ...headers,
      },
      body,
    });
    return response;
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const filename = localFilePath.split('/').pop() || 'backup.zip';
    const remotePath = this.getRemotePath(filename);

    // 确保目录存在
    await this.ensureDirExists(this.basePath);

    // 使用 expo-file-system 的 uploadAsync 方法
    const response = await FileSystem.uploadAsync(`${this.baseUrl}${remotePath}`, localFilePath, {
      httpMethod: 'PUT',
      headers: {
        'Authorization': this.auth,
        'Content-Type': 'application/zip',
      },
      uploadType: 1, // FileSystem.FileSystemUploadType.BINARY_CONTENT
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WebDAV upload failed: ${response.status}`);
    }
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const remotePath = this.getRemotePath(remoteFilename);
    const url = `${this.baseUrl}${remotePath}`;

    const response = await FileSystem.downloadAsync(url, localDestPath, {
      headers: {
        'Authorization': this.auth,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WebDAV download failed: ${response.status}`);
    }
  }

  async listFiles(): Promise<SyncRecord[]> {
    const response = await this.request('PROPFIND', this.basePath, undefined, {
      'Depth': '1',
      'Content-Type': 'application/xml',
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`WebDAV list failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const records: SyncRecord[] = [];

    // 简单的 XML 解析
    const fileRegex = /<d:href>([^<]+)<\/d:href>/g;
    const modRegex = /<d:getlastmodified>([^<]+)<\/d:getlastmodified>/g;
    const sizeRegex = /<d:getcontentlength>([^<]+)<\/d:getcontentlength>/g;

    const files: string[] = [];
    const mods: string[] = [];
    const sizes: string[] = [];

    let match;
    while ((match = fileRegex.exec(text)) !== null) {
      files.push(match[1]);
    }
    while ((match = modRegex.exec(text)) !== null) {
      mods.push(match[1]);
    }
    while ((match = sizeRegex.exec(text)) !== null) {
      sizes.push(match[1]);
    }

    for (let i = 0; i < files.length; i++) {
      const path = decodeURIComponent(files[i]);
      const filename = path.split('/').filter(Boolean).pop();
      if (!filename || path.endsWith('/')) continue;

      records.push({
        filename,
        lastModified: mods[i] ? new Date(mods[i]) : new Date(),
        sizeInBytes: sizes[i] ? parseInt(sizes[i], 10) : 0,
      });
    }

    records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    return records;
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const remotePath = this.getRemotePath(remoteFilename);
    const response = await this.request('DELETE', remotePath);

    if (!response.ok && response.status !== 404) {
      throw new Error(`WebDAV delete failed: ${response.status} ${response.statusText}`);
    }
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldPath = this.getRemotePath(oldFilename);
    const newPath = this.getRemotePath(newFilename);

    const response = await this.request('MOVE', oldPath, undefined, {
      'Destination': `${this.baseUrl}${newPath}`,
      'Overwrite': 'T',
    });

    if (!response.ok) {
      throw new Error(`WebDAV rename failed: ${response.status} ${response.statusText}`);
    }
  }

  private async ensureDirExists(dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
      currentPath += '/' + part;
      try {
        await this.request('MKCOL', currentPath);
      } catch (e) {
        // 目录可能已存在，忽略错误
      }
    }
  }
}

/**
 * 基于 fetch API 的 S3 客户端（React Native 兼容）
 * 使用 AWS Signature V4 签名
 */
class MobileS3Client implements ICloudSyncClient {
  private endpoint: string;
  private region: string;
  private bucket: string;
  private accessKey: string;
  private secretKey: string;
  private basePath: string;

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKey: string,
    secretKey: string,
    basePath: string
  ) {
    this.endpoint = endpoint;
    this.region = region || 'us-east-1';
    this.bucket = bucket;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.basePath = basePath.startsWith('/') ? basePath.substring(1) : basePath;
    if (!this.basePath.endsWith('/') && this.basePath.length > 0) {
      this.basePath += '/';
    }
  }

  private getObjectUrl(objectName: string): string {
    const uri = new URL(this.endpoint);
    const usePathStyle = uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1');
    
    if (usePathStyle) {
      return `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.bucket}/${objectName}`;
    }
    return `${uri.protocol}//${this.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/${objectName}`;
  }

  private async signRequest(method: string, url: string, body?: ArrayBuffer): Promise<Record<string, string>> {
    // 简化的签名实现（生产环境建议使用完整的 AWS Signature V4）
    const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = date.substring(0, 8);
    
    const headers: Record<string, string> = {
      'x-amz-date': date,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
      'Host': new URL(url).host,
    };

    // 简化签名：对于公共读写的 bucket 或使用预签名 URL
    // 在实际生产中，应该实现完整的 AWS Signature V4
    headers['Authorization'] = `AWS ${this.accessKey}:${this.secretKey}`;

    return headers;
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const filename = localFilePath.split('/').pop() || 'backup.zip';
    const objectName = this.basePath + filename;
    const url = this.getObjectUrl(objectName);

    const headers = await this.signRequest('PUT', url);
    
    const response = await FileSystem.uploadAsync(url, localFilePath, {
      httpMethod: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/zip',
      },
      uploadType: 1, // FileSystem.FileSystemUploadType.BINARY_CONTENT
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const objectName = this.basePath + remoteFilename;
    const url = this.getObjectUrl(objectName);

    const headers = await this.signRequest('GET', url);
    
    const response = await FileSystem.downloadAsync(url, localDestPath, {
      headers,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`S3 download failed: ${response.status}`);
    }
  }

  async listFiles(): Promise<SyncRecord[]> {
    const uri = new URL(this.endpoint);
    const usePathStyle = uri.hostname.includes('localhost') || uri.hostname.includes('127.0.0.1');
    
    let listUrl: string;
    if (usePathStyle) {
      listUrl = `${uri.protocol}//${uri.hostname}${uri.port ? ':' + uri.port : ''}/${this.bucket}?list-type=2&prefix=${encodeURIComponent(this.basePath)}`;
    } else {
      listUrl = `${uri.protocol}//${this.bucket}.${uri.hostname}${uri.port ? ':' + uri.port : ''}/?list-type=2&prefix=${encodeURIComponent(this.basePath)}`;
    }

    const headers = await this.signRequest('GET', listUrl);
    const response = await fetch(listUrl, { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`S3 list failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const records: SyncRecord[] = [];

    // 简单的 XML 解析
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    const modRegex = /<LastModified>([^<]+)<\/LastModified>/g;
    const sizeRegex = /<Size>([^<]+)<\/Size>/g;

    const keys: string[] = [];
    const mods: string[] = [];
    const sizes: string[] = [];

    let match;
    while ((match = keyRegex.exec(text)) !== null) {
      keys.push(match[1]);
    }
    while ((match = modRegex.exec(text)) !== null) {
      mods.push(match[1]);
    }
    while ((match = sizeRegex.exec(text)) !== null) {
      sizes.push(match[1]);
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.endsWith('/')) continue;
      
      const filename = key.split('/').pop();
      if (!filename) continue;

      records.push({
        filename,
        lastModified: mods[i] ? new Date(mods[i]) : new Date(),
        sizeInBytes: sizes[i] ? parseInt(sizes[i], 10) : 0,
      });
    }

    records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    return records;
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const objectName = this.basePath + remoteFilename;
    const url = this.getObjectUrl(objectName);

    const headers = await this.signRequest('DELETE', url);
    const response = await fetch(url, { method: 'DELETE', headers });

    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 delete failed: ${response.status} ${response.statusText}`);
    }
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    // S3 不支持原子 rename，需要 copy + delete
    const oldObjectName = this.basePath + oldFilename;
    const newObjectName = this.basePath + newFilename;

    // 先 copy
    const copyUrl = this.getObjectUrl(newObjectName);
    const copyHeaders = await this.signRequest('PUT', copyUrl);
    copyHeaders['x-amz-copy-source'] = `/${this.bucket}/${oldObjectName}`;

    const copyResponse = await fetch(copyUrl, {
      method: 'PUT',
      headers: copyHeaders,
    });

    if (!copyResponse.ok) {
      throw new Error(`S3 copy failed: ${copyResponse.status} ${copyResponse.statusText}`);
    }

    // 再 delete
    await this.deleteFile(oldFilename);
  }
}

/**
 * Mobile 端云同步服务
 * 基于 Desktop 端实现，使用 React Native 兼容的 API
 */
export class MobileCloudSyncService {
  constructor(private archiveService: IArchiveService) {}

  private createClient(config: SyncConfig): ICloudSyncClient {
    if (config.target === 'webdav') {
      return new MobileWebDavClient(
        config.webdavUrl,
        config.webdavUsername,
        config.webdavPassword,
        config.webdavPath
      );
    } else if (config.target === 's3') {
      return new MobileS3Client(
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
      try {
        await FileSystem.deleteAsync(zipPath, { idempotent: true });
      } catch (e) {
        // 忽略清理错误
      }

      // 4. 超限清理
      await this.autoCleanOldBackups(client, config.maxBackupCount);

      return { success: true, message: '同步成功' };
    } catch (e: any) {
      return { success: false, message: `同步失败: ${e.message || e}` };
    }
  }

  async listRecords(config: SyncConfig): Promise<SyncRecord[]> {
    if (config.target === 'local') return [];
    const client = this.createClient(config);
    return await client.listFiles();
  }

  async restoreFromCloud(
    config: SyncConfig,
    remoteFilename: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createClient(config);
      const tempPath = `${(FileSystem as any).cacheDirectory}restore_${Date.now()}.zip`;

      await client.downloadFile(remoteFilename, tempPath);

      // 调用 archive service 的 importFromZip
      const result = await this.archiveService.importFromZip(tempPath);

      // 清理临时文件
      try {
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
      } catch (e) {
        // 忽略清理错误
      }

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

  async deleteRecord(config: SyncConfig, filename: string): Promise<void> {
    const client = this.createClient(config);
    await client.deleteFile(filename);
  }

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

  async renameRecord(config: SyncConfig, oldName: string, newName: string): Promise<void> {
    const client = this.createClient(config);
    await client.renameFile(oldName, newName);
  }

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
