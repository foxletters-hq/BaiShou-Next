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
      id: 'vlt_testdirconflict01',
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
        id: 'vlt_testcasework0001',
        name: 'Work',
        path: path.join(tempDir, 'Work'),
        createdAt: new Date(),
        lastAccessedAt: new Date(0)
      },
      {
        id: 'vlt_testcasework0002',
        name: 'work',
        path: path.join(tempDir, 'work'),
        createdAt: new Date(),
        lastAccessedAt: new Date(0)
      }
    )
    const conflicts = service.findRegistryNameConflicts()
    expect(conflicts.some((c) => c.kind === 'case')).toBe(true)
  })

  describe('V2.1 stable vault id', () => {
    it('createVault writes matching id to vault.json and registry', async () => {
      await service.initRegistry()
      await service.createVault('Work')

      const vault = service.getAllVaults().find((v) => v.name === 'Work')
      expect(vault?.id).toMatch(/^vlt_[0-9a-f]{16}$/)

      const registry = JSON.parse(await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8'))
      const regEntry = registry.find((v: { name: string }) => v.name === 'Work')
      expect(regEntry.id).toBe(vault!.id)

      const meta = JSON.parse(
        await fs.readFile(path.join(tempDir, 'Work', '.baishou', 'vault.json'), 'utf8')
      )
      expect(meta.id).toBe(vault!.id)
      expect(meta.displayName).toBe('Work')
      expect(meta.path).toBeUndefined()
    })

    it('upgrades legacy registry without id using deterministic derive', async () => {
      const { deriveLegacyVaultId } = await import('../vault-id.util')
      await fs.mkdir(path.join(tempDir, 'Personal', 'Journals'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'Personal', 'Journals', 'a.md'), '# a')
      await fs.writeFile(
        path.join(tempDir, 'vault_registry.json'),
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

      const expected = deriveLegacyVaultId('Personal')
      expect(service.getAllVaults()[0]?.id).toBe(expected)
      expect(deriveLegacyVaultId('Personal')).toBe(expected)

      const registry = JSON.parse(await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8'))
      expect(registry[0].id).toBe(expected)
      const meta = JSON.parse(
        await fs.readFile(path.join(tempDir, 'Personal', '.baishou', 'vault.json'), 'utf8')
      )
      expect(meta.id).toBe(expected)
    })

    it('restores registry id from vault.json after cold start', async () => {
      await service.initRegistry()
      await service.createVault('Work')
      const originalId = service.getAllVaults().find((v) => v.name === 'Work')!.id

      const registryPath = path.join(tempDir, 'vault_registry.json')
      const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'))
      for (const entry of registry) {
        if (entry.name === 'Work') delete entry.id
      }
      await fs.writeFile(registryPath, JSON.stringify(registry))

      const service2 = new VaultService(
        {
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
        } as any,
        createNodeFileSystem()
      )
      await service2.initRegistry()

      expect(service2.getAllVaults().find((v) => v.name === 'Work')?.id).toBe(originalId)
      const restored = JSON.parse(await fs.readFile(registryPath, 'utf8'))
      expect(restored.find((v: { name: string }) => v.name === 'Work').id).toBe(originalId)
    })

    it('rewrites vault.json from registry after cold start', async () => {
      await service.initRegistry()
      await service.createVault('Work')
      const originalId = service.getAllVaults().find((v) => v.name === 'Work')!.id
      const metaPath = path.join(tempDir, 'Work', '.baishou', 'vault.json')
      await fs.rm(metaPath)

      const service2 = new VaultService(
        {
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
        } as any,
        createNodeFileSystem()
      )
      await service2.initRegistry()

      expect(service2.getAllVaults().find((v) => v.name === 'Work')?.id).toBe(originalId)
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))
      expect(meta.id).toBe(originalId)
    })

    it('derives same id when both registry id and vault.json are missing', async () => {
      const { deriveLegacyVaultId } = await import('../vault-id.util')
      await fs.mkdir(path.join(tempDir, 'Personal', 'Journals'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'Personal', 'Journals', 'a.md'), '# a')
      await fs.writeFile(
        path.join(tempDir, 'vault_registry.json'),
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
      const originalId = service.getAllVaults()[0]!.id
      expect(originalId).toBe(deriveLegacyVaultId('Personal'))

      await fs.rm(path.join(tempDir, 'Personal', '.baishou', 'vault.json'))
      const registry = JSON.parse(await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8'))
      delete registry[0].id
      await fs.writeFile(path.join(tempDir, 'vault_registry.json'), JSON.stringify(registry))

      const service2 = new VaultService(
        {
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
        } as any,
        createNodeFileSystem()
      )
      await service2.initRegistry()
      expect(service2.getAllVaults()[0]?.id).toBe(originalId)
    })

    it('syncRegistryWithDisk heals rename when vault.json id matches registry', async () => {
      await service.initRegistry()
      await service.createVault('Personal_Old')
      // 切到 Personal_Old，再删默认 Personal，避免删活跃仓
      await service.switchVault('Personal_Old')
      if (service.vaultExists('Personal')) {
        await service.deleteVault('Personal')
      }

      const vault = service.getAllVaults().find((v) => v.name === 'Personal_Old')!
      const originalId = vault.id

      // 模拟目录改名：磁盘 Personal_Old → Work，vault.json 保留原 id；注册表仍是旧名
      await fs.rename(path.join(tempDir, 'Personal_Old'), path.join(tempDir, 'Work'))
      // 注册表仍指向旧名（不经 rename API）
      const registryPath = path.join(tempDir, 'vault_registry.json')
      await fs.writeFile(
        registryPath,
        JSON.stringify([
          {
            id: originalId,
            name: 'Personal_Old',
            path: path.join(tempDir, 'Personal_Old'),
            createdAt: vault.createdAt.toISOString(),
            lastAccessedAt: new Date().toISOString()
          }
        ])
      )

      const service2 = new VaultService(
        {
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
        } as any,
        createNodeFileSystem()
      )
      await service2.initRegistry()

      const healed = service2.getAllVaults().find((v) => v.id === originalId)
      expect(healed?.name).toBe('Work')
      expect(healed?.path.replace(/\\/g, '/')).toBe(path.join(tempDir, 'Work').replace(/\\/g, '/'))
      expect(service2.getAllVaults().some((v) => v.name === 'Personal_Old')).toBe(false)

      const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'))
      expect(registry.find((v: { id: string }) => v.id === originalId).name).toBe('Work')
    })
  })

  describe('V2.4 renameVault', () => {
    it('renames disk/registry/vault.json, migrates local manifest, leaves ancestor untouched', async () => {
      await service.initRegistry()
      await service.createVault('Alpha')
      await service.switchVault('Alpha')
      if (service.vaultExists('Personal')) {
        await service.deleteVault('Personal')
      }

      const vault = service.getAllVaults().find((v) => v.name === 'Alpha')!
      const originalId = vault.id

      await fs.mkdir(path.join(tempDir, 'Alpha', 'Journals'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'Alpha', 'Journals', 'note.md'), 'hello diary')

      const metaDir = path.join(tempDir, '.baishou')
      await fs.mkdir(metaDir, { recursive: true })
      const localManifest = {
        version: 1,
        updatedAt: 1,
        deviceId: 'test',
        files: {
          'Alpha/Journals/note.md': { hash: 'h1', size: 11, lastModified: 1 },
          'Alpha/.baishou/vault.json': { hash: 'h2', size: 40, lastModified: 1 }
        }
      }
      const ancestorManifest = {
        version: 1,
        updatedAt: 1,
        deviceId: 'cloud',
        files: {
          'Alpha/Journals/note.md': { hash: 'h1', size: 11, lastModified: 1 }
        }
      }
      await fs.writeFile(path.join(metaDir, 'manifest.json'), JSON.stringify(localManifest))
      await fs.writeFile(
        path.join(metaDir, 'last-remote-manifest.json'),
        JSON.stringify(ancestorManifest)
      )

      const result = await service.renameVault('Alpha', 'Beta')
      expect(result.id).toBe(originalId)
      expect(result.oldName).toBe('Alpha')
      expect(result.newName).toBe('Beta')
      expect(result.estimatedUploadBytes).toBe(51)

      const renamed = service.getAllVaults().find((v) => v.id === originalId)!
      expect(renamed.name).toBe('Beta')
      expect(await fs.stat(path.join(tempDir, 'Beta', 'Journals', 'note.md'))).toBeTruthy()
      expect(service.vaultExists('Alpha')).toBe(false)

      const meta = JSON.parse(
        await fs.readFile(path.join(tempDir, 'Beta', '.baishou', 'vault.json'), 'utf8')
      )
      expect(meta.id).toBe(originalId)
      expect(meta.displayName).toBe('Beta')

      const nextLocal = JSON.parse(await fs.readFile(path.join(metaDir, 'manifest.json'), 'utf8'))
      expect(nextLocal.files['Beta/Journals/note.md']).toEqual({
        hash: 'h1',
        size: 11,
        lastModified: 1
      })
      expect(nextLocal.files['Alpha/Journals/note.md']).toBeUndefined()

      const ancestor = JSON.parse(
        await fs.readFile(path.join(metaDir, 'last-remote-manifest.json'), 'utf8')
      )
      expect(ancestor.files['Alpha/Journals/note.md']).toBeDefined()
      expect(ancestor.files['Beta/Journals/note.md']).toBeUndefined()
    })

    it('rejects case-insensitive name conflict with another vault', async () => {
      await service.initRegistry()
      await service.createVault('Work')
      await service.createVault('Personal2')
      await expect(service.renameVault('Personal2', 'work')).rejects.toMatchObject({
        name: 'VaultNameExistsError'
      })
    })

    it('allows rename by vault id', async () => {
      await service.initRegistry()
      await service.createVault('Source')
      const id = service.getAllVaults().find((v) => v.name === 'Source')!.id
      const result = await service.renameVault(id, 'Target')
      expect(result.id).toBe(id)
      expect(result.newName).toBe('Target')
      expect(service.getAllVaults().some((v) => v.name === 'Target' && v.id === id)).toBe(true)
    })
  })
})
