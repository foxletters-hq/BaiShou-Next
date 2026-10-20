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
