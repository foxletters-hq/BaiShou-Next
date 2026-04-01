import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import extract from 'extract-zip';
import os from 'node:os';
import { DevicePreferences } from '@baishou/shared';

// 由于业务可能涉及跨模块循环，我们会通过接口约束传入的参数
export interface IStoragePathService {
  getRootDirectory(): Promise<string>;
  getGlobalRegistryDirectory(): Promise<string>;
  getSnapshotsDirectory(): Promise<string>;
}

export interface ImportResult {
  fileCount: number;
  profileRestored: boolean;
  snapshotPath?: string;
}

export class DataArchiveService {
  constructor(
    private readonly pathProvider: IStoragePathService,
    // 该回调函数允许我们在生成压缩包时，动态注入来自外层的偏好设置字典。因为很多设置只有在最高层的 Electron Store 中保存。
    private readonly devicePreferencesProvider: () => Promise<DevicePreferences>
  ) {}

  /**
   * 创建一个保护性快照并存入内部保留文件夹 (Snapshots)
   */
  async createSnapshot(): Promise<string | null> {
    try {
      const tempZip = await this.exportToTempFile();
      if (!tempZip) return null;

      const snapDir = await this.pathProvider.getSnapshotsDirectory();
      await fs.mkdir(snapDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapTarget = path.join(snapDir, `snapshot_${timestamp}.zip`);

      await fs.rename(tempZip, snapTarget).catch(async () => {
         // fallback if cross-device rename throws EXDEV
         await fs.copyFile(tempZip, snapTarget);
         await fs.unlink(tempZip);
      });

      console.info(`[DataArchiveService] Snapshot created at ${snapTarget}`);
      return snapTarget;
    } catch (e) {
      console.error(`[DataArchiveService] Error creating snapshot:`, e);
      return null;
    }
  }

  /**
   * 获取历史快照列表 (最多 5 个)
   */
  async listSnapshots(maxCount = 5): Promise<string[]> {
    const snapDir = await this.pathProvider.getSnapshotsDirectory();
    if (!existsSync(snapDir)) return [];

    const files = await fs.readdir(snapDir);
    const zips = files.filter(f => f.endsWith('.zip')).map(f => path.join(snapDir, f));

    // 按修改时间降序排序
    const stats = await Promise.all(zips.map(async f => ({ path: f, mtime: (await fs.stat(f)).mtimeMs })));
    stats.sort((a, b) => b.mtime - a.mtime);

    // 删除超标部分
    if (stats.length > maxCount) {
      const toDelete = stats.slice(maxCount);
      for (const t of toDelete) {
        await fs.unlink(t.path).catch(() => {});
      }
    }

    return stats.slice(0, maxCount).map(s => s.path);
  }

  /**
   * 全量打包工作区所有内容，排出缓存垃圾与未提交事务。附带 DevicePreferences 跨平台数据。
   * 返回生成的 ZIP 文件的临时绝对路径。
   */
  async exportToTempFile(): Promise<string | null> {
    const tempDir = os.tmpdir();
    const zipName = `BaiShou_Archive_${Date.now()}.zip`;
    const finalPath = path.join(tempDir, zipName);
    
    // 初始化 archiver 作为一个 pipe 流往本地盘写入，这能够防止内存撑爆 (OOM 修复)
    const output = createWriteStream(finalPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise(async (resolve, reject) => {
      output.on('close', () => {
        console.info(`[DataArchiveService] Exported archive stream closed (${archive.pointer()} bytes).`);
        resolve(finalPath);
      });
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      // 第一步：遍历底层数据库/工作区
      const rootDir = await this.pathProvider.getRootDirectory();
      
      const exploreDir = (currentPath: string, relativePath: string) => {
        if (!existsSync(currentPath)) return;
        const entries = readdirSync(currentPath);
        for (const entry of entries) {
           const fullPath = path.join(currentPath, entry);
           const zipRelative = relativePath ? `${relativePath}/${entry}` : entry;
           
           if (statSync(fullPath).isDirectory()) {
              // 排除快照文件夹或者其他临时文件夹，避免嵌套爆炸
              if (entry === 'snapshots' || entry === 'temp' || entry.startsWith('BaiShou_Archive')) continue;
              exploreDir(fullPath, zipRelative);
           } else {
              // 排查 SQLite 的死锁事务缓存
              if (zipRelative.endsWith('-wal') || zipRelative.endsWith('-shm') || zipRelative.endsWith('-journal')) {
                 console.debug(`[DataArchiveService] Skipping temporary SQL file: ${zipRelative}`);
                 continue;
              }
              // 利用 addFile 即用即丢流，不用读入内存
              archive.file(fullPath, { name: zipRelative });
           }
        }
      };
      
      try {
        exploreDir(rootDir, '');
      } catch (e) {
        console.error(`[DataArchiveService] Failed exploring workspace files for ZIP:`, e);
      }

      // 第二步：附着获取的 UI/设备设定到压缩包内特定节点 config/device_preferences.json
      try {
        const config = await this.devicePreferencesProvider();
        const configStr = JSON.stringify(config, null, 2);
        archive.append(configStr, { name: 'config/device_preferences.json' });

        // TODO: 可选增强 - 如果里面有头像存储也一并流式附着进去
      } catch (e) {
        console.warn(`[DataArchiveService] Failed to inject device preferences:`, e);
      }

      archive.finalize();
    });
  }

  /**
   * 从物理 ZIP 全量迁移并注入数据，并彻底重置所有的本地状态与 UI
   * @param zipPath 你选中的 ZIP 文件绝对路径
   */
  async importFromZip(zipPath: string): Promise<{ deviceConfig?: DevicePreferences, filesRestored: boolean }> {
      // 在原版里这段极度危险，需要在 UI 层锁定、关闭 DB，才能重组...
      // 我们通过 extract-zip 把内容挤到一个中转目录，以防破坏宿主系统然后发现损坏
      const stagingDir = path.join(os.tmpdir(), `baishou_restore_${Date.now()}`);
      await fs.mkdir(stagingDir, { recursive: true });

      let deviceConfig: DevicePreferences | undefined;

      try {
        // 解压 (Stream) - 这能避免巨大 zip 把 Node V8 内存爆掉
        await extract(zipPath, { dir: stagingDir });

        const configPath = path.join(stagingDir, 'config', 'device_preferences.json');
        if (existsSync(configPath)) {
          console.debug('[DataArchiveService] Recovered device_preferences.json.');
          const raw = await fs.readFile(configPath, 'utf8');
          deviceConfig = JSON.parse(raw);
          // 在替换数据之前，我们将它抽移，不把它混合入真正的数据库核心基站以免冗余
          await fs.unlink(configPath).catch(()=>null);
        }

        const rootDir = await this.pathProvider.getRootDirectory();
        
        // 我们假设在这个点上，各种调用层已经斩断了 DB Connection (见原版的流程，UI 会强制调用断开数据库，由于架构解耦，我们在这里只负责文件操作)
        await fs.rm(rootDir, { recursive: true, force: true }).catch(() => null);
        await fs.mkdir(rootDir, { recursive: true });

        // 将 staging 里的所有内容移动至 rootDir
        const copyRecursive = async (src: string, dest: string) => {
           const entries = await fs.readdir(src, { withFileTypes: true });
           for (const entry of entries) {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);
              // 跳过我们提取出的 config 目录
              if (entry.isDirectory() && entry.name === 'config' && dest === rootDir) {
                 continue;
              }
              if (entry.isDirectory()) {
                 await fs.mkdir(destPath, { recursive: true });
                 await copyRecursive(srcPath, destPath);
              } else {
                 await fs.copyFile(srcPath, destPath);
              }
           }
        };

        await copyRecursive(stagingDir, rootDir);

        // -- 【跨端修复】Vault 路径由于是写死在 json，移到新机器可能会崩溃 --
        const globalRegistryPath = path.join(await this.pathProvider.getGlobalRegistryDirectory(), 'vault_registry.json');
        if (existsSync(globalRegistryPath)) {
           const regStr = await fs.readFile(globalRegistryPath, 'utf8');
           const vaults: any[] = JSON.parse(regStr);
           let wasModified = false;

           for (const vault of vaults) {
              const vaultName = vault.name;
              const expectedPath = path.join(rootDir, vaultName);
              // 容错匹配：如果新系统的推算绝对路径不等于旧 json 留下的（例如别人是 Windows 的 C:\ 而新机器是 Mac），则重写。
              if (path.resolve(vault.path) !== path.resolve(expectedPath)) {
                 vault.path = expectedPath;
                 wasModified = true;
              }
           }
           if (wasModified) {
              await fs.writeFile(globalRegistryPath, JSON.stringify(vaults, null, 2), 'utf8');
              console.info(`[DataArchiveService] Corrected cross-platform vault paths inside registry.`);
           }
        }

        return { deviceConfig, filesRestored: true };
      } finally {
        await fs.rm(stagingDir, { recursive: true, force: true }).catch(()=>null);
      }
  }
}
