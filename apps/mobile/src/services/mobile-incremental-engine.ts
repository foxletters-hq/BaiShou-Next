import * as Crypto from 'expo-crypto'
import type { IFileSystem } from '@baishou/core-mobile'
import type { SyncManifest, S3SyncConfig } from '@baishou/shared'
import { threeWayMerge } from '../lib/three-way-merge'
import type { IStoragePathService } from '@baishou/core-mobile'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'

/** 与桌面 three-way-sync.constants 一致 */
const MANIFEST_FILENAME_V2 = 'manifest-v2.json'
const REMOTE_SNAPSHOT_FILENAME = 'last-remote-manifest-v2.json'

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

async function md5File(fileSystem: IFileSystem, filePath: string): Promise<string> {
  const b64 = await fileSystem.readFile(filePath, 'base64')
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, b64, {
    encoding: Crypto.CryptoEncoding.BASE64
  })
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
    return joinPath(vault, '.baishou', MANIFEST_FILENAME_V2)
  }

  private snapshotPath(vault: string): string {
    return joinPath(vault, '.baishou', REMOTE_SNAPSHOT_FILENAME)
  }

  async buildLocalManifest(): Promise<SyncManifest> {
    const vault = await this.vaultPath()
    const files: string[] = []

    const scan = async (dir: string, rel: string) => {
      const names = await this.fileSystem.readdir(dir)
      for (const name of names) {
        if (name.startsWith('.')) continue
        const full = joinPath(dir, name)
        const relPath = rel ? joinPath(rel, name) : name
        const info = await this.fileSystem.stat(full).catch(() => null)
        if (info?.isDirectory) {
          if (name !== 'node_modules') await scan(full, relPath)
        } else if (info?.isFile) {
          files.push(relPath)
        }
      }
    }

    await scan(vault, '')
    const manifest: SyncManifest = {
      version: 2,
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

  async loadRemoteSnapshot(): Promise<SyncManifest> {
    const vault = await this.vaultPath()
    const sp = this.snapshotPath(vault)
    if (!(await this.fileSystem.exists(sp))) {
      return { version: 2, updatedAt: 0, deviceId: '', files: {} }
    }
    try {
      return JSON.parse(await this.fileSystem.readFile(sp)) as SyncManifest
    } catch {
      return { version: 2, updatedAt: 0, deviceId: '', files: {} }
    }
  }

  async saveRemoteSnapshot(manifest: SyncManifest): Promise<void> {
    const vault = await this.vaultPath()
    const sp = this.snapshotPath(vault)
    const dir = sp.replace(/\/[^/]+$/, '')
    if (!(await this.fileSystem.exists(dir))) {
      await this.fileSystem.mkdir(dir, { recursive: true })
    }
    await this.fileSystem.writeFile(sp, JSON.stringify(manifest, null, 2))
  }

  async getRemoteManifest(client: MobileIncrementalCloudClient): Promise<SyncManifest> {
    const files = await client.listFiles()
    const hit = files.find(
      (f) =>
        f.filename === MANIFEST_FILENAME_V2 ||
        f.filename.endsWith(`/${MANIFEST_FILENAME_V2}`) ||
        f.filename.endsWith(`.baishou/${MANIFEST_FILENAME_V2}`)
    )
    if (!hit) {
      return { version: 2, updatedAt: 0, deviceId: '', files: {} }
    }
    const vault = await this.vaultPath()
    const temp = joinPath(vault, '.baishou', `temp-remote-${Date.now()}.json`)
    await client.downloadFile(hit.filename, temp)
    const raw = await this.fileSystem.readFile(temp)
    await this.fileSystem.unlink(temp)
    return JSON.parse(raw) as SyncManifest
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
    const ancestorSnapshot = await this.loadRemoteSnapshot()

    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let uploaded = 0
    let downloaded = 0
    let skipped = 0
    let deletedRemote = 0
    let deletedLocal = 0
    const conflicted: string[] = []

    let i = 0
    for (const d of decisions) {
      i++
      onProgress?.(i, decisions.length, d.filePath)
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
        console.warn(`[MobileIncremental] decision failed for ${d.filePath}`, e)
      }
    }

    this.lastConflicts = conflicted
    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(finalManifest)

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
    let i = 0
    for (const [relPath, localEntry] of entries) {
      i++
      onProgress?.(i, entries.length, relPath)
      const remoteEntry = remoteManifest.files[relPath]
      if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
        await client.uploadFile(joinPath(vault, relPath))
        uploaded++
      } else {
        skipped++
      }
    }

    await this.saveLocalManifest(localManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(localManifest)

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
    const ancestorSnapshot = await this.loadRemoteSnapshot()
    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let downloaded = 0
    let skipped = 0
    let i = 0
    for (const d of decisions) {
      i++
      onProgress?.(i, decisions.length, d.filePath)
      if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
        await client.downloadFile(d.filePath, joinPath(vault, d.filePath))
        downloaded++
      } else if (d.type === 'skip') {
        skipped++
      }
    }

    const finalManifest = await this.buildLocalManifest()
    await this.saveLocalManifest(finalManifest)
    await client.uploadFile(this.manifestPath(vault))
    await this.saveRemoteSnapshot(finalManifest)

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
