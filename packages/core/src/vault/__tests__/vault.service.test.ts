import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VaultService } from '../vault.service'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

describe('VaultService Integration', () => {
  let tempDir: string
  let service: VaultService

  beforeEach(async () => {
    // 建立一个真实的沙盒目录模拟多系统的应用数据目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vault-test-'))

    // 提供给 VaultService 真实的临时目录
    const mockPathService = {
      getRootDirectory: vi.fn().mockResolvedValue(tempDir),
      getGlobalRegistryDirectory: vi.fn().mockResolvedValue(tempDir),
      getVaultDirectory: vi
        .fn()
        .mockImplementation(async (name: string) => path.join(tempDir, name)),
      getUserAvatarsDirectory: vi.fn().mockResolvedValue('/tmp/user-avatars'),
      getAvatarsDirectory: vi.fn().mockResolvedValue('/tmp/avatars'),
      getVaultSystemDirectory: vi
        .fn()
        .mockImplementation(async (name: string) => path.join(tempDir, name, '.baishou'))
    }

    service = new VaultService(mockPathService as any, createNodeFileSystem())
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('should auto correct corrupted foreign absolute paths to local paths when initializing', async () => {
    // 主动注入一个带着异乎寻常的 Windows (C:\) 或者错乱绝对路径的 json，模拟 ZIP 迁移
    const registryPath = path.join(tempDir, 'vault_registry.json')
    const corruptedJson = [
      {
        name: 'Personal',
        path: 'C:\\Users\\ForeignUser\\AppData\\Roaming\\BaiShou\\Personal',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      }
    ]
    await fs.writeFile(registryPath, JSON.stringify(corruptedJson))

    await service.initRegistry()

    const vaults = service.getAllVaults()
    expect(vaults.length).toBe(1)

    // 它应当已经被修正为基于当前系统 tempDir 下的路径 (自动根据 OS 判断路径拼接)
    const expected = path.join(tempDir, 'Personal')
    const normalize = (p: string) => p.replace(/\\/g, '/')
    expect(normalize(vaults[0]!.path)).toBe(normalize(expected))

    // 文件上也应该被静默修正了
    const fixedContent = await fs.readFile(registryPath, 'utf8')
    const parsed = JSON.parse(fixedContent)
    expect(normalize(parsed[0].path)).toBe(normalize(expected))
  })

  it('loads Flutter legacy registry from .baishou/vault_registry.json when root registry is missing', async () => {
    await fs.mkdir(path.join(tempDir, '.baishou'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'Work', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Work', 'Journals', '2024-06-01.md'), '# hello')
    const legacyRegistry = [
      {
        name: 'Work',
        path: '/old/absolute/Work',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessedAt: '2024-06-01T00:00:00.000Z'
      }
    ]
    await fs.writeFile(
      path.join(tempDir, '.baishou', 'vault_registry.json'),
      JSON.stringify(legacyRegistry)
    )

    await service.initRegistry()

    const vaults = service.getAllVaults()
    expect(vaults.map((v) => v.name)).toEqual(['Work'])
    expect(await fs.stat(path.join(tempDir, 'vault_registry.json'))).toBeDefined()
  })
})
