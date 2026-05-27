import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { SyncManifest } from '@baishou/shared'
import type { ICloudSyncClient } from '../network/cloud-sync.interface'
import type { IStoragePathService } from '../vault/storage-path.types'
import { S3ConnectionError } from './sync.errors'
import { INCREMENTAL_SYNC_MANIFEST_FILENAME } from './incremental-sync.constants'

export class IncrementalSyncManifestStore {
  constructor(
    private readonly pathService: IStoragePathService,
    private readonly cloudClient: ICloudSyncClient,
    private readonly deviceId: string
  ) {}

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new Error('No active vault found')
    }
    return vaultPath
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  }

  private async scanLocalFiles(): Promise<string[]> {
    const vaultPath = await this.getVaultPath()
    const files: string[] = []

    const scan = async (dir: string, relativePath: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = path.join(relativePath, entry.name)

        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath, relPath)
          }
        } else if (!entry.name.startsWith('.')) {
          files.push(relPath.replace(/\\/g, '/'))
        }
      }
    }

    await scan(vaultPath, '')
    return files
  }

  async buildLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath()
    const files = await this.scanLocalFiles()
    const manifest: SyncManifest = {
      version: 1,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {}
    }

    for (const relPath of files) {
      const fullPath = path.join(vaultPath, relPath)
      const stat = await fs.promises.stat(fullPath)
      const hash = await this.computeFileHash(fullPath)

      manifest.files[relPath] = {
        hash,
        size: stat.size,
        lastModified: stat.mtimeMs
      }
    }

    return manifest
  }

  private async getLocalManifestPath(): Promise<string> {
    const vaultPath = await this.getVaultPath()
    return path.join(vaultPath, '.baishou', INCREMENTAL_SYNC_MANIFEST_FILENAME)
  }

  async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const manifestPath = await this.getLocalManifestPath()
    const dir = path.dirname(manifestPath)

    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  async loadLocalManifest(): Promise<SyncManifest | null> {
    const manifestPath = await this.getLocalManifestPath()

    if (!fs.existsSync(manifestPath)) {
      return null
    }

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf8')
      return JSON.parse(raw) as SyncManifest
    } catch {
      return null
    }
  }

  async getLocalManifest(): Promise<SyncManifest> {
    const saved = await this.loadLocalManifest()
    if (saved) {
      return saved
    }
    return this.buildLocalManifest()
  }

  async getRemoteManifest(): Promise<SyncManifest> {
    try {
      const files = await this.cloudClient.listFiles()
      const manifestFile = files.find(
        (f) =>
          f.filename === INCREMENTAL_SYNC_MANIFEST_FILENAME ||
          f.filename.endsWith('/' + INCREMENTAL_SYNC_MANIFEST_FILENAME)
      )

      if (!manifestFile) {
        return {
          version: 1,
          updatedAt: 0,
          deviceId: '',
          files: {}
        }
      }

      const tempPath = path.join(await this.getVaultPath(), '.baishou', 'temp-manifest.json')
      await this.cloudClient.downloadFile(manifestFile.filename, tempPath)

      const raw = await fs.promises.readFile(tempPath, 'utf8')
      await fs.promises.unlink(tempPath)

      return JSON.parse(raw) as SyncManifest
    } catch (error) {
      throw new S3ConnectionError(error instanceof Error ? error : undefined)
    }
  }

  async refreshLocalManifest(): Promise<SyncManifest> {
    const manifest = await this.buildLocalManifest()
    await this.saveLocalManifest(manifest)
    return manifest
  }

  async getRemoteSnapshot(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath()
    const snapshotPath = path.join(vaultPath, '.baishou', 'last-remote-manifest.json')

    if (fs.existsSync(snapshotPath)) {
      try {
        const raw = await fs.promises.readFile(snapshotPath, 'utf8')
        return JSON.parse(raw) as SyncManifest
      } catch {
        // 损坏则返回空 manifest
      }
    }

    return {
      version: 2,
      updatedAt: 0,
      deviceId: '',
      files: {}
    }
  }

  async saveRemoteSnapshot(manifest: SyncManifest): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const snapshotPath = path.join(vaultPath, '.baishou', 'last-remote-manifest.json')
    const dir = path.dirname(snapshotPath)

    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    await fs.promises.writeFile(snapshotPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  async uploadLocalManifestFile(): Promise<void> {
    const manifestPath = await this.getLocalManifestPath()
    await this.cloudClient.uploadFile(manifestPath)
  }
}

export class IncrementalSyncFileOps {
  constructor(
    private readonly pathService: IStoragePathService,
    private readonly cloudClient: ICloudSyncClient
  ) {}

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new Error('No active vault found')
    }
    return vaultPath
  }

  async uploadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    await this.cloudClient.uploadFile(fullPath)
  }

  async downloadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)

    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    await this.cloudClient.downloadFile(relPath, fullPath)
  }

  async backupFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const fullPath = path.join(vaultPath, relPath)
    const backupDir = path.join(vaultPath, '.versions', relPath)
    const backupFile = path.join(backupDir, `${Date.now()}.md`)

    if (fs.existsSync(fullPath)) {
      const dir = path.dirname(backupFile)
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true })
      }
      await fs.promises.copyFile(fullPath, backupFile)
    }
  }
}
