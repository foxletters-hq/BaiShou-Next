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

  describe('V2-D6 local activeVaultId', () => {
    function createServiceWithLocalPreference(): VaultService {
      return new VaultService(
        createMockPathService(
          tempDir,
          async () => localActiveVaultId,
          async (id) => {
            localActiveVaultId = id
          }
        ) as any,
        createNodeFileSystem()
      )
    }

    it('persists active vault across cold start even if registry lastAccessedAt is rewritten', async () => {
      await service.initRegistry()
      await service.createVault('Work')
      await service.switchVault('Work')
      const workId = service.getActiveVault()?.id
      expect(workId).toBeTruthy()
      expect(localActiveVaultId).toBe(workId)
      expect(service.getActiveVault()?.name).toBe('Work')

      // 模拟跨设备同步：注册表里 Personal 的 lastAccessedAt 被改得更新
      const registryPath = path.join(tempDir, 'vault_registry.json')
      const registry = JSON.parse(await fs.readFile(registryPath, 'utf8')) as Array<{
        name: string
        lastAccessedAt: string
      }>
      for (const entry of registry) {
        if (entry.name === 'Personal') {
          entry.lastAccessedAt = new Date('2099-01-01T00:00:00.000Z').toISOString()
        }
        if (entry.name === 'Work') {
          entry.lastAccessedAt = new Date('2000-01-01T00:00:00.000Z').toISOString()
        }
      }
      await fs.writeFile(registryPath, JSON.stringify(registry))

      const service2 = createServiceWithLocalPreference()
      await service2.initRegistry()
      expect(service2.getActiveVault()?.name).toBe('Work')
      expect(service2.getActiveVault()?.id).toBe(workId)
      expect(localActiveVaultId).toBe(workId)
    })

    it('falls back to lastAccessedAt when local activeVaultId is unknown', async () => {
      await service.initRegistry()
      await service.createVault('Work')
      await service.switchVault('Work')
      expect(service.getActiveVault()?.name).toBe('Work')

      localActiveVaultId = 'vlt_does_not_exist_anymore'
      const service2 = createServiceWithLocalPreference()
      await service2.initRegistry()

      // Work 刚被 switch 过，lastAccessedAt 更新；回退后应落在 Work，并把本机偏好纠正
      expect(service2.getActiveVault()?.name).toBe('Work')
      expect(localActiveVaultId).toBe(service2.getActiveVault()?.id)
    })

    it('keeps active vault after rename because id is stable', async () => {
      await service.initRegistry()
      await service.createVault('Alpha')
      await service.switchVault('Alpha')
      const id = service.getActiveVault()?.id
      expect(id).toBeTruthy()

      await service.renameVault('Alpha', 'Beta')
      expect(service.getActiveVault()?.name).toBe('Beta')
      expect(service.getActiveVault()?.id).toBe(id)
      expect(localActiveVaultId).toBe(id)

      const service2 = createServiceWithLocalPreference()
      await service2.initRegistry()
      expect(service2.getActiveVault()?.name).toBe('Beta')
      expect(service2.getActiveVault()?.id).toBe(id)
    })
  })
})
