import * as path from '../fs/path.util'
import { VaultInfo } from './vault.types'
import {
  findConflictingVaultName,
  sanitizeVaultDirectoryName,
  validateVaultName
} from './vault-name.util'
import { createRandomVaultId, deriveLegacyVaultId, isVaultId } from './vault-id.util'
import {
  readLegacyVaultRegistry,
  writeNextVaultRegistry
} from '../migration/legacy-migration.shared'
import { listDiskVaultFolderNames } from './vault-disk.util'
import {
  discoverAllVaultNamesOnDisk,
  discoverLegacyVaultNamesOnDisk,
  normalizeRegistryPath,
  parseRegistryTimestamp,
  vaultDirectoryHasLegacyContent
} from './vault-registry.util'
import { VaultIdentityBase } from './vault.identity-base'

export abstract class VaultRegistryMixin extends VaultIdentityBase {
  public async initRegistry(): Promise<void> {
    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')

    let shouldSave = false
    let content: string | null = null

    try {
      content = await this.fileSystem.readFile(registryFile, 'utf8')
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e
      }
    }

    if (!content) {
      const legacyEntries = await readLegacyVaultRegistry(this.fileSystem, rootDir)
      if (legacyEntries.length > 0) {
        this._vaults = await writeNextVaultRegistry(
          this.fileSystem,
          rootDir,
          legacyEntries.map((entry) => entry.name),
          legacyEntries
        )
        shouldSave = false
      } else {
        const discovered = await discoverAllVaultNamesOnDisk(this.fileSystem, rootDir)
        if (discovered.length > 0) {
          this._vaults = await writeNextVaultRegistry(this.fileSystem, rootDir, discovered)
          shouldSave = false
        } else {
          const defaultVaultName = 'Personal'
          const defaultVaultPath = await this.pathService.getVaultDirectory(defaultVaultName)

          this._vaults = [
            {
              id: createRandomVaultId(),
              name: defaultVaultName,
              path: defaultVaultPath,
              createdAt: new Date(),
              lastAccessedAt: new Date()
            }
          ]
          shouldSave = true
        }
      }
    } else {
      try {
        const rawList = JSON.parse(content)
        const fallbackNow = new Date()
        this._vaults = rawList.map((item: any) => ({
          id: isVaultId(item.id) ? item.id : '',
          name: item.name,
          path: item.path,
          createdAt: parseRegistryTimestamp(item.createdAt, fallbackNow),
          lastAccessedAt: parseRegistryTimestamp(item.lastAccessedAt, fallbackNow)
        }))

        if (this._vaults.length === 0) {
          const defaultVaultName = 'Personal'
          const defaultVaultPath = await this.pathService.getVaultDirectory(defaultVaultName)
          this._vaults = [
            {
              id: createRandomVaultId(),
              name: defaultVaultName,
              path: defaultVaultPath,
              createdAt: fallbackNow,
              lastAccessedAt: fallbackNow
            }
          ]
          shouldSave = true
        }

        for (let i = 0; i < this._vaults.length; i++) {
          const vault = this._vaults[i]
          if (!vault) continue
          const expectedPath = path.join(rootDir, sanitizeVaultDirectoryName(vault.name))
          if (normalizeRegistryPath(vault.path) !== normalizeRegistryPath(expectedPath)) {
            vault.path = expectedPath
            shouldSave = true
          }
        }

        const diskWithContent = await discoverLegacyVaultNamesOnDisk(this.fileSystem, rootDir)
        if (diskWithContent.length > this._vaults.length) {
          const legacyEntries = await readLegacyVaultRegistry(this.fileSystem, rootDir)
          this._vaults = await writeNextVaultRegistry(
            this.fileSystem,
            rootDir,
            diskWithContent,
            legacyEntries
          )
          shouldSave = false
        }

        const active = this.getActiveVault()
        if (
          active &&
          this._vaults.length === 1 &&
          !(await vaultDirectoryHasLegacyContent(this.fileSystem, rootDir, active.name))
        ) {
          const legacyEntries = await readLegacyVaultRegistry(this.fileSystem, rootDir)
          if (legacyEntries.length > 0) {
            this._vaults = await writeNextVaultRegistry(
              this.fileSystem,
              rootDir,
              legacyEntries.map((entry) => entry.name),
              legacyEntries
            )
            shouldSave = false
          } else {
            const discovered = await discoverAllVaultNamesOnDisk(this.fileSystem, rootDir)
            if (discovered.length > 0) {
              this._vaults = await writeNextVaultRegistry(this.fileSystem, rootDir, discovered)
              shouldSave = false
            }
          }
        }
      } catch {
        const defaultVaultPath = await this.pathService.getVaultDirectory('Personal')
        this._vaults = [
          {
            id: createRandomVaultId(),
            name: 'Personal',
            path: defaultVaultPath,
            createdAt: new Date(),
            lastAccessedAt: new Date()
          }
        ]
        shouldSave = true
      }
    }

    // 先落盘注册表修正，再 sync（含改名自愈 + 三级 ID 回写）。
    // 不可在 sync 前 ensure 写 vault.json，否则改名中断时会在旧路径造出幽灵目录。
    if (shouldSave) {
      await this.saveRegistry(registryFile)
    }

    await this.syncRegistryWithDisk()

    await this.hydrateActiveVaultPreference()

    const activeVault = this.getActiveVault()
    if (activeVault) {
      await this.fileSystem.mkdir(activeVault.path, { recursive: true })
      try {
        await this.fileSystem.mkdir(path.join(activeVault.path, 'config'), { recursive: true })
      } catch {}
      // 全新安装时 sync 阶段目录可能尚不存在，此处补齐仓内身份文件
      await this.writeVaultIdentityMeta(activeVault)
    }
  }

  public async syncRegistryWithDisk(): Promise<string[]> {
    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')
    const diskNames = await listDiskVaultFolderNames(this.fileSystem, rootDir)
    const added: string[] = []
    let dirty = false

    for (const diskName of diskNames) {
      if (this.registryCoversDiskFolder(diskName)) continue

      const diskPath = path.join(rootDir, diskName)
      const meta = await this.readVaultIdentityMeta(diskPath)
      if (meta?.id) {
        const existing = this._vaults.find((v) => v.id === meta.id)
        if (existing) {
          const validated = validateVaultName(diskName)
          const nextName = validated.ok ? validated.name : diskName
          const nextPath = await this.pathService.getVaultDirectory(nextName)
          if (
            existing.name !== nextName ||
            normalizeRegistryPath(existing.path) !== normalizeRegistryPath(nextPath)
          ) {
            existing.name = nextName
            existing.path = nextPath
            dirty = true
          }
          await this.writeVaultIdentityMeta(existing)
          continue
        }
      }

      const result = validateVaultName(diskName)
      if (!result.ok) continue
      if (
        findConflictingVaultName(
          result.name,
          this._vaults.map((v) => v.name)
        )
      ) {
        continue
      }

      await this.addNewVault(result.name, { touchAccess: false, idMode: 'legacy' })
      added.push(result.name)
      dirty = true
    }

    if (await this.ensureAllVaultIdentities()) {
      dirty = true
    }

    if (dirty) {
      await this.saveRegistry(registryFile)
    }

    return added
  }

  public async ensureVaultsRegistered(vaultNames: Iterable<string>): Promise<string[]> {
    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')
    const added: string[] = []

    for (const rawName of vaultNames) {
      const result = validateVaultName(rawName)
      if (!result.ok) continue
      const name = result.name
      // 大小写 / 消毒目录撞名一律视为已覆盖，避免二次登记共用同一磁盘目录
      if (
        findConflictingVaultName(
          name,
          this._vaults.map((v) => v.name)
        )
      ) {
        continue
      }

      await this.addNewVault(name, { touchAccess: false, idMode: 'legacy' })
      added.push(name)
    }

    if (added.length > 0) {
      await this.saveRegistry(registryFile)
    }

    return added
  }

  public async pruneOrphanRegistryVaults(
    manifestVaultScopes: ReadonlySet<string>,
    diskVaultNames: readonly string[]
  ): Promise<string[]> {
    const activeName = this.getActiveVault()?.name ?? null
    const removed: string[] = []
    const kept: VaultInfo[] = []

    for (const vault of this._vaults) {
      const onDisk = diskVaultNames.some((diskName) => this.vaultMatchesDiskFolder(vault, diskName))
      const hasSyncData = manifestVaultScopes.has(vault.name)
      const isActive = vault.name === activeName
      if (isActive || onDisk || hasSyncData) {
        kept.push(vault)
      } else {
        removed.push(vault.name)
      }
    }

    if (removed.length === 0) return []

    this._vaults = kept
    if (this._vaults.length === 0) {
      const personalPath = await this.pathService.getVaultDirectory('Personal')
      const personal: VaultInfo = {
        id: deriveLegacyVaultId('Personal'),
        name: 'Personal',
        path: personalPath,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }
      this._vaults.push(personal)
      await this.writeVaultIdentityMeta(personal)
    }

    const rootDir = await this.pathService.getRootDirectory()
    await this.saveRegistry(path.join(rootDir, 'vault_registry.json'))
    return removed
  }
}
