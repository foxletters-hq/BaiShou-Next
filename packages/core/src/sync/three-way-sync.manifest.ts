import * as fs from 'fs'
import * as path from 'path'
import type { SyncManifest, ManifestEntry, S3SyncConfig } from '@baishou/shared'
import {
  MANIFEST_FILENAME_V2,
  REMOTE_SNAPSHOT_FILENAME
} from './three-way-sync.constants'
import { ThreeWaySyncCore } from './three-way-sync.core'

export abstract class ThreeWaySyncManifestMixin extends ThreeWaySyncCore {
  async getConfig(): Promise<S3SyncConfig> {
    await this.loadConfig()
    return this.config
  }

  async updateConfig(config: Partial<S3SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
    await this.saveConfig()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.cloudClient.listFiles()
      return true
    } catch {
      return false
    }
  }

  async buildLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath()
    const files = await this.scanLocalFiles()
    const manifest: SyncManifest = {
      version: 2,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {}
    }

    for (const relPath of files) {
      const fullPath = path.join(vaultPath, relPath)
      try {
        const hash = await this.computeFileHash(fullPath)
        const stat = await fs.promises.stat(fullPath)
        manifest.files[relPath] = {
          hash,
          size: stat.size,
          lastModified: stat.mtimeMs
        }
      } catch {}
    }

    return manifest
  }

  async getLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath()
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2)

    if (fs.existsSync(manifestPath)) {
      const raw = await fs.promises.readFile(manifestPath, 'utf8')
      return JSON.parse(raw) as SyncManifest
    }

    return { version: 2, updatedAt: 0, deviceId: '', files: {} }
  }

  async getRemoteManifest(): Promise<SyncManifest> {
    const remoteFiles = await this.cloudClient.listFiles()
    const manifestFile = remoteFiles.find(
      (f) => f.filename === MANIFEST_FILENAME_V2 || f.filename.endsWith('/' + MANIFEST_FILENAME_V2)
    )

    if (!manifestFile) {
      return { version: 2, updatedAt: 0, deviceId: '', files: {} }
    }

    const vaultPath = await this.getVaultPath()
    const tempPath = path.join(
      vaultPath,
      '.baishou',
      `temp-remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    )
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true })
    await this.cloudClient.downloadFile(manifestFile.filename, tempPath)

    try {
      const raw = await fs.promises.readFile(tempPath, 'utf8')
      const manifest = JSON.parse(raw) as SyncManifest

      if (manifest && manifest.files) {
        const actualFilesSet = new Set<string>()
        for (const f of remoteFiles) {
          actualFilesSet.add(f.filename.replace(/\\/g, '/'))
        }

        const cleanFiles: Record<string, ManifestEntry> = {}
        for (const [relPath, entry] of Object.entries(manifest.files)) {
          const normalizedPath = relPath.replace(/\\/g, '/')
          if (actualFilesSet.has(normalizedPath)) {
            cleanFiles[normalizedPath] = entry
          } else {
            console.warn(
              `[ThreeWaySync] Remote manifest contains phantom file: ${relPath}, but it is missing on remote storage. Treating as deleted.`
            )
          }
        }
        manifest.files = cleanFiles
      }

      return manifest
    } finally {
      try {
        fs.unlinkSync(tempPath)
      } catch {}
    }
  }

  async getRemoteSnapshot(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath()
    const snapshotPath = path.join(vaultPath, '.baishou', REMOTE_SNAPSHOT_FILENAME)

    if (fs.existsSync(snapshotPath)) {
      try {
        const raw = await fs.promises.readFile(snapshotPath, 'utf8')
        return JSON.parse(raw) as SyncManifest
      } catch {}
    }

    return { version: 2, updatedAt: 0, deviceId: '', files: {} }
  }

  getLastSyncConflicts(): Promise<string[]> {
    return Promise.resolve(this.lastConflicts)
  }

  protected async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2)
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true })
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  protected async uploadManifest(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2)
    if (fs.existsSync(manifestPath)) {
      await this.cloudClient.uploadFile(manifestPath)
    }
  }

  protected async saveRemoteSnapshot(manifest: SyncManifest): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const snapshotPath = path.join(vaultPath, '.baishou', REMOTE_SNAPSHOT_FILENAME)
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true })
    await fs.promises.writeFile(snapshotPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  protected async uploadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    if (fs.existsSync(fullPath)) {
      await this.cloudClient.uploadFile(fullPath)
    }
  }

  protected async downloadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
    try {
      await this.cloudClient.downloadFile(relPath, fullPath)
    } catch (err: any) {
      const isNotFound =
        err?.code === 'NotFound' ||
        err?.statusCode === 404 ||
        err?.message?.includes('Not Found') ||
        err?.message?.includes('404')
      if (isNotFound) {
        console.warn(
          `[ThreeWaySync] Remote file is missing (NotFound): ${relPath}. Skipping download.`
        )
        return
      }
      throw err
    }
  }

  protected async deleteRemoteFile(relPath: string): Promise<void> {
    await this.cloudClient.deleteFile(relPath)
  }

  protected async deleteLocalFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    if (fs.existsSync(fullPath)) {
      if (this.versionManager) {
        try {
          await this.versionManager.backup(fullPath)
        } catch {}
      } else {
        try {
          const ext = path.extname(fullPath)
          const base = fullPath.slice(0, -ext.length || undefined)
          const ts = Date.now()
          const backupPath = `${base}.conflict-${ts}${ext}`
          await fs.promises.copyFile(fullPath, backupPath)
        } catch {}
      }
      fs.unlinkSync(fullPath)
    }
  }

  protected async backupFile(relPath: string, _hash: string): Promise<void> {
    if (!this.versionManager) return
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    if (fs.existsSync(fullPath)) {
      try {
        await this.versionManager.backup(fullPath)
      } catch {}
    }
  }
}
