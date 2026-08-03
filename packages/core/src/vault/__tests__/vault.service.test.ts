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

  it('syncRegistryWithDisk registers disk vault folders without legacy journal markers', async () => {
    await fs.mkdir(path.join(tempDir, 'Personal', 'Sessions'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Personal', 'Sessions', 'chat.json'), '{}')
    await fs.mkdir(path.join(tempDir, 'Side', '.baishou'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Side', '.baishou', 'placeholder.txt'), 'x')

    const registryPath = path.join(tempDir, 'vault_registry.json')
    await fs.writeFile(
      registryPath,
      JSON.stringify([
        {
          name: 'Personal',
          path: path.join(tempDir, 'Personal'),
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString()
        }
      ])
    )

    await service.initRegistry()

    expect(
      service
        .getAllVaults()
        .map((v) => v.name)
        .sort()
    ).toEqual(['Personal', 'Side'])
  })

  it('syncRegistryWithDisk registers discovered vault folders not in registry', async () => {
    await fs.mkdir(path.join(tempDir, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Personal', 'Journals', 'a.md'), '# a')
    await fs.mkdir(path.join(tempDir, 'Work', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Work', 'Journals', 'b.md'), '# b')

    const registryPath = path.join(tempDir, 'vault_registry.json')
    await fs.writeFile(
      registryPath,
      JSON.stringify([
        {
          name: 'Personal',
          path: path.join(tempDir, 'Personal'),
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString()
        }
      ])
    )

    await service.initRegistry()

    expect(
      service
        .getAllVaults()
        .map((v) => v.name)
        .sort()
    ).toEqual(['Personal', 'Work'])
  })

  it('ensureVaultsRegistered adds remote-only vault names', async () => {
    await service.initRegistry()
    const added = await service.ensureVaultsRegistered(['RemoteVault'])
    expect(added).toEqual(['RemoteVault'])
    expect(service.vaultExists('RemoteVault')).toBe(true)
    expect(await fs.stat(path.join(tempDir, 'RemoteVault', '.baishou'))).toBeDefined()
  })

  it('ensureVaultsRegistered does not steal active vault', async () => {
    await fs.mkdir(path.join(tempDir, 'Personal', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Personal', 'Journals', 'a.md'), '# a')
    await fs.mkdir(path.join(tempDir, 'Work', 'Journals'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'Work', 'Journals', 'b.md'), '# b')

    await service.initRegistry()
    await service.switchVault('Personal')
    expect(service.getActiveVault()?.name).toBe('Personal')

    await service.ensureVaultsRegistered(['Work'])
    expect(service.getActiveVault()?.name).toBe('Personal')
  })

  it('pruneOrphanRegistryVaults removes cross-device ghost vaults without sync data', async () => {
    await service.initRegistry()
    await service.ensureVaultsRegistered(['C__Users_Desktop_OldVault'])
    expect(service.vaultExists('C__Users_Desktop_OldVault')).toBe(true)

    const removed = await service.pruneOrphanRegistryVaults(new Set(['Personal']), ['Personal'])
    expect(removed).toEqual(['C__Users_Desktop_OldVault'])
    expect(service.vaultExists('C__Users_Desktop_OldVault')).toBe(false)
    expect(service.vaultExists('Personal')).toBe(true)
  })

  it('createVault rejects case-insensitive duplicate names', async () => {
    await service.initRegistry()
    await service.createVault('Work')
    await expect(service.createVault('work')).rejects.toMatchObject({
      name: 'VaultNameExistsError',
      conflictKind: 'case',
      conflictingName: 'Work'
    })
    expect(service.getAllVaults().filter((v) => /work/i.test(v.name))).toHaveLength(1)
  })

  it('createVault rejects names that collide after directory sanitize', async () => {
    await service.initRegistry()
    // 直接注入历史非法名（当前 validate 已禁止新建此类名字）
    ;(service as any)._vaults.push({
      name: 'a:b',
      path: path.join(tempDir, 'a_b'),
      createdAt: new Date(),
      lastAccessedAt: new Date(0)
    })
    await expect(service.createVault('a_b')).rejects.toMatchObject({
      name: 'VaultNameExistsError',
      conflictKind: 'directory',
      conflictingName: 'a:b'
    })
  })

  it('switchVault with different casing activates existing vault instead of creating', async () => {
    await service.initRegistry()
    await service.createVault('Work')
    await service.switchVault('work')
    expect(service.getActiveVault()?.name).toBe('Work')
    expect(service.getAllVaults().filter((v) => /work/i.test(v.name))).toHaveLength(1)
  })

  it('ensureVaultsRegistered skips case-colliding remote names', async () => {
    await service.initRegistry()
    await service.createVault('Work')
    const added = await service.ensureVaultsRegistered(['work'])
    expect(added).toEqual([])
    expect(service.vaultExists('work')).toBe(true)
    expect(service.getAllVaults().filter((v) => /work/i.test(v.name))).toHaveLength(1)
  })

  it('findRegistryNameConflicts reports existing case collisions', async () => {
    await service.initRegistry()
    ;(service as any)._vaults.push(
      {
        name: 'Work',
        path: path.join(tempDir, 'Work'),
        createdAt: new Date(),
        lastAccessedAt: new Date(0)
      },
      {
        name: 'work',
        path: path.join(tempDir, 'work'),
        createdAt: new Date(),
        lastAccessedAt: new Date(0)
      }
    )
    const conflicts = service.findRegistryNameConflicts()
    expect(conflicts.some((c) => c.kind === 'case')).toBe(true)
  })
})
