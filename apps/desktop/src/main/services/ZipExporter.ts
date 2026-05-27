import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import archiver from 'archiver'
import {
  SettingsRepository,
  UserProfileRepository,
  executeRawSql
} from '@baishou/database'
import { logger } from '@baishou/shared'
import { getAppDb } from '../db'
import { DesktopStoragePathService } from './path.service'

/**
 * 负责将数据打包为 ZIP 文件，并处理本地配置、元数据和 SQLite 数据库的导出。
 */
export class ZipExporter {
  constructor(private pathService: DesktopStoragePathService) {}

  public async exportToTempFile(): Promise<string | null> {
    const tempDir = app.getPath('temp')
    const zipFileName = `BaiShou_Full_Archive_${Date.now()}`
    const tempPath = path.join(tempDir, `${zipFileName}.tmp`)
    const finalPath = path.join(tempDir, `${zipFileName}.zip`)

    const outputStream = fs.createWriteStream(tempPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise(async (resolve, reject) => {
      outputStream.on('close', async () => {
        try {
          await fsp.rename(tempPath, finalPath)
          resolve(finalPath)
        } catch (e) {
          try {
            await fsp.copyFile(tempPath, finalPath)
            await fsp.unlink(tempPath)
            resolve(finalPath)
          } catch (copyErr) {
            reject(copyErr)
          }
        }
      })

      archive.on('error', (err) => reject(err))
      archive.pipe(outputStream)

      try {
        const rootDir = await this.pathService.getRootDirectory()

        // Bundle vaults (ignoring -wal and -shm)
        async function addDirectory(dirPath: string, relativePath: string) {
          try {
            const list = await fsp.readdir(dirPath, { withFileTypes: true })
            for (const dirent of list) {
              const fullPath = path.join(dirPath, dirent.name)
              const curRelative = path.join(relativePath, dirent.name).replace(/\\/g, '/')

              if (dirent.isDirectory()) {
                if (dirent.name === 'snapshots' || dirent.name === 'temp') continue
                await addDirectory(fullPath, curRelative)
              } else if (dirent.isFile()) {
                if (
                  dirent.name.endsWith('-wal') ||
                  dirent.name.endsWith('-shm') ||
                  dirent.name.endsWith('-journal')
                ) {
                  continue
                }
                archive.file(fullPath, { name: curRelative })
              }
            }
          } catch (e: any) {
            logger.error(`Failed to pack dir ${dirPath}`, e)
          }
        }

        if (fs.existsSync(rootDir)) {
          const entities = await fsp.readdir(rootDir, { withFileTypes: true })
          for (const dirent of entities) {
            if (dirent.name === 'snapshots' || dirent.name === 'temp') continue

            const fullPath = path.join(rootDir, dirent.name)
            if (dirent.isDirectory()) {
              await addDirectory(fullPath, dirent.name)
            } else if (dirent.isFile()) {
              const lowerName = dirent.name.toLowerCase()
              if (
                lowerName.endsWith('-wal') ||
                lowerName.endsWith('-shm') ||
                lowerName.endsWith('-journal')
              ) {
                continue
              }
              archive.file(fullPath, { name: dirent.name })
            }
          }
        }

        // 全量导出所有 system_settings 表中的配置
        const settingsRepo = new SettingsRepository(getAppDb())
        const devicePreferences: Record<string, any> = await settingsRepo.getAll()
        // 同时导出 user_profile_data
        const profileRepo = new UserProfileRepository(getAppDb())
        devicePreferences['user_profile_data'] = await profileRepo.getProfile()

        const configStr = JSON.stringify(devicePreferences, null, 2)
        archive.append(configStr, { name: 'config/device_preferences.json' })

        // 导出 manifest.json 元数据，包括应用版本等信息
        const manifest = {
          formatVersion: 1,
          appVersion: app.getVersion(),
          exportedAt: Date.now(),
          platform: process.platform
        }
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

        // Database Export: Copy the main SQLite Database
        const sqliteDbPath = path.join(app.getPath('userData'), 'baishou_agent.db')
        if (fs.existsSync(sqliteDbPath)) {
          try {
            const dbInstance: any = getAppDb()
            if (dbInstance?.session?.client) {
              await executeRawSql(dbInstance.session.client, 'PRAGMA wal_checkpoint(TRUNCATE)')
            }
          } catch (e: any) {
            logger.error('Failed to checkpoint WAL:', e)
          }
          archive.file(sqliteDbPath, { name: 'database/baishou_agent.db' })
        }

        await archive.finalize()
      } catch (err) {
        reject(err)
      }
    })
  }
}
