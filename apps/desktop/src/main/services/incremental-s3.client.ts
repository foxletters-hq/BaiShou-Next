import * as path from 'path';
import * as Minio from 'minio';
import type { ICloudSyncClient, SyncRecord } from '@baishou/core';

/**
 * 增量同步 S3 客户端
 * 与 S3SyncClient 不同，此客户端保留完整的目录结构路径
 * 适用于多文件增量同步场景
 */
export class IncrementalS3Client implements ICloudSyncClient {
  private client: Minio.Client;
  private bucket: string;
  private basePath: string;

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKey: string,
    secretKey: string,
    basePath: string,
  ) {
    const uri = new URL(endpoint);
    this.client = new Minio.Client({
      endPoint: uri.hostname,
      port: uri.port ? parseInt(uri.port) : (uri.protocol === 'https:' ? 443 : 80),
      useSSL: uri.protocol === 'https:',
      accessKey,
      secretKey,
      region: region || 'us-east-1',
      pathStyle: false,
    });
    this.bucket = bucket;

    let p = basePath;
    if (p.startsWith('/')) p = p.substring(1);
    if (!p.endsWith('/') && p.length > 0) p += '/';
    this.basePath = p;
  }

  async uploadFile(localFilePath: string): Promise<void> {
    // 使用文件名作为 object key（保留相对路径的 basename）
    const filename = path.basename(localFilePath);
    const objectName = this.basePath + filename;
    await this.client.fPutObject(this.bucket, objectName, localFilePath);
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    // remoteFilename 已经是完整的远端路径
    const objectName = this.basePath + remoteFilename;
    // 确保目标目录存在
    const { mkdirSync, existsSync } = require('fs');
    const dir = path.dirname(localDestPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await this.client.fGetObject(this.bucket, objectName, localDestPath);
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = [];

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjectsV2(this.bucket, this.basePath, true);

      stream.on('data', (obj) => {
        if (!obj.name || obj.name.endsWith('/')) return;

        const relativeName = obj.name.substring(this.basePath.length);

        records.push({
          filename: relativeName,
          lastModified: obj.lastModified || new Date(),
          sizeInBytes: obj.size || 0,
        });
      });

      stream.on('end', () => resolve(records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())));
      stream.on('error', reject);
    });
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const objectName = this.basePath + remoteFilename;
    await this.client.removeObject(this.bucket, objectName);
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldObjectName = this.basePath + oldFilename;
    const newObjectName = this.basePath + newFilename;
    // S3 rename = copy + delete
    await this.client.copyObject(
      this.bucket,
      newObjectName,
      `/${this.bucket}/${oldObjectName}`,
      undefined,
    );
    await this.client.removeObject(this.bucket, oldObjectName);
  }
}
