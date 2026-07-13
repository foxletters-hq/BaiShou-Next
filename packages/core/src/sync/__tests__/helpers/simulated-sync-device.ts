import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { IncrementalSyncRunOptions, S3SyncConfig } from '@baishou/shared'
import {
  DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  SYNC_CONFIG_FILENAME,
  SYNC_MANIFEST_VERSION,
  SYNC_REMOTE_SNAPSHOT_FILENAME,
  SYNC_STORAGE_ID_FILENAME,
  getIncrementalSyncStorageId
} from '@baishou/shared'
import type { IStoragePathService } from '../../../vault/storage-path.types'
import { ThreeWaySyncService } from '../../three-way-sync.service'
import { GhostDownloadCloudClient } from './ghost-download-cloud-client'
import { InMemoryIncrementalCloudClient, SharedCloudStore } from './shared-cloud-store'

const DEFAULT_TEST_CONFIG: S3SyncConfig = {
  enabled: true,
  target: 's3',
  endpoint: 'https://s3.test.local',
  region: 'us-east-1',
  bucket: 'baishou-test',
  path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
  accessKey: 'test-ak',
  secretKey: 'test-sk',
  fileConcurrency: 3,
  chunkConcurrency: 3,
  maxDivergencePercent: 100
}

export type SimulatedSyncDeviceOptions = {
  deviceId: string
  cloudStore: SharedCloudStore
  config?: Partial<S3SyncConfig>
  /** 使用可模拟下载 404 的云端客户端 */
  ghostDownloadClient?: boolean
}

/** 在临时目录中模拟一台设备的 vault + ThreeWaySyncService */
export class SimulatedSyncDevice {
  readonly rootDir: string
  readonly vaultDir: string
  readonly cloud: InMemoryIncrementalCloudClient | GhostDownloadCloudClient
  readonly service: ThreeWaySyncService
  private readonly config: S3SyncConfig

  constructor(options: SimulatedSyncDeviceOptions) {
    this.rootDir = fs.mkdtempSync(path.join(os.tmpdir(), `baishou-sync-e2e-${options.deviceId}-`))
    this.vaultDir = path.join(this.rootDir, 'Personal')
    fs.mkdirSync(this.vaultDir, { recursive: true })

    this.config = { ...DEFAULT_TEST_CONFIG, ...options.config }
    fs.writeFileSync(
      path.join(this.rootDir, SYNC_CONFIG_FILENAME),
      JSON.stringify(this.config, null, 2),
      'utf8'
    )

    this.cloud = options.ghostDownloadClient
      ? new GhostDownloadCloudClient(options.cloudStore)
      : new InMemoryIncrementalCloudClient(options.cloudStore)
    this.cloud.setSyncRoot(this.rootDir)

    const pathService = {
      getRootDirectory: async () => this.rootDir,
      getActiveVaultPath: async () => this.vaultDir
    } as IStoragePathService

    this.service = new ThreeWaySyncService(pathService, this.cloud, options.deviceId)
  }

  /** 写入同步范围内的文件（相对同步根路径，如 Personal/Journals/a.md） */
  async writeFile(relPath: string, content: string, mtimeMs?: number): Promise<void> {
    const fullPath = path.join(this.rootDir, relPath)
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.promises.writeFile(fullPath, content, 'utf8')
    if (mtimeMs != null) {
      const mtime = new Date(mtimeMs)
      await fs.promises.utimes(fullPath, mtime, mtime)
    }
  }

  async readFile(relPath: string): Promise<string> {
    return fs.promises.readFile(path.join(this.rootDir, relPath), 'utf8')
  }

  async deleteFile(relPath: string): Promise<void> {
    const fullPath = path.join(this.rootDir, relPath)
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath)
    }
  }

  fileExists(relPath: string): boolean {
    return fs.existsSync(path.join(this.rootDir, relPath))
  }

  /** 写入污染的祖先快照（模拟未上云文件被记进 ancestor） */
  async plantAncestorSnapshot(
    files: Record<string, { hash: string; size: number; lastModified: number }>
  ): Promise<void> {
    const metaDir = path.join(this.rootDir, '.baishou')
    await fs.promises.mkdir(metaDir, { recursive: true })
    const snapshot = {
      version: SYNC_MANIFEST_VERSION,
      updatedAt: Date.now(),
      deviceId: 'polluted',
      files,
      removed: {}
    }
    await fs.promises.writeFile(
      path.join(metaDir, SYNC_REMOTE_SNAPSHOT_FILENAME),
      JSON.stringify(snapshot, null, 2),
      'utf8'
    )
    await fs.promises.writeFile(
      path.join(metaDir, SYNC_STORAGE_ID_FILENAME),
      getIncrementalSyncStorageId(this.config),
      'utf8'
    )
  }

  md5Of(relPath: string): string {
    const buf = fs.readFileSync(path.join(this.rootDir, relPath))
    return crypto.createHash('md5').update(buf).digest('hex')
  }

  sync(runOptions?: IncrementalSyncRunOptions) {
    return this.service.sync(undefined, runOptions)
  }

  planSync(runOptions?: IncrementalSyncRunOptions) {
    return this.service.planSync(
      {
        registeredVaults: ['Personal'],
        diskVaultNames: ['Personal'],
        activeVaultName: 'Personal'
      },
      runOptions
    )
  }

  getRemoteManifest() {
    return this.service.getRemoteManifest()
  }

  buildLocalManifest() {
    return this.service.buildLocalManifest()
  }

  markGhostDownload(relPath: string): void {
    if (this.cloud instanceof GhostDownloadCloudClient) {
      this.cloud.markGhostDownload(relPath)
    } else {
      throw new Error('markGhostDownload requires ghostDownloadClient: true')
    }
  }

  destroy(): void {
    fs.rmSync(this.rootDir, { recursive: true, force: true })
  }
}
