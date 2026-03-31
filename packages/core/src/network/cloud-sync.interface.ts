// 跨平台云同步客户端协议抽象

export type SyncTarget = 'local' | 's3' | 'webdav';

export interface SyncRecord {
  filename: string;
  lastModified: Date;
  sizeInBytes: number;
}

export interface SyncConfig {
  target: SyncTarget;
  maxBackupCount: number;

  // WebDAV
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavPath: string;

  // S3
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3Path: string;
  s3AccessKey: string;
  s3SecretKey: string;
}

export interface ICloudSyncClient {
  /** 将本地 ZIP 文件上传到云端 */
  uploadFile(localFilePath: string): Promise<void>;

  /** 从云端下载指定文件到本地指定路径 */
  downloadFile(remoteFilename: string, localDestPath: string): Promise<void>;

  /** 列出远端目录下所有已存备份，返回按时间倒序排列的元记录 */
  listFiles(): Promise<SyncRecord[]>;

  /** 删除指定的云端文件 */
  deleteFile(remoteFilename: string): Promise<void>;

  /** 重命名云端文件 (S3 = copy+delete, WebDAV = move) */
  renameFile(oldFilename: string, newFilename: string): Promise<void>;
}
