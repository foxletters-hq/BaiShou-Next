import * as path from 'path';
import * as Minio from 'minio';
import { ICloudSyncClient, SyncRecord } from '@baishou/core';

/**
 * S3 兼容对象存储客户端
 * 支持 AWS S3, 腾讯云 COS, 阿里云 OSS, Cloudflare R2, MinIO 等
 * 1:1 还原老白守 s3_client_service.dart 的全部能力
 */
export class S3SyncClient implements ICloudSyncClient {
  private client: Minio.Client;
  private bucket: string;
  private basePath: string;

  constructor(
    endpoint: string,
    region: string,
    bucket: string,
    accessKey: string,
    secretKey: string,
    basePath: string
  ) {
    const uri = new URL(endpoint);
    this.client = new Minio.Client({
      endPoint: uri.hostname,
      port: uri.port ? parseInt(uri.port) : (uri.protocol === 'https:' ? 443 : 80),
      useSSL: uri.protocol === 'https:',
      accessKey,
      secretKey,
      region: region || 'us-east-1',
      pathStyle: false, // 兼容腾讯云 COS 的 Virtual-hosted style 寻址
    });
    this.bucket = bucket;

    // 标准化路径：确保 basePath 不以 / 开头但以 / 结尾
    let p = basePath;
    if (p.startsWith('/')) p = p.substring(1);
    if (!p.endsWith('/') && p.length > 0) p += '/';
    this.basePath = p;
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const filename = path.basename(localFilePath);
    const objectName = this.basePath + filename;
    await this.client.fPutObject(this.bucket, objectName, localFilePath);
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const objectName = this.basePath + remoteFilename;
    await this.client.fGetObject(this.bucket, objectName, localDestPath);
  }

  async listFiles(): Promise<SyncRecord[]> {
    const records: SyncRecord[] = [];

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjectsV2(this.bucket, this.basePath, true);

      stream.on('data', (obj) => {
        if (!obj.name || obj.name.endsWith('/')) return; // skip directory markers
        records.push({
          filename: path.basename(obj.name),
          lastModified: obj.lastModified || new Date(),
          sizeInBytes: obj.size || 0,
        });
      });

      stream.on('error', (err) => {
        reject(new Error(`S3 列出文件失败: ${err.message}`));
      });

      stream.on('end', () => {
        records.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        resolve(records);
      });
    });
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    const objectName = this.basePath + remoteFilename;
    await this.client.removeObject(this.bucket, objectName);
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const oldObjectName = this.basePath + oldFilename;
    const newObjectName = this.basePath + newFilename;

    // S3 不支持原子 rename，只能 copy + delete
    const conditions = new Minio.CopyConditions();
    await this.client.copyObject(
      this.bucket,
      newObjectName,
      `/${this.bucket}/${oldObjectName}`,
      conditions
    );
    await this.client.removeObject(this.bucket, oldObjectName);
  }
}
