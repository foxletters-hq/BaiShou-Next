import { SettingsRepository } from '@baishou/database/src/repositories/settings.repository';
import { SettingsFileService } from './settings-file.service';

/**
 * 掌管全局状态的大设置管理器管线。
 * 将纯单机 SQLite KV转化为多设备系统隐蔽同步字典。
 */
export class SettingsManagerService {
  constructor(
     private readonly repo: SettingsRepository,
     private readonly fileService: SettingsFileService
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return this.repo.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.repo.set(key, value);
    // 更新后强刷同步
    await this.flushToDisk();
  }

  async flushToDisk(): Promise<void> {
     const settingsMap = await this.repo.getAll();
     await this.fileService.writeAllSettings(settingsMap);
  }

  /**
   * Vault或网口新数据接连时
   */
  async fullResyncFromDisk(): Promise<void> {
     const settingsMap = await this.fileService.readAllSettings();
     // 如果外层是 {} 依然继续，只是不更新罢了。
     for (const key of Object.keys(settingsMap)) {
         await this.repo.set(key, settingsMap[key]);
     }
  }
}
