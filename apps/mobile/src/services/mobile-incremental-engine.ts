import * as Crypto from 'expo-crypto'
import type { IFileSystem } from '@baishou/core-mobile'
import type { SyncManifest, S3SyncConfig, ManifestEntry } from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  getIncrementalSyncStorageId,
  limitExecute,
  SYNC_MANIFEST_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME,
  threeWayMerge
} from '@baishou/shared'
import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory
} from '@baishou/shared'
import type { IStoragePathService } from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'

export type MobileIncrementalSyncOutcome = {
  uploaded: number
  downloaded: number
  conflicts: number
  skipped: number
  deletedRemote: number
  deletedLocal: number
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/$/, '')
      return p.replace(/^\//, '').replace(/\/$/, '')
    })
    .filter(Boolean)
    .join('/')
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** 与桌面一致：文件原始字节 MD5 → hex */
async function md5File(fileSystem: IFileSystem, filePath: string): Promise<string> {
  const b64 = await fileSystem.readFile(filePath, 'base64')
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.MD5, base64ToBytes(b64))
  return bytesToHex(new Uint8Array(digest))
}

export class MobileIncrementalEngine {
  private lastConflicts: string[] = []

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem,
    private readonly deviceId: string
  ) {}

  getLastConflicts(): string[] {
    return [...this.lastConflicts]
  }

  private async vaultPath(): Promise<string> {
    const p = await this.pathService.getActiveVaultPath()
    if (!p) throw new Error('No active vault found')
    return p
  }

  private manifestPath(vault: string): string {
    return joinPath(vault, '.baishou', SYNC_MANIFEST_FILENAME)
  }

  private snapshotPath(vault: string): string {
    return joinPath(vault, '.baishou', SYNC_REMOTE_SNAPSHOT_FILENAME)
  }

  async buildLocalManifest(): Promise<SyncManifest> {
    const vault = await this.vaultPath()
    const files: string[] = []

    const scan = async (dir: string, rel: string) => {
      const names = await this.fileSystem.readdir(dir)
      for (const name of names) {
        const full = joinPath(dir, name)
        const relPath = rel ? joinPath(rel, name) : name
        const info = await this.fileSystem.stat(full).catch(() => null)
        if (!info) continue
        if (info?.isDirectory) {
          if (shouldScanIncrementalSyncDirectory(name, relPath)) {
            await scan(full, relPath)
          }
        } else if (info?.isFile && shouldIncludeIncrementalSyncFile(name, relPath)) {
          files.push(relPath)
        }
      }
    }

    await scan(vault, '')
    const manifest: SyncManifest = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {}
    }

    for (const relPath of files) {
      const full = joinPath(vault, relPath)
      try {
        const info = await this.fileSystem.stat(full)
        const hash = await md5File(this.fileSystem, full)
        manifest.files[relPath] = {
          hash,
          size: info.size ?? 0,
          lastModified: info.mtimeMs ?? Date.now()
        }
      } catch {
        // skip unreadable
      }
    }
    return manifest
  }

  async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const vault = await this.vaultPath()
    const mp = this.manifestPath(vault)
    const dir = mp.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(dir))) {
      await this.fileSystem.mkdir(dir, { recursive: true })
    }
    await this.fileSystem.writeFile(mp, JSON.stringify(manifest, null, 2))
  }

  private storageIdPath(vault: string): string {
    return joinPath(vault, '.baishou', SYNC_STORAGE_ID_FILENAME)
  }

  private emptyManifest(): SyncManifest {
    return { version: SYNC_MANIFEST_VERSION, updatedAt: 0, deviceId: '', files: {} }
  }

  async loadRemoteSnapshot(config: S3SyncConfig): Promise<SyncManifest> {
    const vault = await this.vaultPath()
    const sp = this.snapshotPath(vault)
    if (!(await this.fileSystem.exists(sp))) {
      return this.emptyManifest()
    }

    const storageIdPath = this.storageIdPath(vault)
    const currentStorageId = getIncrementalSyncStorageId(config)
    if (await this.fileSystem.exists(storageIdPath)) {
      try {
        const savedId = (await this.fileSystem.readFile(storageIdPath)).trim()
        if (savedId !== currentStorageId) {
          return this.emptyManifest()
        }
      } catch {
        return this.emptyManifest()
      }
    } else {
      return this.emptyManifest()
    }

    try {
      return JSON.parse(await this.fileSystem.readFile(sp)) as SyncManifest
    } catch {
      return this.emptyManifest()
    }
  }

  async saveRemoteSnapshot(manifest: SyncManifest, config: S3SyncConfig): Promise<void> {
    const vault = await this.vaultPath()
    const sp = this.snapshotPath(vault)
    const dir = sp.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(dir))) {
      await this.fileSystem.mkdir(dir, { recursive: true })
    }
    await this.fileSystem.writeFile(sp, JSON.stringify(manifest, null, 2))
    await this.fileSystem.writeFile(
      this.storageIdPath(vault),
      getIncrementalSyncStorageId(config)
    )
  }

  async getRemoteManifest(client: MobileIncrementalCloudClient): Promise<SyncManifest> {
    const files = await client.listFiles()
    const actualFilesSet = new Set(files.map((f) => f.filename.replace(/\\/g, '/')))
    const hit = files.find(
      (f) =>
        f.filename === SYNC_MANIFEST_FILENAME ||
        f.filename.endsWith(`/${SYNC_MANIFEST_FILENAME}`) ||
        f.filename.endsWith(`.baishou/${SYNC_MANIFEST_FILENAME}`)
    )
    if (!hit) {
      return this.emptyManifest()
    }
    const temp = `${getAppCacheDirectory()}temp-remote-${Date.now()}.json`
    await client.downloadFile(hit.filename, temp)
    const raw = await this.fileSystem.readFile(temp)
    await this.fileSystem.unlink(temp)
    const manifest = JSON.parse(raw) as SyncManifest

    if (manifest?.files) {
      const cleanFiles: Record<string, ManifestEntry> = {}
      for (const [relPath, entry] of Object.entries(manifest.files)) {
        const normalizedPath = relPath.replace(/\\/g, '/')
        if (actualFilesSet.has(normalizedPath)) {
          cleanFiles[normalizedPath] = entry
        }
      }
      manifest.files = cleanFiles
    }

    return manifest
  }

  private async backupLocalFile(vault: string, relPath: string): Promise<void> {
    const src = joinPath(vault, relPath)
    if (!(await this.fileSystem.exists(src))) return
    const backupFile = joinPath(vault, '.versions', relPath, `${Date.now()}.bak`)
    const bdir = backupFile.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(bdir))) {
      await this.fileSystem.mkdir(bdir, { recursive: true })
    }
    await this.fileSystem.copyFile(src, backupFile)
  }

  /**
   * 三向合并增量同步（对齐桌面 ThreeWaySyncService.sync）
   */
  async syncThreeWay(
    config: S3SyncConfig,
    onProgress?: (current: number, total: number, text: string) => void
  ): Promise<MobileIncrementalSyncOutcome> {
    const vault = await this.vaultPath()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(vault)

    const localManifest = await this.buildLocalManifest()
    const remoteManifest = await this.getRemoteManifest(client)
    assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config)
    const ancestorSnapshot = await this.loadRemoteSnapshot(config)

    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let uploaded = 0
    let downloaded = 0
    let skipped = 0
    let deletedRemote = 0
    let deletedLocal = 0
    const conflicted: string[] = []
    const failures: string[] = []

    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(decisions, fileConcurrency, async (d) => {
      completed++
      onProgress?.(completed, decisions.length, d.filePath)
      try {
        switch (d.type) {
          case 'upload':
            await client.uploadFile(joinPath(vault, d.filePath))
            uploaded++
            break
          case 'download':
            await client.downloadFile(d.filePath, joinPath(vault, d.filePath))
            downloaded++
            break
          case 'delete-remote':
            await client.deleteFile(d.filePath)
            deletedRemote++
            break
          case 'delete-local': {
            const fp = joinPath(vault, d.filePath)
            await this.fileSystem.unlink(fp)
            deletedLocal++
            break
          }
          case 'conflict-resolved':
            conflicted.push(d.filePath)
            if (d.direction === 'upload') {
              await this.backupLocalFile(vault, d.filePath)
              await client.uploadFile(joinPath(vault, d.filePath))
              uploaded++
            } else {
              await this.backupLocalFile(vault, d.filePath)
              await client.downloadFile(d.filePath, joinPath(vault, d.filePath))
              downloaded++
            }
            break
          case 'skip':
            skipped++
            break
        }
      } catch (e) {
        failures.push(d.filePath)
        console.warn(`[MobileIncremental] decision failed for ${d.filePath}`, e)
      }
    })

    if (failures.length > 0) {
      const preview = failures.slice(0, 3).join(', ')
      const suffix = failures.length > 3 ? '...' : ''
      throw new Error(`Sync failed for ${failures.length} file(s): ${preview}${suffix}`)
    }

    this.lastConflicts = conflicted
    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(finalManifest, config)

    return {
      uploaded,
      downloaded,
      conflicts: conflicted.length,
      skipped,
      deletedRemote,
      deletedLocal
    }
  }

  /** 仅上传本地变更（对齐桌面 uploadOnly） */
  async uploadOnly(
    config: S3SyncConfig,
    onProgress?: (current: number, total: number, text: string) => void
  ): Promise<MobileIncrementalSyncOutcome> {
    const vault = await this.vaultPath()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(vault)

    const localManifest = await this.buildLocalManifest()
    const remoteManifest = await this.getRemoteManifest(client)
    const entries = Object.entries(localManifest.files)

    let uploaded = 0
    let skipped = 0
    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(entries, fileConcurrency, async ([relPath, localEntry]) => {
      completed++
      onProgress?.(completed, entries.length, relPath)
      const remoteEntry = remoteManifest.files[relPath]
      if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
        await client.uploadFile(joinPath(vault, relPath))
        uploaded++
      } else {
        skipped++
      }
    })

    await this.saveLocalManifest(localManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(localManifest, config)

    return {
      uploaded,
      downloaded: 0,
      conflicts: 0,
      skipped,
      deletedRemote: 0,
      deletedLocal: 0
    }
  }

  /** 仅下载远程变更（对齐桌面 downloadOnly，含三向删除传播中的 download） */
  async downloadOnly(
    config: S3SyncConfig,
    onProgress?: (current: number, total: number, text: string) => void
  ): Promise<MobileIncrementalSyncOutcome> {
    const vault = await this.vaultPath()
    const client = new MobileIncrementalCloudClient(config, this.fileSystem)
    client.setVaultPath(vault)

    const localManifest = await this.buildLocalManifest()
    const remoteManifest = await this.getRemoteManifest(client)
    assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config)
    const ancestorSnapshot = await this.loadRemoteSnapshot(config)
    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let downloaded = 0
    let skipped = 0
    const fileConcurrency = config.fileConcurrency || 5
    let completed = 0

    await limitExecute(decisions, fileConcurrency, async (d) => {
      completed++
      onProgress?.(completed, decisions.length, d.filePath)
      if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
        await client.downloadFile(d.filePath, joinPath(vault, d.filePath))
        downloaded++
      } else if (d.type === 'skip') {
        skipped++
      }
    })

    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(finalManifest, config)

    return {
      uploaded: 0,
      downloaded,
      conflicts: 0,
      skipped,
      deletedRemote: 0,
      deletedLocal: 0
    }
  }
}
