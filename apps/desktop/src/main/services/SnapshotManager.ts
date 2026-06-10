import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { logger } from '@baishou/shared'
import { getAppDb } from '../db'
import { SettingsRepository } from '@baishou/database-desktop'

export class SnapshotManager {
  private getSnapshotDir(): string {
    return path.join(app.getPath('userData'), 'snapshots')
  }

  public async create(tempZipPath: string): Promise<string | null> {
    const snapshotDir = this.getSnapshotDir()
    if (!fs.existsSync(snapshotDir)) {
      await fsp.mkdir(snapshotDir, { recursive: true })
    }

    const dt = new Date()
    const ts = `${dt.getFullYear()}${(dt.getMonth() + 1).toString().padStart(2, '0')}${dt.getDate().toString().padStart(2, '0')}_${dt.getHours().toString().padStart(2, '0')}${dt.getMinutes().toString().padStart(2, '0')}`
    const snapName = `snapshot_${ts}.zip`
    const finalSnapPath = path.join(snapshotDir, snapName)

    await fsp.copyFile(tempZipPath, finalSnapPath)
    await fsp.unlink(tempZipPath).catch(() => {})

    try {
      const settingsRepo = new SettingsRepository(getAppDb())
      const cloudSync = await settingsRepo.get<any>('cloud_sync_config')
      const maxSnapshots =
        cloudSync && typeof cloudSync.maxSnapshotCount === 'number' ? cloudSync.maxSnapshotCount : 5

      if (maxSnapshots !== -1) {
        const files = await fsp.readdir(snapshotDir)
        const zipFiles: { name: string; mtime: number }[] = []
        for (const f of files) {
          if (f.toLowerCase().endsWith('.zip') && f.startsWith('snapshot_')) {
            const stat = await fsp.stat(path.join(snapshotDir, f))
            zipFiles.push({ name: f, mtime: stat.mtimeMs })
          }
        }

        zipFiles.sort((a, b) => a.mtime - b.mtime)

        if (zipFiles.length > maxSnapshots) {
          const toDelete = zipFiles.slice(0, zipFiles.length - maxSnapshots)
          for (const file of toDelete) {
            await fsp.unlink(path.join(snapshotDir, file.name)).catch((err) => {
              logger.error(`Failed to auto-clean old snapshot ${file.name}:`, err as any)
            })
          }
        }
      }
    } catch (err) {
      logger.error('Error during snapshot auto-cleaning:', err as any)
    }

    return finalSnapPath
  }

  public async list(): Promise<{ filename: string; createdAt: number; size: number }[]> {
    const snapshotDir = this.getSnapshotDir()
    if (!fs.existsSync(snapshotDir)) return []

    const files = await fsp.readdir(snapshotDir)
    const results: { filename: string; createdAt: number; size: number }[] = []
    for (const f of files) {
      if (f.endsWith('.zip') && f.startsWith('snapshot_')) {
        const stat = await fsp.stat(path.join(snapshotDir, f))
        results.push({
          filename: f,
          createdAt: stat.mtimeMs,
          size: stat.size
        })
      }
    }
    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  public async delete(filename: string): Promise<void> {
    const p = path.join(this.getSnapshotDir(), filename)
    if (fs.existsSync(p)) await fsp.unlink(p)
  }

  public async rename(oldName: string, newName: string): Promise<void> {
    const safeOldName = path.basename(oldName)
    let safeNewName = path.basename(newName)

    if (!safeNewName.toLowerCase().endsWith('.zip')) {
      safeNewName += '.zip'
    }

    const snapshotDir = this.getSnapshotDir()
    const oldPath = path.join(snapshotDir, safeOldName)
    const newPath = path.join(snapshotDir, safeNewName)

    if (!fs.existsSync(oldPath)) {
      throw new Error(`Snapshot ${oldName} does not exist.`)
    }

    if (fs.existsSync(newPath)) {
      throw new Error(`A snapshot named "${safeNewName}" already exists.`)
    }

    await fsp.rename(oldPath, newPath)
  }

  public async batchDelete(filenames: string[]): Promise<number> {
    let deletedCount = 0
    const snapshotDir = this.getSnapshotDir()
    for (const f of filenames) {
      const safeName = path.basename(f)
      const p = path.join(snapshotDir, safeName)
      if (fs.existsSync(p)) {
        await fsp.unlink(p)
        deletedCount++
      }
    }
    return deletedCount
  }
}
