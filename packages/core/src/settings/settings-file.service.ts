import fs from 'node:fs/promises';
import path from 'node:path';
import { IStoragePathService } from '../vault/storage-path.types';

export class SettingsFileService {
  constructor(private readonly pathProvider: IStoragePathService) {}

  private async getSettingsPath(): Promise<string> {
    // 漫游级应用设置放在 Vault 下隐藏文件夹，与其它端同步共享
    // 注意：如果是单机版且不跨端，可以放回 userData，但为了支持 WebDAV Vault 漫游，这尤为关键
    const sysDir = await this.pathProvider.getVaultSystemDirectory('default'); // 在单一化架构中可能直接就是 .baishou 
    return path.join(sysDir, 'settings.json');
  }

  async writeAllSettings(settingsMap: Record<string, any>): Promise<void> {
     const fullPath = await this.getSettingsPath();
     // 避免并发全量重写时出问题，使用原子级方式更好，但在这里我们简易处理
     await fs.writeFile(fullPath, JSON.stringify(settingsMap, null, 2), 'utf8');
  }

  async readAllSettings(): Promise<Record<string, any>> {
     const fullPath = await this.getSettingsPath();
     try {
       const content = await fs.readFile(fullPath, 'utf8');
       return JSON.parse(content) || {};
     } catch (e: any) {
       if (e.code === 'ENOENT') return {};
       throw e;
     }
  }
}
