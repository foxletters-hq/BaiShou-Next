import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ThreeWaySyncService } from '../three-way-sync.service'
import type { ICloudSyncClient } from '../../network/cloud-sync.interface'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('ThreeWaySyncManifestMixin.downloadFile', () => {
  let vaultPath: string
  let service: ThreeWaySyncService
  const downloadFile = vi.fn()
  const cloudClient = {
    listFiles: vi.fn().mockResolvedValue([]),
    uploadFile: vi.fn(),
    downloadFile,
    deleteFile: vi.fn()
  } as unknown as ICloudSyncClient

  const pathService = {
    getRootDirectory: vi.fn(),
    getActiveVaultPath: vi.fn()
  } as unknown as IStoragePathService

  beforeEach(() => {
    vaultPath = fs.mkdtempSync(path.join(os.tmpdir(), 'baishou-download-test-'))
    vi.mocked(pathService.getRootDirectory).mockResolvedValue(vaultPath)
    vi.mocked(pathService.getActiveVaultPath).mockResolvedValue(path.join(vaultPath, 'Personal'))
    service = new ThreeWaySyncService(pathService, cloudClient, 'desktop-test')

    fs.mkdirSync(path.join(vaultPath, 'Personal'), { recursive: true })
    fs.writeFileSync(
      path.join(vaultPath, '.baishou-s3.json'),
      JSON.stringify({
        enabled: true,
        target: 's3',
        endpoint: 'https://s3.example.com',
        region: 'us-east-1',
        bucket: 'bucket-a',
        path: 'backup_sync',
        accessKey: 'ak',
        secretKey: 'sk'
      }),
      'utf8'
    )
  })

  afterEach(() => {
    fs.rmSync(vaultPath, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('404 时返回 false 且不抛出', async () => {
    downloadFile.mockRejectedValueOnce(
      Object.assign(new Error('Not Found'), { code: 'NotFound', statusCode: 404 })
    )

    const result = await (service as any).downloadFile('Personal/missing.md')

    expect(result).toBe(false)
    expect(downloadFile).toHaveBeenCalledOnce()
  })

  it('非 404 错误继续抛出', async () => {
    downloadFile.mockRejectedValueOnce(new Error('network timeout'))

    await expect((service as any).downloadFile('Personal/missing.md')).rejects.toThrow(
      'network timeout'
    )
  })

  it('下载成功时返回 true', async () => {
    downloadFile.mockImplementation(async (_remote: string, localDest: string) => {
      await fs.promises.mkdir(path.dirname(localDest), { recursive: true })
      await fs.promises.writeFile(localDest, 'ok', 'utf8')
    })

    const result = await (service as any).downloadFile('Personal/exists.md')
    expect(result).toBe(true)
  })

  it('下载 Memory 月分片后立刻标 pending-index', async () => {
    const memoryDir = path.join(vaultPath, 'Personal', 'Memory')
    fs.mkdirSync(memoryDir, { recursive: true })
    const shardPath = path.join(memoryDir, '2026-07.jsonl')
    fs.writeFileSync(
      shardPath,
      `${JSON.stringify({ id: 'a', updatedAt: 1, content: 'old' })}\n`,
      'utf8'
    )
    // Pretend already indexed with current hash
    const { MonthlyJsonlStore } = await import('../../raw-data/stores/monthly-jsonl.store')
    const { createNodeFileSystem } = await import('../../fs/create-node-file-system')
    const store = new MonthlyJsonlStore({
      fs: createNodeFileSystem(),
      rootDir: memoryDir
    })
    const hash = await store.computeShardHash('2026-07')
    await store.markIndexed('2026-07.jsonl', hash)
    expect(await store.listPendingIndex()).toHaveLength(0)

    downloadFile.mockImplementation(async (_remote: string, localDest: string) => {
      await fs.promises.mkdir(path.dirname(localDest), { recursive: true })
      await fs.promises.writeFile(
        localDest,
        `${JSON.stringify({ id: 'a', updatedAt: 2, content: 'from-remote' })}\n`,
        'utf8'
      )
    })

    const result = await (service as any).downloadFile('Personal/Memory/2026-07.jsonl')
    expect(result).toBe(true)
    expect(await store.listPendingIndex()).toHaveLength(1)
  })
})
