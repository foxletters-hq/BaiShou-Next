import { app, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import archiver from 'archiver';
import extract from 'extract-zip';

import { IArchiveService, ImportResult, VaultService } from '@baishou/core';
import { connectionManager, SettingsRepository } from '@baishou/database';
import { appDb } from '../db';
import { DesktopStoragePathService } from './path.service';

export class DesktopArchiveService implements IArchiveService {
  private settingsRepo: SettingsRepository;

  constructor(
    private pathService: DesktopStoragePathService,
    private vaultService: VaultService
  ) {
    this.settingsRepo = new SettingsRepository(appDb);
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
            console.error(`Failed to pack dir ${dirPath}`, e);
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
        const devicePreferences: Record<string, any> = {
          ai_providers: await this.settingsRepo.get('ai_providers'),
          global_models: await this.settingsRepo.get('global_models'),
          feature_settings: await this.settingsRepo.get('feature_settings')
        };
        
        const configStr = JSON.stringify(devicePreferences, null, 2);
        archive.append(configStr, { name: 'config/device_preferences.json' });

        // Database Export: Copy the main SQLite Database
        const sqliteDbPath = path.join(app.getPath('userData'), 'baishou_next_agent.db');
        if (fs.existsSync(sqliteDbPath)) {
            // Force checkpoint or just copy. We skip WAL/SHM as they may cause locking or bloat.
            archive.file(sqliteDbPath, { name: 'database/baishou_next_agent.db' });
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
    
    // TODO: also close global appDb if we were overwriting it, but we only update rows!

    // 2. Erase existing Vault Workspace Root
    const rootDir = await this.pathService.getRootDirectory();
    if (fs.existsSync(rootDir)) {
      try {
        await fsp.rm(rootDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Fatal file lock error while wiping root', e);
      }
    }
    await fsp.mkdir(rootDir, { recursive: true });

    // 3. Extract Archive directly into the Root Directory
    // Extract-zip doesn't support omitting root paths natively easily, so we extract directly. Wait, config/ is inside!
    // But config/ doesn't hurt to be inside the physical folder, we just parse it.
    await extract(zipFilePath, { dir: rootDir });

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
      console.error('Failed to remap vault paths', e);
    }

    // 5. Restore Global configurations from config/
    try {
      const configPath = path.join(rootDir, 'config', 'device_preferences.json');
      if (fs.existsSync(configPath)) {
        const raw = await fsp.readFile(configPath, 'utf8');
        const prefs = JSON.parse(raw);

        if (prefs.ai_providers) await this.settingsRepo.set('ai_providers', prefs.ai_providers);
        if (prefs.global_models) await this.settingsRepo.set('global_models', prefs.global_models);
        if (prefs.feature_settings) await this.settingsRepo.set('feature_settings', prefs.feature_settings);
      }
      
      // We can optionally delete the 'config' folder so it doesn't pollute the root
      await fsp.rm(path.join(rootDir, 'config'), { recursive: true, force: true }).catch(() => {});
    } catch (e) {
      console.error('Failed to restore device preferences', e);
    }

    // 5.5 Restore Database if it exists in the archive!
    try {
      const extractedDbPath = path.join(rootDir, 'database', 'baishou_next_agent.db');
      if (fs.existsSync(extractedDbPath)) {
        // Warning: connectionManager is disconnected. We can safely overwrite the SQLite db.
        const actualDbPath = path.join(app.getPath('userData'), 'baishou_next_agent.db');
        await fsp.copyFile(extractedDbPath, actualDbPath);
        // Clean up extracted folder
        await fsp.rm(path.join(rootDir, 'database'), { recursive: true, force: true }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to restore database from archive', e);
    }

    // 6. Regenerate and reload system registry completely
    await this.vaultService.initRegistry();
    
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
}
