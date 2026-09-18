import * as path from '../fs/path.util'
import { IVaultService, RenameVaultResult, VaultInfo } from './vault.types'
import {
  VaultActiveDeleteError,
  VaultDeleteFilesystemError,
  VaultInvalidNameError,
  VaultNotFoundError,
  VaultRenameFilesystemError
} from './vault.errors'
import {
  findConflictingVaultName,
  normalizeVaultNameForCompare,
  sanitizeVaultDirectoryName,
  validateVaultName
} from './vault-name.util'
import { deriveLegacyVaultId } from './vault-id.util'
import {
  SYNC_MANIFEST_FILENAME,
  migrateSyncManifestVaultPrefix,
  sumVaultFileBytes
} from '@baishou/shared'
import { normalizeRegistryPath } from './vault-registry.util'
import { VaultRegistryMixin } from './vault.registry-mixin'

export class VaultService extends VaultRegistryMixin implements IVaultService {
  public async createVault(vaultName: string): Promise<void> {
    const name = this.resolveVaultNameOrThrow(vaultName)
    this.assertVaultNameAvailable(name)
    await this.addNewVault(name, { idMode: 'random' })
    const rootDir = await this.pathService.getRootDirectory()
    await this.saveRegistry(path.join(rootDir, 'vault_registry.json'))
  }

  public async renameVault(oldNameOrId: string, newName: string): Promise<RenameVaultResult> {
    const vault = this.resolveVaultOrThrow(oldNameOrId)
    const nextName = this.resolveVaultNameOrThrow(newName)
    const oldName = vault.name

    if (oldName === nextName) {
      const estimatedUploadBytes = await this.estimateVaultLocalSyncBytes(vault.id)
      return { id: vault.id, oldName, newName: nextName, estimatedUploadBytes }
    }

    this.assertVaultNameAvailable(nextName, { excludeVaultId: vault.id })

    const rootDir = await this.pathService.getRootDirectory()
    const oldDirName = sanitizeVaultDirectoryName(oldName)
    const newDirName = sanitizeVaultDirectoryName(nextName)
    const oldPath = path.join(rootDir, oldDirName)
    const newPath = path.join(rootDir, newDirName)

    const estimatedUploadBytes = await this.estimateBytesForVault(vault, oldName)

    try {
      await this.renameVaultDirectoryOnDisk(oldPath, newPath, vault.id)
    } catch (error) {
      throw new VaultRenameFilesystemError(oldName, nextName, error)
    }

    vault.name = nextName
    vault.path = newPath
    await this.writeVaultIdentityMeta(vault)
    await this.migrateLocalSyncManifestVaultPrefix(oldName, nextName)
    await this.saveRegistry(path.join(rootDir, 'vault_registry.json'))

    return { id: vault.id, oldName, newName: nextName, estimatedUploadBytes }
  }

  public async estimateVaultLocalSyncBytes(vaultNameOrId: string): Promise<number> {
    const vault = this.resolveVaultOrThrow(vaultNameOrId)
    return this.estimateBytesForVault(vault, vault.name)
  }

  private async renameVaultDirectoryOnDisk(
    oldPath: string,
    newPath: string,
    vaultId: string
  ): Promise<void> {
    const oldNorm = normalizeRegistryPath(oldPath)
    const newNorm = normalizeRegistryPath(newPath)
    if (oldNorm === newNorm) return

    const oldExists = await this.fileSystem.exists(oldPath)
    if (!oldExists) {
      // 目录可能已由中断改名落到新路径；若新路径存在则视为已完成
      if (await this.fileSystem.exists(newPath)) return
      throw Object.assign(new Error(`Source vault directory missing: ${oldPath}`), {
        code: 'ENOENT'
      })
    }

    const samePathDifferentCase =
      normalizeVaultNameForCompare(path.basename(oldPath)) ===
        normalizeVaultNameForCompare(path.basename(newPath)) && oldNorm !== newNorm

    if (samePathDifferentCase) {
      const rootDir = path.dirname(oldPath)
      const tempPath = path.join(rootDir, `.rename-tmp-${vaultId}`)
      if (await this.fileSystem.exists(tempPath)) {
        await this.fileSystem.rm(tempPath, { recursive: true, force: true })
      }
      await this.fileSystem.rename(oldPath, tempPath)
      await this.fileSystem.rename(tempPath, newPath)
      return
    }

    if (await this.fileSystem.exists(newPath)) {
      throw Object.assign(new Error(`Target vault directory already exists: ${newPath}`), {
        code: 'EEXIST'
      })
    }
    await this.fileSystem.rename(oldPath, newPath)
  }

  private async estimateBytesForVault(
    vault: VaultInfo,
    vaultNameForPrefix: string
  ): Promise<number> {
    const fromManifest = await this.readLocalManifestVaultBytes(vaultNameForPrefix)
    if (fromManifest > 0) return fromManifest
    return this.sumDirectoryBytes(vault.path)
  }

  private async readLocalManifestVaultBytes(vaultName: string): Promise<number> {
    const manifest = await this.readLocalSyncManifest()
    if (!manifest) return 0
    return sumVaultFileBytes(manifest.files, vaultName)
  }

  private async migrateLocalSyncManifestVaultPrefix(
    oldVaultName: string,
    newVaultName: string
  ): Promise<void> {
    const rootDir = await this.pathService.getRootDirectory()
    const manifestPath = path.join(rootDir, '.baishou', SYNC_MANIFEST_FILENAME)
    const raw = await this.readLocalSyncManifest()
    if (!raw) return

    const { manifest, migratedKeyCount } = migrateSyncManifestVaultPrefix(
      raw,
      oldVaultName,
      newVaultName
    )
    if (migratedKeyCount === 0 && oldVaultName === newVaultName) return

    await this.fileSystem.mkdir(path.dirname(manifestPath), { recursive: true })
    await this.fileSystem.writeFile(manifestPath, JSON.stringify(manifest), 'utf8')
  }

  private async sumDirectoryBytes(dirPath: string): Promise<number> {
    if (!(await this.fileSystem.exists(dirPath))) return 0
    let total = 0
    const walk = async (current: string): Promise<void> => {
      let names: string[]
      try {
        names = await this.fileSystem.readdir(current)
      } catch {
        return
      }
      for (const name of names) {
        const full = path.join(current, name)
        const stat = await this.fileSystem.stat(full).catch(() => null)
        if (!stat) continue
        if (stat.isDirectory) {
          await walk(full)
        } else if (stat.isFile) {
          const size = typeof stat.size === 'number' && Number.isFinite(stat.size) ? stat.size : 0
          if (size > 0) total += size
        }
      }
    }
    await walk(dirPath)
    return total
  }

  public async switchVault(vaultName: string): Promise<void> {
    const result = validateVaultName(vaultName)
    if (result.ok === false) {
      throw new VaultInvalidNameError(vaultName, result.reason)
    }
    const name = result.name
    const conflict = findConflictingVaultName(
      name,
      this._vaults.map((v) => v.name)
    )
    const existingIndex = conflict
      ? this._vaults.findIndex((v) => v.name === conflict.existing)
      : -1
    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')

    let target: VaultInfo | undefined
    if (existingIndex !== -1) {
      const existing = this._vaults[existingIndex]
      if (existing) {
        existing.lastAccessedAt = new Date()
        target = existing
      }
    } else {
      this.resolveVaultNameOrThrow(name)
      await this.addNewVault(name, { idMode: 'random' })
      target = this._vaults[this._vaults.length - 1]
    }

    if (target) {
      await this.persistActiveVaultId(target.id)
    }

    await this.saveRegistry(registryFile)
  }

  public async deleteVault(vaultName: string): Promise<void> {
    const activeVault = this.getActiveVault()
    if (activeVault?.name === vaultName) {
      throw new VaultActiveDeleteError(vaultName)
    }

    const existingIndex = this._vaults.findIndex((v) => v.name === vaultName)
    if (existingIndex === -1) {
      throw new VaultNotFoundError(vaultName)
    }

    const existing = this._vaults[existingIndex]
    if (!existing) {
      throw new VaultNotFoundError(vaultName)
    }

    const rootDir = await this.pathService.getRootDirectory()
    const vaultPath = path.join(rootDir, sanitizeVaultDirectoryName(existing.name))
    try {
      if (await this.fileSystem.exists(vaultPath)) {
        await this.fileSystem.rm(vaultPath, { recursive: true, force: true })
      }
    } catch (error) {
      throw new VaultDeleteFilesystemError(vaultName, error)
    }

    this._vaults.splice(existingIndex, 1)

    if (this._vaults.length === 0) {
      const p = await this.pathService.getVaultDirectory('Personal')
      const personal: VaultInfo = {
        id: deriveLegacyVaultId('Personal'),
        name: 'Personal',
        path: p,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }
      this._vaults.push(personal)
      await this.writeVaultIdentityMeta(personal)
      await this.persistActiveVaultId(personal.id)
    }

    const registryFile = path.join(rootDir, 'vault_registry.json')
    await this.saveRegistry(registryFile)
  }
}
