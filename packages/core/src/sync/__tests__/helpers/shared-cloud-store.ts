import * as fs from 'fs'
import * as path from 'path'
import type { ICloudSyncClient, SyncRecord } from '../../../network/cloud-sync.interface'

/** 多设备共享的内存「云端」对象存储 */
export class SharedCloudStore {
  private readonly objects = new Map<string, { content: Buffer; mtime: Date }>()

  put(relativePath: string, content: Buffer, mtime: Date): void {
    this.objects.set(normalizeKey(relativePath), { content, mtime })
  }

  get(relativePath: string): { content: Buffer; mtime: Date } | undefined {
    return this.objects.get(normalizeKey(relativePath))
  }

  delete(relativePath: string): void {
    this.objects.delete(normalizeKey(relativePath))
  }

  has(relativePath: string): boolean {
    return this.objects.has(normalizeKey(relativePath))
  }

  list(): Array<{ filename: string; content: Buffer; mtime: Date }> {
    return Array.from(this.objects.entries()).map(([filename, entry]) => ({
      filename,
      ...entry
    }))
  }

  clear(): void {
    this.objects.clear()
  }
}

function normalizeKey(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

/**
 * 模拟桌面/移动端的 IncrementalS3Client：保留相对同步根的完整目录结构。
 * 每个设备持有独立实例（各自 syncRoot），但可共享同一 SharedCloudStore。
 */
export class InMemoryIncrementalCloudClient implements ICloudSyncClient {
  private syncRoot: string | null = null

  constructor(private readonly store: SharedCloudStore) {}

  setSyncRoot(syncRoot: string): void {
    this.syncRoot = syncRoot
  }

  private toRelativePath(localFilePath: string): string {
    if (!this.syncRoot) {
      throw new Error('InMemoryIncrementalCloudClient: syncRoot not set')
    }
    return path.relative(this.syncRoot, localFilePath).replace(/\\/g, '/')
  }

  async uploadFile(localFilePath: string): Promise<void> {
    const rel = this.toRelativePath(localFilePath)
    const content = await fs.promises.readFile(localFilePath)
    const stat = await fs.promises.stat(localFilePath)
    this.store.put(rel, content, stat.mtime)
  }

  async downloadFile(remoteFilename: string, localDestPath: string): Promise<void> {
    const entry = this.store.get(remoteFilename)
    if (!entry) {
      const err = new Error(`NotFound: ${remoteFilename}`) as Error & { code?: string }
      err.code = 'NotFound'
      throw err
    }
    await fs.promises.mkdir(path.dirname(localDestPath), { recursive: true })
    await fs.promises.writeFile(localDestPath, entry.content)
    await fs.promises.utimes(localDestPath, entry.mtime, entry.mtime)
  }

  async listFiles(): Promise<SyncRecord[]> {
    return this.store.list().map(({ filename, content, mtime }) => ({
      filename,
      lastModified: mtime,
      sizeInBytes: content.length,
      managed: false
    }))
  }

  async deleteFile(remoteFilename: string): Promise<void> {
    this.store.delete(remoteFilename)
  }

  async renameFile(oldFilename: string, newFilename: string): Promise<void> {
    const entry = this.store.get(oldFilename)
    if (!entry) return
    this.store.put(newFilename, entry.content, entry.mtime)
    this.store.delete(oldFilename)
  }
}
