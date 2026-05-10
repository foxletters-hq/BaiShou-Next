import fs from 'node:fs/promises';
import path from 'node:path';
import { IStoragePathService } from '../vault/storage-path.types';

export class SettingsFileService {
  private writeLock: Promise<void> = Promise.resolve();

  constructor(private readonly pathProvider: IStoragePathService) {}

  private async getSettingsPath(): Promise<string> {
    // 漫游级应用设置放在 Vault 下隐藏文件夹，与其它端同步共享
    const sysDir = await this.pathProvider.getVaultSystemDirectory('default');
    return path.join(sysDir, 'settings.json');
  }

  /**
   * 全量写入设置文件，使用原子写入 + 写入锁防止并发损坏。
   * 先写入临时文件，成功后再执行原子重命名，确保不会出现半截文件。
   */
  async writeAllSettings(settingsMap: Record<string, any>): Promise<void> {
    const fullPath = await this.getSettingsPath();
    const tmpPath = fullPath + '.tmp';

    const writeOp = (async () => {
      await fs.writeFile(tmpPath, JSON.stringify(settingsMap, null, 2), 'utf8');
      try {
        await fs.rename(tmpPath, fullPath);
      } catch (renameErr: any) {
        // Windows 上，如果目标文件已存在，rename 会失败（EXDEV/EPERM）
        // 回退方案：先删除目标文件，再重命名
        if (renameErr.code === 'EXDEV' || renameErr.code === 'EPERM' || renameErr.code === 'EEXIST') {
          try {
            await fs.unlink(fullPath);
          } catch (unlinkErr: any) {
            // 如果文件不存在，忽略错误
            if (unlinkErr.code !== 'ENOENT') {
              throw unlinkErr;
            }
          }
          await fs.rename(tmpPath, fullPath);
        } else {
          throw renameErr;
        }
      }
    })();

    this.writeLock = this.writeLock.then(() => writeOp, () => writeOp);
    await writeOp;
  }

  async readAllSettings(): Promise<Record<string, any>> {
    const fullPath = await this.getSettingsPath();
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      if (!content || content.trim() === '') return {};

      try {
        return JSON.parse(content) || {};
      } catch (jsonErr: any) {
        console.error(`[SettingsFileService] ❌ JSON 解析崩溃 at ${fullPath}:`, jsonErr.message);
        // 尝试自愈：提取首个有效 JSON 对象
        const recovered = this.recoverPartialJSON(content);
        if (recovered) {
          console.warn(`[SettingsFileService] ⚡ 已恢复部分设置（共 ${Object.keys(recovered).length} 个键），正在重写文件...`);
          await this.writeAllSettings(recovered);
          return recovered;
        }
        console.error(`[SettingsFileService] ⚠️ 无法恢复，建议手动检查或删除该文件以重置设置。`);
        return {};
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') return {};
      throw e;
    }
  }

  /**
   * 从损坏的 JSON 内容中尝试恢复第一个有效的 JSON 对象。
   * 遇到语法错误时，向左回退寻找最近的合法结束位置。
   */
  private recoverPartialJSON(content: string): Record<string, any> | null {
    try {
      return JSON.parse(content) as Record<string, any>;
    } catch {
      // 从末尾逐步截断，尝试找到合法的 JSON 边界
      for (let len = content.length - 1; len > 0; len--) {
        const ch = content[len];
        if (ch === '}' || ch === ']') {
          try {
            const candidate = content.slice(0, len + 1);
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return parsed as Record<string, any>;
            }
          } catch {
            continue;
          }
        }
      }
      return null;
    }
  }
}
