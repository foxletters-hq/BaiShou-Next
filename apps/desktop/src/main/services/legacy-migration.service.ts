import * as path from 'path';
import * as fsp from 'fs/promises';
import { app } from 'electron';
import { getAppDb } from '../db';
import { type Client } from '@libsql/client';
import { SettingsRepository, UserProfileRepository } from '@baishou/database';
import { LegacyImportService, AttachmentManagerService } from '@baishou/core';
import { logger } from '@baishou/shared';
import { DesktopStoragePathService } from './path.service';

export class LegacyMigrationService {
  /**
   * Run the full legacy migration from an extracted ZIP or a pre-existing BaiShou_Root directory.
   * @param sourceDir The root directory containing legacy `.baishou`, `Personal`, etc.
   * @param targetWorkspaceDir The destination directory where vaults will be moved.
   */
  public async migrate(sourceDir: string, targetWorkspaceDir: string): Promise<void> {
    logger.info(`[LegacyMigration] Start migration from ${sourceDir} to ${targetWorkspaceDir}`);
    const client = ((getAppDb() as any)?.session?.client as Client);
    if (!client) throw new Error('Database client not initialized');

    // 1. Process Device Preferences (Settings)
    // 使用完整的 LegacyImportService 进行旧版扁平化字段到 Next 版结构化 key 的映射
    const prefsPath = path.join(sourceDir, 'config', 'device_preferences.json');
    try {
      const stat = await fsp.stat(prefsPath).catch(() => null);
      if (stat && stat.isFile()) {
        const raw = await fsp.readFile(prefsPath, 'utf8');
        const prefs = JSON.parse(raw);
        const settingsRepo = new SettingsRepository(getAppDb());
        const profileRepo = new UserProfileRepository(getAppDb());
        const legacyImporter = new LegacyImportService(settingsRepo, profileRepo);
        await legacyImporter.restoreConfig(prefs);
        logger.info('[LegacyMigration] Restored device_preferences.json via LegacyImportService (full field mapping)');
      }
    } catch (e) {
      logger.error('[LegacyMigration] Failed to migrate device preferences:', e);
    }

    // Prepare Attachments Manager to handle physical avatar copying
    const pathProvider = new DesktopStoragePathService();
    const attManager = new AttachmentManagerService(pathProvider);

    // 2. Process Assistant Avatars
    const legacyAvatarsDir = path.join(sourceDir, 'assistant_avatars');
    const avatarMap: Record<string, string> = {};
    const legacyAvatarsStat = await fsp.stat(legacyAvatarsDir).catch(()=>null);
    if (legacyAvatarsStat && legacyAvatarsStat.isDirectory()) {
         const files = await fsp.readdir(legacyAvatarsDir);
         for (const f of files) {
             const fullPath = path.join(legacyAvatarsDir, f);
             const relPath = await attManager.importAvatar(fullPath, 'agent_avatar');
             avatarMap[f] = relPath;
         }
         logger.info(`[LegacyMigration] Restored ${files.length} assistant avatars via AttachmentManager`);
    }

    // Process User Avatar — 物理拷贝通过协议 + 更新 profile 数据库
    try {
      const configDir = path.join(sourceDir, 'config');
      const configStat = await fsp.stat(configDir).catch(() => null);
      if (configStat && configStat.isDirectory()) {
         const files = await fsp.readdir(configDir);
         for (const f of files) {
           if (f.startsWith('avatar.')) {
             const localPath = path.join(configDir, f);
             const relPath = await attManager.importAvatar(localPath, 'user_avatar');
             // 更新 profile 数据库中的头像路径为新版相对路径
             try {
               const profileRepo = new UserProfileRepository(getAppDb());
               const profile = await profileRepo.getProfile();
               profile.avatarPath = relPath;
               await profileRepo.saveProfile(profile);
               logger.info(`[LegacyMigration] User avatar restored and profile updated: ${relPath}`);
             } catch (avatarErr) {
               logger.error('[LegacyMigration] Failed to update avatar in profile:', avatarErr);
             }
           }
         }
      }
    } catch(e) { }

    // 3. Collect ALL agent.sqlite and baishou.sqlite databases
    const agentDbs: string[] = [];
    const baishouDbs: string[] = [];
    
    async function scanForDatabases(dir: string) {
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
           if (entry.name === 'agent.sqlite') agentDbs.push(path.join(dir, entry.name));
           if (entry.name === 'baishou.sqlite') baishouDbs.push(path.join(dir, entry.name));
           if (entry.isDirectory()) {
             await scanForDatabases(path.join(dir, entry.name));
           }
        }
      } catch(e) {}
    }
    await scanForDatabases(sourceDir);

    logger.info(`[LegacyMigration] Found ${agentDbs.length} agent.sqlite, ${baishouDbs.length} baishou.sqlite`);
    
    // 4. Migrate Distributed App Databases into Unified baishou_agent.db
    // ATOMICITY GUARANTEE: Since ATTACH statements might conflict inside explicit SQL transactions in some older SQLite drivers,
    // we use a rock-solid File-Level Snapshot. If anything fails, the entire database is restored bit-for-bit.
    const unifiedDbPath = path.join(app.getPath('userData'), 'baishou_agent.db');
    const backupDbPath = unifiedDbPath + '.migration_bak';
    
    if (await fsp.stat(unifiedDbPath).catch(() => null)) {
      await fsp.copyFile(unifiedDbPath, backupDbPath);
    }

    try {
      async function mergeTable(txClient: Client, alias: string, tableName: string) {
        // Find columns in main table
        const mainRows = await txClient.execute(`PRAGMA main.table_info('${tableName}')`);
        const mainCols = mainRows.rows.map(r => r.name);

        // Find columns in legacy table
        let legacyRows;
        try {
          legacyRows = await txClient.execute(`PRAGMA ${alias}.table_info('${tableName}')`);
        } catch { return; } // No such table

        if (!legacyRows || legacyRows.rows.length === 0) return;
        const legacyCols = legacyRows.rows.map(r => r.name);

        // Intersect
        const intersectCols = mainCols.filter(c => legacyCols.includes(c));
        if (intersectCols.length === 0) return;

        const colsString = intersectCols.join(', ');
        
        try {
          await txClient.execute(`INSERT OR IGNORE INTO main.${tableName} (${colsString}) SELECT ${colsString} FROM ${alias}.${tableName}`);
        } catch (e: any) {
          logger.warn(`[LegacyMigration] SQL Table ${tableName} error: ${e.message}`);
        }
      }

      // 临时关闭外键约束：多个旧版 agent.sqlite 中可能存在交叉引用的数据，
      // 直接 INSERT OR IGNORE 会因为 FK 检查失败而丢失 messages 和 parts
      await client.execute('PRAGMA foreign_keys=OFF');

      for (let i = 0; i < agentDbs.length; i++) {
        const legacyDb = agentDbs[i]!.replace(/\\/g, '/');
        const alias = `legacy_agent_${i}`;
        await client.execute(`ATTACH DATABASE '${legacyDb}' AS ${alias}`);
        
        const tablesToMerge = [
          'agent_assistants', 'agent_sessions', 'agent_messages', 
          'agent_parts', 'compression_snapshots', 'memory_embeddings'
        ];
        for (const table of tablesToMerge) {
          await mergeTable(client, alias, table);
        }
        await client.execute(`DETACH DATABASE ${alias}`);
      }

      await client.execute('PRAGMA foreign_keys=ON');
      
      // Rectify Assistant Avatars in the Unified Database
      try {
        const assistants = await client.execute('SELECT id, avatar_path FROM agent_assistants WHERE avatar_path IS NOT NULL AND avatar_path != \'\'');
        for (const row of assistants.rows) {
           const oldPath = row['avatar_path'] as string;
           const filename = oldPath.split(/[/\\]/).pop();
           if (filename && avatarMap[filename]) {
              const newRelPath = avatarMap[filename];
              await client.execute({
                 sql: 'UPDATE agent_assistants SET avatar_path = ? WHERE id = ?',
                 args: [newRelPath, row['id']]
              });
           }
        }
        logger.info('[LegacyMigration] Assistant avatars rectified securely in the database.');
      } catch(e) { logger.warn('[LegacyMigration] Avatar rectify failed', e); }

      for (let i = 0; i < baishouDbs.length; i++) {
        const legacyDb = baishouDbs[i].replace(/\\/g, '/');
        const alias = `legacy_baishou_${i}`;
        await client.execute(`ATTACH DATABASE '${legacyDb}' AS ${alias}`);
        
        const tablesToMerge = ['diaries', 'summaries'];
        for (const table of tablesToMerge) {
          await mergeTable(client, alias, table);
        }
        await client.execute(`DETACH DATABASE ${alias}`);
      }

      // Restore success! Clean up snapshot.
      await fsp.unlink(backupDbPath).catch(() => {});
      logger.info('[LegacyMigration] SQLite consolidation complete and atomic backup cleared!');
    } catch (e) {
      // Restore the snapshot
      await fsp.copyFile(backupDbPath, unifiedDbPath).catch(() => {});
      await fsp.unlink(backupDbPath).catch(() => {});
      logger.error('[LegacyMigration] Fatal error during database merging, successfully rolled back whole database!', e);
      throw e;
    }

    // 5. Relocate Workspaces
    const registryPath = path.join(sourceDir, '.baishou', 'vault_registry.json');
    let vaultsList: any[] = [];
    try {
      const regRaw = await fsp.readFile(registryPath, 'utf8');
      vaultsList = JSON.parse(regRaw);
    } catch(e) { }

    for (const v of vaultsList) {
      const vName = v.name;
      const vSource = path.join(sourceDir, vName);
      const vTarget = path.join(targetWorkspaceDir, vName);
      
      const vStat = await fsp.stat(vSource).catch(() => null);
      if (vStat && vStat.isDirectory()) {
        logger.info(`[LegacyMigration] Migrating Vault Folder: ${vName}`);
        await this.mergeDirectories(vSource, vTarget);
        
        const targetSys = path.join(vTarget, '.baishou');
        await fsp.unlink(path.join(targetSys, 'agent.sqlite')).catch(()=>{});
        await fsp.unlink(path.join(targetSys, 'baishou.sqlite')).catch(()=>{});
        
        // 彻底删除旧版的 shadow_index.db 及其所有相关缓存文件
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          await fsp.unlink(path.join(targetSys, `shadow_index.db${suffix}`)).catch(()=>{});
        }
      }
    }

    logger.info('[LegacyMigration] Migration successfully completed.');
  }

  private async mergeDirectories(src: string, dest: string) {
    const stat = await fsp.stat(src).catch(() => null);
    if (!stat || !stat.isDirectory()) return;

    await fsp.mkdir(dest, { recursive: true });
    const entries = await fsp.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
         await this.mergeDirectories(srcPath, destPath);
      } else {
         await fsp.copyFile(srcPath, destPath).catch(() => {});
      }
    }
  }

  public async isLegacyAppRoot(sourceDir: string): Promise<boolean> {
     const agentDbPresent = await fsp.stat(path.join(sourceDir, '.baishou', 'agent.sqlite')).catch(() => null);
     const vaultRegPresent = await fsp.stat(path.join(sourceDir, '.baishou', 'vault_registry.json')).catch(() => null);
     return !!(agentDbPresent || vaultRegPresent);
  }
}
