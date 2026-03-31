import { describe, it, expect } from 'vitest';
import type {
  IArchiveService,
  ImportResult,
  ICloudSyncClient,
  SyncRecord,
  SyncConfig,
  ILanSyncService,
  DiscoveredDevice
} from '../index';

/**
 * 数据漫游系统 - 契约接口完整性验证
 * 确保 @baishou/core 暴露的接口类型签名完整可组装
 */

describe('IArchiveService 接口契约', () => {
  it('必须包含 exportToTempFile 方法', () => {
    const mock: IArchiveService = {
      exportToTempFile: async () => '/tmp/archive.zip',
      exportToUserDevice: async () => '/Downloads/archive.zip',
      importFromZip: async () => ({ fileCount: 10, profileRestored: true }),
      createSnapshot: async () => '/tmp/snapshot.zip',
    };
    expect(mock.exportToTempFile).toBeDefined();
    expect(mock.exportToUserDevice).toBeDefined();
    expect(mock.importFromZip).toBeDefined();
    expect(mock.createSnapshot).toBeDefined();
  });

  it('importFromZip 返回值必须包含 fileCount 和 profileRestored', async () => {
    const mock: IArchiveService = {
      exportToTempFile: async () => null,
      exportToUserDevice: async () => null,
      importFromZip: async (_zipPath: string) => ({
        fileCount: 42,
        profileRestored: true,
        snapshotPath: '/tmp/pre-import-snapshot.zip',
      }),
      createSnapshot: async () => null,
    };

    const result: ImportResult = await mock.importFromZip('/fake.zip');
    expect(result.fileCount).toBe(42);
    expect(result.profileRestored).toBe(true);
    expect(result.snapshotPath).toBe('/tmp/pre-import-snapshot.zip');
  });
});

describe('ICloudSyncClient 接口契约', () => {
  it('必须支持五大操作：上传/下载/列出/删除/重命名', () => {
    const mock: ICloudSyncClient = {
      uploadFile: async () => {},
      downloadFile: async () => {},
      listFiles: async () => [],
      deleteFile: async () => {},
      renameFile: async () => {},
    };
    expect(mock.uploadFile).toBeDefined();
    expect(mock.downloadFile).toBeDefined();
    expect(mock.listFiles).toBeDefined();
    expect(mock.deleteFile).toBeDefined();
    expect(mock.renameFile).toBeDefined();
  });

  it('listFiles 应该返回 SyncRecord 数组', async () => {
    const mockRecords: SyncRecord[] = [
      { filename: 'backup_2026-03-31.zip', lastModified: new Date(), sizeInBytes: 50 * 1024 * 1024 },
      { filename: 'backup_2026-03-30.zip', lastModified: new Date(Date.now() - 86400000), sizeInBytes: 48 * 1024 * 1024 },
    ];

    const mock: ICloudSyncClient = {
      uploadFile: async () => {},
      downloadFile: async () => {},
      listFiles: async () => mockRecords,
      deleteFile: async () => {},
      renameFile: async () => {},
    };

    const records = await mock.listFiles();
    expect(records).toHaveLength(2);
    expect(records[0].filename).toBe('backup_2026-03-31.zip');
    expect(records[0].sizeInBytes).toBe(50 * 1024 * 1024);
  });
});

describe('SyncConfig 配置类型', () => {
  it('默认配置结构应当完整可初始化', () => {
    const config: SyncConfig = {
      target: 'local',
      maxBackupCount: 20,
      webdavUrl: 'https://',
      webdavUsername: '',
      webdavPassword: '',
      webdavPath: '/baishou_backup',
      s3Endpoint: 'https://',
      s3Region: '',
      s3Bucket: '',
      s3Path: '/baishou_backup',
      s3AccessKey: '',
      s3SecretKey: '',
    };

    expect(config.target).toBe('local');
    expect(config.maxBackupCount).toBe(20);
  });

  it('切换 target 为 webdav 时相关字段应生效', () => {
    const config: SyncConfig = {
      target: 'webdav',
      maxBackupCount: 10,
      webdavUrl: 'https://dav.jianguoyun.com/dav/',
      webdavUsername: 'user@example.com',
      webdavPassword: 'app-secret-key',
      webdavPath: '/baishou_backup',
      s3Endpoint: '', s3Region: '', s3Bucket: '',
      s3Path: '', s3AccessKey: '', s3SecretKey: '',
    };

    expect(config.target).toBe('webdav');
    expect(config.webdavUrl).toContain('jianguoyun');
  });

  it('切换 target 为 s3 时相关字段应生效', () => {
    const config: SyncConfig = {
      target: 's3',
      maxBackupCount: 50,
      webdavUrl: '', webdavUsername: '', webdavPassword: '', webdavPath: '',
      s3Endpoint: 'https://cos.ap-shanghai.myqcloud.com',
      s3Region: 'ap-shanghai',
      s3Bucket: 'baishou-backup-123',
      s3Path: '/data',
      s3AccessKey: 'AKIDxxxx',
      s3SecretKey: 'xxxx',
    };

    expect(config.target).toBe('s3');
    expect(config.s3Endpoint).toContain('cos.ap-shanghai');
    expect(config.s3Bucket).toBe('baishou-backup-123');
  });
});

describe('ILanSyncService 接口契约', () => {
  it('必须包含完整的双向通讯能力', () => {
    const mock: ILanSyncService = {
      startBroadcasting: async () => ({ ip: '192.168.1.100', port: 8080 }),
      stopBroadcasting: async () => {},
      startDiscovery: async () => {},
      stopDiscovery: async () => {},
      sendFile: async () => true,
      onFileReceived: () => {},
    };

    expect(mock.startBroadcasting).toBeDefined();
    expect(mock.stopBroadcasting).toBeDefined();
    expect(mock.startDiscovery).toBeDefined();
    expect(mock.stopDiscovery).toBeDefined();
    expect(mock.sendFile).toBeDefined();
    expect(mock.onFileReceived).toBeDefined();
  });

  it('startBroadcasting 应该返回 IP 和端口', async () => {
    const mock: ILanSyncService = {
      startBroadcasting: async () => ({ ip: '10.0.0.5', port: 0 }),
      stopBroadcasting: async () => {},
      startDiscovery: async () => {},
      stopDiscovery: async () => {},
      sendFile: async () => true,
      onFileReceived: () => {},
    };

    const result = await mock.startBroadcasting();
    expect(result).not.toBeNull();
    expect(result!.ip).toBe('10.0.0.5');
  });

  it('DiscoveredDevice 类型应包含关键字段', () => {
    const device: DiscoveredDevice = {
      nickname: 'BaiShou-Desktop-a1b2',
      ip: '192.168.1.101',
      port: 54321,
      deviceType: 'desktop',
      rawServiceId: 'BaiShou-Desktop-a1b2',
    };

    expect(device.nickname).toContain('BaiShou');
    expect(device.deviceType).toBe('desktop');
    expect(device.port).toBeGreaterThan(0);
  });
});

describe('超限自动清理逻辑 (模拟)', () => {
  it('当记录数超过 maxCount 时应删除最旧的部分', async () => {
    const records: SyncRecord[] = Array.from({ length: 25 }, (_, i) => ({
      filename: `backup_${String(i).padStart(2, '0')}.zip`,
      lastModified: new Date(Date.now() - i * 86400000), // 按天递减
      sizeInBytes: 1024 * 1024,
    }));

    // 模拟排序后取超限部分
    const maxCount = 20;
    const sorted = [...records].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const toDelete = sorted.slice(maxCount);

    expect(toDelete).toHaveLength(5);
    // 最旧的应该被删除
    expect(toDelete[0].filename).toBe('backup_20.zip');
    expect(toDelete[4].filename).toBe('backup_24.zip');
  });

  it('当记录数不超过 maxCount 时不应删除任何东西', () => {
    const records: SyncRecord[] = Array.from({ length: 10 }, (_, i) => ({
      filename: `backup_${i}.zip`,
      lastModified: new Date(),
      sizeInBytes: 512,
    }));

    const maxCount = 20;
    const toDelete = records.length > maxCount ? records.slice(maxCount) : [];
    expect(toDelete).toHaveLength(0);
  });
});
