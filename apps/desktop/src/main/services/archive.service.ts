import { app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import archiver from 'archiver';
import extract from 'extract-zip';

import { IArchiveService, ImportResult, VaultService } from '@baishou/core';
import { connectionManager, SettingsRepository, UserProfileRepository } from '@baishou/database';
import { logger } from '@baishou/shared';
import { getAppDb } from '../db';
import { DesktopStoragePathService } from './path.service';

export class DesktopArchiveService implements IArchiveService {
  private settingsRepo: SettingsRepository;

  constructor(
    private pathService: DesktopStoragePathService,
    private vaultService: VaultService
  ) {
    this.settingsRepo = new SettingsRepository(getAppDb());
  }

  public async exportToTempFile(): Promise<string | null> {
    const tempDir = app.getPath('temp');
    const zipFileName = `BaiShou_Full_Archive_${Date.now()}`;
    const tempPath = path.join(tempDir, `${zipFileName}.tmp`);
    const finalPath = path.join(tempDir, `${zipFileName}.zip`);

    const outputStream = fs.createWriteStream(tempPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise(async (resolve, reject) => {
      outputStream.on('close', async () => {
        try {
          await fsp.rename(tempPath, finalPath);
          resolve(finalPath);
        } catch (e) {
          try {
            await fsp.copyFile(tempPath, finalPath);
            await fsp.unlink(tempPath);
            resolve(finalPath);
          } catch (copyErr) {
            reject(copyErr);
          }
        }
      });

      archive.on('error', (err) => reject(err));
      archive.pipe(outputStream);

      try {
        const rootDir = await this.pathService.getRootDirectory();
        
        // Bundle vaults (ignoring -wal and -shm)
        async function addDirectory(dirPath: string, relativePath: string) {
          try {
            const list = await fsp.readdir(dirPath, { withFileTypes: true });
            for (const dirent of list) {
              const fullPath = path.join(dirPath, dirent.name);
              const curRelative = path.join(relativePath, dirent.name).replace(/\\/g, '/');

              if (dirent.isDirectory()) {
                if (dirent.name === 'snapshots' || dirent.name === 'temp') continue;
                await addDirectory(fullPath, curRelative);
              } else if (dirent.isFile()) {
                if (
                  dirent.name.endsWith('-wal') ||
                  dirent.name.endsWith('-shm') ||
                  dirent.name.endsWith('-journal')
                ) {
                  continue;
                }
                archive.file(fullPath, { name: curRelative });
              }
            }
          } catch (e) {
            logger.error(`Failed to pack dir ${dirPath}`, e);
          }
        }

        if (fs.existsSync(rootDir)) {
          const entities = await fsp.readdir(rootDir, { withFileTypes: true });
          for (const dirent of entities) {
            if (dirent.name === 'snapshots' || dirent.name === 'temp') continue;
            
            const fullPath = path.join(rootDir, dirent.name);
            if (dirent.isDirectory()) {
              await addDirectory(fullPath, dirent.name);
            } else if (dirent.isFile()) {
              archive.file(fullPath, { name: dirent.name });
            }
          }
        }

        // Collect Settings Data from global settings Repo created by Agent A
        // 导出全部 settings key，确保备份恢复时不丢失任何配置
        const allSettingsKeys = [
          'ai_providers', 'global_models', 'feature_settings',
          'agent_behavior', 'rag_config', 'web_search_config',
          'summary_config', 'tool_management_config', 'mcp_server_config',
          'hotkey_config', 'cloud_sync_config', 'tool_configs',
          'theme_seed_color', 'theme_mode'
        ];
        const devicePreferences: Record<string, any> = {};
        for (const key of allSettingsKeys) {
          devicePreferences[key] = await this.settingsRepo.get(key);
        }
        // 同时导出 user_profile_data
        const profileRepo = new UserProfileRepository(getAppDb());
        devicePreferences['user_profile_data'] = await profileRepo.getProfile();
        
        const configStr = JSON.stringify(devicePreferences, null, 2);
        archive.append(configStr, { name: 'config/device_preferences.json' });

        // Database Export: Copy the main SQLite Database
        const sqliteDbPath = path.join(app.getPath('userData'), 'baishou_agent.db');
        if (fs.existsSync(sqliteDbPath)) {
            try {
              const dbInstance: any = getAppDb();
              if (dbInstance?.session?.client) {
                await dbInstance.session.client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
              }
            } catch (e) {
              logger.error('Failed to checkpoint WAL:', e);
            }
            // Force checkpoint or just copy. We skip WAL/SHM as they may cause locking or bloat.
            archive.file(sqliteDbPath, { name: 'database/baishou_agent.db' });
        }

        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async exportToUserDevice(): Promise<string | null> {
    const zipPath = await this.exportToTempFile();
    if (!zipPath) return null;

    const dt = new Date();
    const ts = `${dt.getFullYear()}${(dt.getMonth()+1).toString().padStart(2,'0')}${dt.getDate().toString().padStart(2,'0')}_${dt.getHours().toString().padStart(2,'0')}${dt.getMinutes().toString().padStart(2,'0')}`;
    const defaultName = `BaiShou_Vault_Backup_${ts}.zip`;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出白守数据备份',
      defaultPath: defaultName,
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return null;

    await fsp.copyFile(zipPath, filePath);
    return filePath;
  }

  public async createSnapshot(): Promise<string | null> {
    const zipPath = await this.exportToTempFile();
    if (!zipPath) return null;
    
    // We store snapshots inside userData app path
    const snapshotDir = path.join(app.getPath('userData'), 'snapshots');
    if (!fs.existsSync(snapshotDir)) {
      await fsp.mkdir(snapshotDir, { recursive: true });
    }

    const dt = new Date();
    const ts = `${dt.getFullYear()}${(dt.getMonth()+1).toString().padStart(2,'0')}${dt.getDate().toString().padStart(2,'0')}_${dt.getHours().toString().padStart(2,'0')}${dt.getMinutes().toString().padStart(2,'0')}`;
    const snapName = `snapshot_${ts}.zip`;
    const finalSnapPath = path.join(snapshotDir, snapName);

    await fsp.copyFile(zipPath, finalSnapPath);
    fs.unlink(zipPath, () => {});
    return finalSnapPath;
  }

  public async importFromZip(zipFilePath: string, createSnapshotBefore: boolean = true): Promise<ImportResult> {
    let snapshotPath: string | undefined;

    if (createSnapshotBefore) {
      const snap = await this.createSnapshot();
      if (snap) snapshotPath = snap;
    }

    // 1. Cut off SQLite bindings to unlock file handles globally!
    await connectionManager.disconnect();
    try {
      shadowConnectionManager.disconnect();
    } catch(e) {}
    
    // We extract everything to a temporary sandbox first to inspect format safely
    const tempExtractDir = path.join(app.getPath('temp'), `archive_extract_${Date.now()}`);
    await fsp.mkdir(tempExtractDir, { recursive: true });
    
    try {
      await extract(zipFilePath, { dir: tempExtractDir });
    } catch (e) {
      // clean up if extract fails
      await fsp.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
      throw e;
    }

    const { LegacyMigrationService } = await import('./legacy-migration.service');
    const legacyService = new LegacyMigrationService();
    const isLegacy = await legacyService.isLegacyAppRoot(tempExtractDir);
    const rootDir = await this.pathService.getRootDirectory();

    if (isLegacy) {
      logger.info('ArchiveService: Detected Legacy Architecture. Initiating Legacy Migration...');
      // Note: Legacy migration expects to cleanly merge or overwrite.
      // We can securely wipe rootDir if we want a clean slate since it's a full restore.
      if (fs.existsSync(rootDir)) {
        await fsp.rm(rootDir, { recursive: true, force: true }).catch(() => {});
      }
      await fsp.mkdir(rootDir, { recursive: true });
      
      // Perform translation migration
      await legacyService.migrate(tempExtractDir, rootDir);

      // 清理旧版带过来的可能损坏的 shadow_index.db 文件
      // shadow_index 只是 Markdown 文件的缓存索引，会在 bootstrapper 中自动重建
      await this.cleanShadowIndexFiles(rootDir);
      
    } else {
      logger.info('ArchiveService: Detected Next Architecture. Restoring Standard Data...');
      
      // Original Next Version Restore Logic: Step 2: Erase existing Root
      if (fs.existsSync(rootDir)) {
        try {
          await fsp.rm(rootDir, { recursive: true, force: true });
        } catch (e) {
          logger.error('Fatal file lock error while wiping root', e);
        }
      }
      await fsp.mkdir(rootDir, { recursive: true });

      // Step 3: Move from temporary sandbox to Target Root
      async function moveAll(src: string, dest: string) {
        const entries = await fsp.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
           const srcFile = path.join(src, entry.name);
           const destFile = path.join(dest, entry.name);
           await fsp.rename(srcFile, destFile);
        }
      }
      await moveAll(tempExtractDir, rootDir);

      // 4. Remap cross-device paths in vault_registry.json
      try {
        const registryFile = path.join(rootDir, '.baishou', 'vault_registry.json');
        if (fs.existsSync(registryFile)) {
          const raw = await fsp.readFile(registryFile, 'utf8');
          const vaults: any[] = JSON.parse(raw);
          let modified = false;

          for (const v of vaults) {
            const correctPath = path.join(rootDir, v.name);
            if (v.path !== correctPath) {
              v.path = correctPath;
              modified = true;
            }
          }
          if (modified) {
            await fsp.writeFile(registryFile, JSON.stringify(vaults, null, 2), 'utf8');
          }
        }
      } catch (e) {
        logger.error('Failed to remap vault paths', e);
      }

      // 5. Restore Global configurations from config/
      try {
        const configPath = path.join(rootDir, 'config', 'device_preferences.json');
        if (fs.existsSync(configPath)) {
          const raw = await fsp.readFile(configPath, 'utf8');
          const prefs = JSON.parse(raw);

          // 恢复全部 settings key
          const allSettingsKeys = [
            'ai_providers', 'global_models', 'feature_settings',
            'agent_behavior', 'rag_config', 'web_search_config',
            'summary_config', 'tool_management_config', 'mcp_server_config',
            'hotkey_config', 'cloud_sync_config', 'tool_configs',
            'theme_seed_color', 'theme_mode'
          ];
          for (const key of allSettingsKeys) {
            if (prefs[key] !== undefined && prefs[key] !== null) {
              await this.settingsRepo.set(key, prefs[key]);
            }
          }

          // 恢复 user_profile_data
          if (prefs['user_profile_data']) {
            const profileRepo = new UserProfileRepository(getAppDb());
            await profileRepo.saveProfile(prefs['user_profile_data']);
          }
        }
        
        await fsp.rm(path.join(rootDir, 'config'), { recursive: true, force: true }).catch(() => {});
      } catch (e) {
        logger.error('Failed to restore device preferences', e);
      }

      // 5.5 Restore Database if it exists in the archive!
      try {
        const extractedDbPath = path.join(rootDir, 'database', 'baishou_agent.db');
        if (fs.existsSync(extractedDbPath)) {
          // Warning: connectionManager is disconnected. We can safely overwrite the SQLite db.
          const actualDbPath = path.join(app.getPath('userData'), 'baishou_agent.db');
          await fsp.copyFile(extractedDbPath, actualDbPath);
          await fsp.rm(path.join(rootDir, 'database'), { recursive: true, force: true }).catch(() => {});
        }
      } catch (e) {
        logger.error('Failed to restore database from archive', e);
      }
    }
    
    // Cleanup temporary extraction dir safely
    await fsp.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});

    // 6. Regenerate and reload system registry completely
    await this.vaultService.initRegistry();

    // 6.5 重新连接 Shadow DB（旧连接已经失效，新文件可能已变更）
    try {
      const { connectShadowForActiveVault } = await import('../ipc/vault.ipc');
      await connectShadowForActiveVault();
    } catch (e) {
      logger.error('Failed to reconnect Shadow DB after import:', e);
    }
    
    // 7. Global Ecosystem Wake-up! 
    // This is CRITICAL for the SSOT mechanism to perceive the newly dropped files.
    // 避免因循环引用在此进行隐式调用，需引入 bootstrapper (注意保持解耦，可从外部直接调，或在此 import)
    const { globalBootstrapper } = await import('./bootstrapper.service');
    await globalBootstrapper.fullyResyncAllEcosystems();

    return {
      fileCount: -1, // Cannot easily get file count from extract-zip syncably
      profileRestored: true,
      snapshotPath
    };
  }

  public async listSnapshots(): Promise<{filename: string, createdAt: number, size: number}[]> {
    const snapshotDir = path.join(app.getPath('userData'), 'snapshots');
    if (!fs.existsSync(snapshotDir)) return [];
    
    const files = await fsp.readdir(snapshotDir);
    const results: {filename: string, createdAt: number, size: number}[] = [];
    for (const f of files) {
      if (f.endsWith('.zip')) {
        const stat = await fsp.stat(path.join(snapshotDir, f));
        results.push({
          filename: f,
          createdAt: stat.mtimeMs,
          size: stat.size
        });
      }
    }
    return results.sort((a,b) => b.createdAt - a.createdAt);
  }

  public async deleteSnapshot(filename: string): Promise<void> {
    const p = path.join(app.getPath('userData'), 'snapshots', filename);
    if (fs.existsSync(p)) await fsp.unlink(p);
  }

  public async restoreFromSnapshot(filename: string): Promise<ImportResult> {
    const p = path.join(app.getPath('userData'), 'snapshots', filename);
    if (!fs.existsSync(p)) throw new Error('Snapshot not found');
    return this.importFromZip(p, false);
  }

  /**
   * 扫描 rootDir 下所有 vault 的 .baishou 目录，删除 shadow_index.db 及其附属文件。
   * shadow_index 是纯缓存索引，可以由 bootstrapper 的 fullScanVault 从 Markdown 文件重建。
   * 旧版备份包中携带的 shadow_index.db 可能在跨平台/跨 SQLite 版本时损坏。
   */
  private async cleanShadowIndexFiles(rootDir: string): Promise<void> {
    try {
      const entries = await fsp.readdir(rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const baishouDir = path.join(rootDir, entry.name, '.baishou');
        if (!fs.existsSync(baishouDir)) continue;

        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          const filePath = path.join(baishouDir, `shadow_index.db${suffix}`);
          try {
            if (fs.existsSync(filePath)) {
              await fsp.unlink(filePath);
              logger.info(`[ArchiveService] Cleaned shadow_index file: ${filePath}`);
            }
          } catch (e) {
            logger.error(`[ArchiveService] Failed to clean shadow_index file: ${filePath}`, e);
          }
        }
      }

      // 也检查根级 .baishou 目录
      const rootBaishou = path.join(rootDir, '.baishou');
      if (fs.existsSync(rootBaishou)) {
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          const filePath = path.join(rootBaishou, `shadow_index.db${suffix}`);
          try {
            if (fs.existsSync(filePath)) {
              await fsp.unlink(filePath);
              logger.info(`[ArchiveService] Cleaned root shadow_index file: ${filePath}`);
            }
          } catch (e) {
            logger.error(`[ArchiveService] Failed to clean root shadow_index file: ${filePath}`, e);
          }
        }
      }
    } catch (e) {
      logger.error('[ArchiveService] Failed to clean shadow index files:', e);
    }
  }
}
