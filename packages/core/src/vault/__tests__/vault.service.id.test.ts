import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VaultService } from '../vault.service'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createMockPathService } from './vault-service.test-helpers'

describe('VaultService Integration', () => {
  let tempDir: string
  let service: VaultService
  let localActiveVaultId: string | null

  beforeEach(async () => {
    // 建立一个真实的沙盒目录模拟多系统的应用数据目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vault-test-'))
    localActiveVaultId = null

    // 提供给 VaultService 真实的临时目录
    const mockPathService = createMockPathService(
      tempDir,
      async () => localActiveVaultId,
      async (id) => {
        localActiveVaultId = id
      }
    )

    service = new VaultService(mockPathService as any, createNodeFileSystem())
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  describe('V2.1 stable vault id', () => {
    it('createVault writes matching id to vault.json and registry', async () => {
      await service.initRegistry()
      await service.createVault('Work')

      const vault = service.getAllVaults().find((v) => v.name === 'Work')
      expect(vault?.id).toMatch(/^vlt_[0-9a-f]{16}$/)

      const registry = JSON.parse(
        await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8')
      )
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

      const registry = JSON.parse(
        await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8')
      )
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
        createMockPathService(tempDir) as any,
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
        createMockPathService(tempDir) as any,
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
      const registry = JSON.parse(
        await fs.readFile(path.join(tempDir, 'vault_registry.json'), 'utf8')
      )
      delete registry[0].id
      await fs.writeFile(path.join(tempDir, 'vault_registry.json'), JSON.stringify(registry))

      const service2 = new VaultService(
        createMockPathService(tempDir) as any,
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
        createMockPathService(tempDir) as any,
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
})
