import type { VersionSnapshot } from '@baishou/shared'
import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import type { IStoragePathService } from '../vault/storage-path.types'
import { VersionBackupError, VersionRestoreError, VersionNotFoundError } from './sync.errors'
import type { IVersionManager } from './version-manager.interface'

/**
 * Cross-platform light version manager (journal / summary / session).
 * Uses IFileSystem so desktop and mobile share the same write-path snapshots.
 */
export class FsVersionManager implements IVersionManager {
  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem
  ) {}

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new VersionBackupError(new Error('No active vault found'))
    }
    return vaultPath
  }

  private async getFileVersionsDir(filePath: string): Promise<string> {
    const vaultPath = await this.getVaultPath()
    return path.join(vaultPath, '.versions', filePath)
  }

  private backupBlobName(versionId: number, filePath: string): string {
    const ext = path.extname(filePath) || '.md'
    return `${versionId}${ext}`
  }

  private async resolveBackupPath(
    versionsDir: string,
    versionId: number,
    filePath: string
  ): Promise<string> {
    const preferred = path.join(versionsDir, this.backupBlobName(versionId, filePath))
    if (await this.fs.exists(preferred)) return preferred
    const legacy = path.join(versionsDir, `${versionId}.md`)
    if (await this.fs.exists(legacy)) return legacy
    return preferred
  }

  async backup(filePath: string): Promise<string> {
    try {
      const vaultPath = await this.getVaultPath()
      const fullPath = path.join(vaultPath, filePath)

      if (!(await this.fs.exists(fullPath))) {
        throw new VersionBackupError(new Error('File not found'))
      }

      const versionsDir = await this.getFileVersionsDir(filePath)
      await this.fs.mkdir(versionsDir, { recursive: true })

      const versionId = Date.now()
      const backupPath = path.join(versionsDir, this.backupBlobName(versionId, filePath))
      await this.fs.copyFile(fullPath, backupPath)

      const metaPath = path.join(versionsDir, `${versionId}.json`)
      const stat = await this.fs.stat(fullPath)
      const meta: VersionSnapshot = {
        id: versionId,
        filePath,
        size: stat.size ?? 0,
        createdAt: new Date(),
        reason: 'edit'
      }
      await this.fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8')
      return backupPath
    } catch (error) {
      if (error instanceof VersionBackupError) throw error
      throw new VersionBackupError(error instanceof Error ? error : undefined)
    }
  }

  async backupBatch(filePaths: string[]): Promise<string[]> {
    const results: string[] = []
    for (const filePath of filePaths) {
      results.push(await this.backup(filePath))
    }
    return results
  }

  async getVersions(filePath: string): Promise<VersionSnapshot[]> {
    const versionsDir = await this.getFileVersionsDir(filePath)
    if (!(await this.fs.exists(versionsDir))) return []

    let entries: string[] = []
    try {
      entries = await this.fs.readdir(versionsDir)
    } catch {
      return []
    }

    const versions: VersionSnapshot[] = []
    for (const metaFile of entries.filter((e) => e.endsWith('.json'))) {
      try {
        const raw = await this.fs.readFile(path.join(versionsDir, metaFile), 'utf8')
        versions.push(JSON.parse(raw) as VersionSnapshot)
      } catch {
        // skip corrupt meta
      }
    }
    return versions.sort((a, b) => b.id - a.id)
  }

  async restore(filePath: string, versionId: number): Promise<void> {
    const versionsDir = await this.getFileVersionsDir(filePath)
    const backupPath = await this.resolveBackupPath(versionsDir, versionId, filePath)
    const metaPath = path.join(versionsDir, `${versionId}.json`)

    if (!(await this.fs.exists(backupPath)) || !(await this.fs.exists(metaPath))) {
      throw new VersionNotFoundError(versionId)
    }

    try {
      const vaultPath = await this.getVaultPath()
      const fullPath = path.join(vaultPath, filePath)
      await this.fs.mkdir(path.dirname(fullPath), { recursive: true })
      await this.fs.copyFile(backupPath, fullPath)
    } catch (error) {
      throw new VersionRestoreError(error instanceof Error ? error : undefined)
    }
  }

  async cleanup(filePath: string, keepCount = 10): Promise<void> {
    const versions = await this.getVersions(filePath)
    if (versions.length <= keepCount) return

    const versionsDir = await this.getFileVersionsDir(filePath)
    for (const version of versions.slice(keepCount)) {
      const backupPath = await this.resolveBackupPath(versionsDir, version.id, filePath)
      const metaPath = path.join(versionsDir, `${version.id}.json`)
      try {
        if (await this.fs.exists(backupPath)) await this.fs.unlink(backupPath)
        if (await this.fs.exists(metaPath)) await this.fs.unlink(metaPath)
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
