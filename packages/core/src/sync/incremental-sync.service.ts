import type { IncrementalSyncResult } from '@baishou/shared'
import type { IIncrementalSyncService } from './incremental-sync.interface'
import type { ICloudSyncClient } from '../network/cloud-sync.interface'
import type { IStoragePathService } from '../vault/storage-path.types'
import { IncrementalSyncConfigStore } from './incremental-sync.config'
import {
  IncrementalSyncFileOps,
  IncrementalSyncManifestStore
} from './incremental-sync.manifest'
import { S3NotConfiguredError, S3SyncError } from './sync.errors'

export class IncrementalSyncServiceImpl implements IIncrementalSyncService {
  private readonly configStore: IncrementalSyncConfigStore
  private readonly manifestStore: IncrementalSyncManifestStore
  private readonly fileOps: IncrementalSyncFileOps
  private lastConflicts: string[] = []

  constructor(
    pathService: IStoragePathService,
    private readonly cloudClient: ICloudSyncClient,
    deviceId: string
  ) {
    this.configStore = new IncrementalSyncConfigStore(pathService)
    this.manifestStore = new IncrementalSyncManifestStore(pathService, cloudClient, deviceId)
    this.fileOps = new IncrementalSyncFileOps(pathService, cloudClient)
  }

  async getConfig() {
    await this.configStore.loadConfig()
    return { ...this.configStore.config }
  }

  async updateConfig(config: Partial<typeof this.configStore.config>) {
    Object.assign(this.configStore.config, config)
    await this.configStore.saveConfig()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.cloudClient.listFiles()
      return true
    } catch {
      return false
    }
  }

  private createEmptyResult(): IncrementalSyncResult {
    return {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      deletedRemote: [],
      deletedLocal: [],
      duration: 0,
      sessionId: ''
    }
  }

  async sync(): Promise<IncrementalSyncResult> {
    await this.configStore.loadConfig()
    if (!this.configStore.config.enabled) {
      throw new S3NotConfiguredError()
    }

    const startTime = Date.now()
    const result = this.createEmptyResult()

    try {
      const localManifest = await this.manifestStore.buildLocalManifest()
      const remoteManifest = await this.manifestStore.getRemoteManifest()

      const localFiles = Object.keys(localManifest.files)
      const remoteFiles = Object.keys(remoteManifest.files)
      const allFiles = new Set([...localFiles, ...remoteFiles])

      for (const relPath of allFiles) {
        const localEntry = localManifest.files[relPath]
        const remoteEntry = remoteManifest.files[relPath]

        if (!localEntry && remoteEntry) {
          await this.fileOps.downloadFile(relPath)
          result.downloaded.push(relPath)
        } else if (localEntry && !remoteEntry) {
          await this.fileOps.uploadFile(relPath)
          result.uploaded.push(relPath)
        } else if (localEntry && remoteEntry) {
          if (localEntry.hash === remoteEntry.hash) {
            result.skipped.push(relPath)
          } else {
            result.conflicted.push(relPath)

            if (localEntry.lastModified > remoteEntry.lastModified) {
              await this.fileOps.uploadFile(relPath)
              result.uploaded.push(relPath)
            } else {
              await this.fileOps.backupFile(relPath)
              await this.fileOps.downloadFile(relPath)
              result.downloaded.push(relPath)
            }
          }
        }
      }

      await this.manifestStore.saveLocalManifest(localManifest)
      await this.manifestStore.uploadLocalManifestFile()
      await this.manifestStore.saveRemoteSnapshot(localManifest)

      this.lastConflicts = result.conflicted
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      throw new S3SyncError('Sync failed', error instanceof Error ? error : undefined)
    }
  }

  async uploadOnly(): Promise<IncrementalSyncResult> {
    await this.configStore.loadConfig()
    if (!this.configStore.config.enabled) {
      throw new S3NotConfiguredError()
    }

    const startTime = Date.now()
    const result = this.createEmptyResult()

    try {
      const localManifest = await this.manifestStore.buildLocalManifest()
      const remoteManifest = await this.manifestStore.getRemoteManifest()

      for (const [relPath, localEntry] of Object.entries(localManifest.files)) {
        const remoteEntry = remoteManifest.files[relPath]

        if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
          await this.fileOps.uploadFile(relPath)
          result.uploaded.push(relPath)
        } else {
          result.skipped.push(relPath)
        }
      }

      await this.manifestStore.saveLocalManifest(localManifest)
      await this.manifestStore.uploadLocalManifestFile()
      await this.manifestStore.saveRemoteSnapshot(localManifest)

      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      throw new S3SyncError('Upload failed', error instanceof Error ? error : undefined)
    }
  }

  async downloadOnly(): Promise<IncrementalSyncResult> {
    await this.configStore.loadConfig()
    if (!this.configStore.config.enabled) {
      throw new S3NotConfiguredError()
    }

    const startTime = Date.now()
    const result = this.createEmptyResult()

    try {
      const localManifest = await this.manifestStore.buildLocalManifest()
      const remoteManifest = await this.manifestStore.getRemoteManifest()

      for (const [relPath, remoteEntry] of Object.entries(remoteManifest.files)) {
        const localEntry = localManifest.files[relPath]

        if (!localEntry || localEntry.hash !== remoteEntry.hash) {
          if (localEntry) {
            await this.fileOps.backupFile(relPath)
          }
          await this.fileOps.downloadFile(relPath)
          result.downloaded.push(relPath)
        } else {
          result.skipped.push(relPath)
        }
      }

      await this.manifestStore.saveLocalManifest(localManifest)
      await this.manifestStore.saveRemoteSnapshot(localManifest)

      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      throw new S3SyncError('Download failed', error instanceof Error ? error : undefined)
    }
  }

  getLocalManifest() {
    return this.manifestStore.getLocalManifest()
  }

  getRemoteManifest() {
    return this.manifestStore.getRemoteManifest()
  }

  refreshLocalManifest() {
    return this.manifestStore.refreshLocalManifest()
  }

  getLastSyncConflicts(): Promise<string[]> {
    return Promise.resolve(this.lastConflicts)
  }

  getRemoteSnapshot() {
    return this.manifestStore.getRemoteSnapshot()
  }

  buildLocalManifest() {
    return this.manifestStore.buildLocalManifest()
  }
}
