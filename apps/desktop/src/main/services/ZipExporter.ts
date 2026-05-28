import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import archiver from 'archiver'
import { SettingsRepository, UserProfileRepository, executeRawSql } from '@baishou/database'
import { logger } from '@baishou/shared'
import { getAppDb } from '../db'
import { DesktopStoragePathService } from './path.service'

/** Balance speed and size for full vault backups (level 9 is very slow on large trees). Level 1 is fastest. */
const ZIP_COMPRESSION_LEVEL = 1

const STORE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.mp3',
  '.mp4',
  '.mov',
  '.wav',
  '.avi',
  '.mkv',
  '.zip',
  '.gz',
  '.tar',
  '.rar',
  '.7z',
  '.pdf',
  '.epub'
])

function shouldStoreWithoutCompression(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return STORE_EXTENSIONS.has(ext)
}

/**
 * 负责将数据打包为 ZIP 文件，并处理本地配置、元数据和 SQLite 数据库的导出。
 */
export class ZipExporter {
  constructor(private pathService: DesktopStoragePathService) {}

  public async exportToTempFile(): Promise<string | null> {
    const tempDir = app.getPath('temp')
    const zipFileName = `BaiShou_Full_Archive_${Date.now()}`
    const finalPath = path.join(tempDir, `${zipFileName}.zip`)
    await this.exportToPath(finalPath)
    return finalPath
  }

  public async exportToPath(outputPath: string): Promise<void> {
    const outputStream = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: ZIP_COMPRESSION_LEVEL } })

    await new Promise<void>((resolve, reject) => {
      outputStream.on('close', () => resolve())
      archive.on('error', (err) => reject(err))
      archive.pipe(outputStream)

      void this.appendArchiveContents(archive)
        .then(() => archive.finalize())
        .catch(reject)
    })
  }

  private async appendArchiveContents(archive: archiver.Archiver): Promise<void> {
    const rootDir = await this.pathService.getRootDirectory()

    const addDirectory = async (dirPath: string, relativePath: string) => {
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
            const store = shouldStoreWithoutCompression(dirent.name)
            archive.file(fullPath, { name: curRelative, store } as any)
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
          const store = shouldStoreWithoutCompression(dirent.name)
          archive.file(fullPath, { name: dirent.name, store } as any)
        }
      }
    }

    const settingsRepo = new SettingsRepository(getAppDb())
    const devicePreferences: Record<string, any> = await settingsRepo.getAll()
    const profileRepo = new UserProfileRepository(getAppDb())
    devicePreferences['user_profile_data'] = await profileRepo.getProfile()

    archive.append(JSON.stringify(devicePreferences, null, 2), {
      name: 'config/device_preferences.json'
    })

    const manifest = {
      formatVersion: 1,
      appVersion: app.getVersion(),
      exportedAt: Date.now(),
      platform: process.platform
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

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
  }
}
