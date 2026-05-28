import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { connectionManager, installDatabaseSchema } from '@baishou/database-desktop'
import { logger } from '@baishou/shared'
import { getAppDb } from '../db'

/**
 * 负责解析导入备份时的元数据校验、遗留旧版结构的数据清洗与兼容迁移逻辑。
 */
export class MetadataMigrator {
  /**
   * 扫描 rootDir 下所有 vault 的 .baishou 目录，删除 shadow_index.db 及其附属文件。
   * shadow_index 是纯缓存索引，会在 bootstrapper 中自动重建。
   */
  public async cleanShadowIndexFiles(rootDir: string): Promise<void> {
    try {
      const entries = await fsp.readdir(rootDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const baishouDir = path.join(rootDir, entry.name, '.baishou')
        if (!fs.existsSync(baishouDir)) continue

        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          const filePath = path.join(baishouDir, `shadow_index.db${suffix}`)
          try {
            if (fs.existsSync(filePath)) {
              await fsp.unlink(filePath)
              logger.info(`[MetadataMigrator] Cleaned shadow_index file: ${filePath}`)
            }
          } catch (e: any) {
            logger.error(`[MetadataMigrator] Failed to clean shadow_index file: ${filePath}`, e)
          }
        }
      }

      // 也检查根级 .baishou 目录
      const rootBaishou = path.join(rootDir, '.baishou')
      if (fs.existsSync(rootBaishou)) {
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          const filePath = path.join(rootBaishou, `shadow_index.db${suffix}`)
          try {
            if (fs.existsSync(filePath)) {
              await fsp.unlink(filePath)
              logger.info(`[MetadataMigrator] Cleaned root shadow_index file: ${filePath}`)
            }
          } catch (e: any) {
            logger.error(
              `[MetadataMigrator] Failed to clean root shadow_index file: ${filePath}`,
              e
            )
          }
        }
      }
    } catch (e: any) {
      logger.error('[MetadataMigrator] Failed to clean shadow index files:', e)
    }
  }

  /**
   * 安全性版本校验：前向兼容拦截，防止低版本白守客户端恢复高版本数据包
   */
  public validateManifest(manifest: any, currentFormatVersion: number): void {
    if (
      manifest &&
      typeof manifest.formatVersion === 'number' &&
      manifest.formatVersion > currentFormatVersion
    ) {
      throw new Error(
        `备份文件格式版本 (${manifest.formatVersion}) 高于当前应用支持的最大版本 (${currentFormatVersion})。请将白守更新至最新版本后再试。`
      )
    }
  }

  /**
   * 如果检测到是旧版备份包（Legacy Architecture），执行兼容迁移
   */
  public async migrateLegacyIfNecessary(
    manifest: any,
    tempExtractDir: string,
    rootDir: string
  ): Promise<boolean> {
    const { LegacyMigrationService } = await import('./legacy-migration.service')
    const legacyService = new LegacyMigrationService()
    const isLegacy = manifest ? false : await legacyService.isLegacyAppRoot(tempExtractDir)

    if (isLegacy) {
      logger.info('MetadataMigrator: Detected Legacy Architecture. Initiating Legacy Migration...')
      if (fs.existsSync(rootDir)) {
        await fsp.rm(rootDir, { recursive: true, force: true }).catch(() => {})
      }
      await fsp.mkdir(rootDir, { recursive: true })

      // 执行旧版文件翻译迁移
      await legacyService.migrate(tempExtractDir, rootDir)

      // 清理 shadow_index 文件
      await this.cleanShadowIndexFiles(rootDir)

      // 旧版恢复完毕后，立刻重新建立并激活数据库连接（先前断开了）
      try {
        const { resetAppDb } = await import('../db')
        resetAppDb()
        const restoredDb = getAppDb()
        connectionManager.setDb(restoredDb)
        // 旧版数据库同样可能缺少新表，补跑迁移
        await installDatabaseSchema(restoredDb)
        logger.info(
          '[MetadataMigrator] Legacy Database connection successfully reconnected and schema migrated.'
        )
      } catch (dbErr: any) {
        logger.error('[MetadataMigrator] Failed to reconnect database for Legacy:', dbErr)
      }
      return true
    }
    return false
  }
}
