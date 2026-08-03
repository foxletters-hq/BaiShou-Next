import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  IVaultService,
  RenameVaultResult,
  VAULT_IDENTITY_META_FILENAME,
  VaultIdentityMeta,
  VaultInfo
} from './vault.types'
import { IStoragePathService } from './storage-path.types'
import {
  VaultActiveDeleteError,
  VaultDeleteFilesystemError,
  VaultInvalidNameError,
  VaultNameExistsError,
  VaultNotFoundError,
  VaultRenameFilesystemError
} from './vault.errors'
import {
  findConflictingVaultName,
  normalizeVaultNameForCompare,
  sanitizeVaultDirectoryName,
  validateVaultName
} from './vault-name.util'
import { createRandomVaultId, deriveLegacyVaultId, isVaultId } from './vault-id.util'
import { pickActiveVault } from './active-vault.util'
import {
  discoverVaultNames,
  readLegacyVaultRegistry,
  writeNextVaultRegistry
} from '../migration/legacy-migration.shared'
import { listDiskVaultFolderNames } from './vault-disk.util'
import {
  SYNC_MANIFEST_FILENAME,
  SYNC_MANIFEST_VERSION,
  migrateSyncManifestVaultPrefix,
  sumVaultFileBytes,
  type SyncManifest
} from '@baishou/shared'

function parseRegistryTimestamp(value: unknown, fallback: Date): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

function normalizeRegistryPath(p: string): string {
  return p
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/\/$/, '')
}

async function discoverAllVaultNamesOnDisk(
  fileSystem: IFileSystem,
  rootDir: string
): Promise<string[]> {
  const [fromFolders, fromLegacy] = await Promise.all([
    listDiskVaultFolderNames(fileSystem, rootDir),
    discoverLegacyVaultNamesOnDisk(fileSystem, rootDir)
  ])
  return [...new Set([...fromFolders, ...fromLegacy])]
}

async function vaultDirectoryHasLegacyContent(
  fileSystem: IFileSystem,
  rootDir: string,
  vaultName: string
): Promise<boolean> {
  const vaultDir = path.join(rootDir, vaultName)
  return (
    (await fileSystem.exists(path.join(vaultDir, 'Journals'))) ||
    (await fileSystem.exists(path.join(vaultDir, 'Archives'))) ||
    (await fileSystem.exists(path.join(vaultDir, '.baishou', 'agent.sqlite')))
  )
}

async function discoverLegacyVaultNamesOnDisk(
  fileSystem: IFileSystem,
  rootDir: string
): Promise<string[]> {
  const names = await discoverVaultNames(fileSystem, rootDir)
  const withContent: string[] = []
  for (const name of names) {
    if (await vaultDirectoryHasLegacyContent(fileSystem, rootDir, name)) {
      withContent.push(name)
    }
  }
  return withContent
}

export class VaultService implements IVaultService {
  private _vaults: VaultInfo[] = []
  /** 本机活跃仓 id 缓存（与 pathService 本地持久化对齐；不进注册表） */
  private _activeVaultId: string | null = null

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fileSystem: IFileSystem
  ) {}

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

  public getActiveVault(): VaultInfo | null {
    return pickActiveVault(this._vaults, this._activeVaultId)
  }

  public resolveActiveVault(): Pick<VaultInfo, 'id' | 'name'> | null {
    const active = this.getActiveVault()
    if (!active) return null
    return { id: active.id, name: active.name }
  }

  public getAllVaults(): VaultInfo[] {
    return [...this._vaults]
  }

  public vaultExists(vaultName: string): boolean {
    const result = validateVaultName(vaultName)
    if (!result.ok) return false
    return (
      findConflictingVaultName(
        result.name,
        this._vaults.map((v) => v.name)
      ) !== null
    )
  }

  /** 注册表内是否已有大小写或目录名冲突（存量检测用） */
  public findRegistryNameConflicts(): Array<{
    left: string
    right: string
    kind: 'case' | 'directory'
  }> {
    const conflicts: Array<{ left: string; right: string; kind: 'case' | 'directory' }> = []
    const names = this._vaults.map((v) => v.name)
    for (let i = 0; i < names.length; i++) {
      const left = names[i]
      if (!left) continue
      const hit = findConflictingVaultName(left, names.slice(i + 1))
      if (hit && hit.kind !== 'exact') {
        conflicts.push({ left, right: hit.existing, kind: hit.kind })
      }
    }
    return conflicts
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

  private registryCoversDiskFolder(diskFolderName: string): boolean {
    return this._vaults.some((vault) => this.vaultMatchesDiskFolder(vault, diskFolderName))
  }

  private vaultMatchesDiskFolder(vault: VaultInfo, diskFolderName: string): boolean {
    const diskNorm = normalizeVaultNameForCompare(diskFolderName)
    if (normalizeVaultNameForCompare(vault.name) === diskNorm) return true
    if (normalizeVaultNameForCompare(sanitizeVaultDirectoryName(vault.name)) === diskNorm) {
      return true
    }
    const pathBase = normalizeRegistryPath(vault.path).split('/').pop()
    return pathBase !== undefined && normalizeVaultNameForCompare(pathBase) === diskNorm
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

  private assertVaultNameAvailable(name: string, options?: { excludeVaultId?: string }): void {
    const candidates = this._vaults
      .filter((v) => !options?.excludeVaultId || v.id !== options.excludeVaultId)
      .map((v) => v.name)
    const conflict = findConflictingVaultName(name, candidates)
    if (conflict) {
      throw new VaultNameExistsError(name, {
        conflictingName: conflict.existing,
        conflictKind: conflict.kind
      })
    }
  }

  private resolveVaultOrThrow(nameOrId: string): VaultInfo {
    const trimmed = typeof nameOrId === 'string' ? nameOrId.trim() : ''
    if (!trimmed) throw new VaultNotFoundError(nameOrId)

    if (isVaultId(trimmed)) {
      const byId = this._vaults.find((v) => v.id === trimmed)
      if (byId) return byId
      throw new VaultNotFoundError(trimmed)
    }

    const byExact = this._vaults.find((v) => v.name === trimmed)
    if (byExact) return byExact

    const byCase = this._vaults.find(
      (v) => normalizeVaultNameForCompare(v.name) === normalizeVaultNameForCompare(trimmed)
    )
    if (byCase) return byCase

    throw new VaultNotFoundError(trimmed)
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

  private async readLocalSyncManifest(): Promise<SyncManifest | null> {
    const rootDir = await this.pathService.getRootDirectory()
    const manifestPath = path.join(rootDir, '.baishou', SYNC_MANIFEST_FILENAME)
    try {
      const content = await this.fileSystem.readFile(manifestPath, 'utf8')
      const parsed = JSON.parse(content) as SyncManifest
      if (!parsed || typeof parsed !== 'object' || !parsed.files) {
        return {
          version: SYNC_MANIFEST_VERSION,
          updatedAt: Date.now(),
          deviceId: '',
          files: {}
        }
      }
      return parsed
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null
      return null
    }
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

  private resolveVaultNameOrThrow(vaultName: string): string {
    const result = validateVaultName(vaultName)
    if (result.ok === false) {
      throw new VaultInvalidNameError(vaultName, result.reason)
    }
    return result.name
  }

  private async addNewVault(
    vaultName: string,
    options?: { touchAccess?: boolean; idMode?: 'random' | 'legacy' }
  ): Promise<void> {
    const newPath = await this.pathService.getVaultDirectory(vaultName)
    await this.fileSystem.mkdir(newPath, { recursive: true })
    await this.fileSystem.mkdir(await this.pathService.getVaultSystemDirectory(vaultName), {
      recursive: true
    })

    const touchAccess = options?.touchAccess !== false
    const idMode = options?.idMode ?? 'random'
    const existingMeta = await this.readVaultIdentityMeta(newPath)
    const id =
      existingMeta?.id ??
      (idMode === 'legacy' ? deriveLegacyVaultId(vaultName) : createRandomVaultId())
    const createdAt =
      existingMeta?.createdAt && !Number.isNaN(Date.parse(existingMeta.createdAt))
        ? new Date(existingMeta.createdAt)
        : new Date()

    const newVault: VaultInfo = {
      id,
      name: vaultName,
      path: newPath,
      createdAt,
      lastAccessedAt: touchAccess ? new Date() : new Date(0)
    }
    this._vaults.push(newVault)
    await this.writeVaultIdentityMeta(newVault)
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

  /**
   * 三级 ID 来源回落并回写缺失级别：
   * 1. `<vault>/.baishou/vault.json`
   * 2. 注册表条目 id
   * 3. 从名字确定性派生（存量兜底；全新创建应在进入前已赋随机 id）
   */
  private async ensureAllVaultIdentities(): Promise<boolean> {
    let dirty = false
    for (const vault of this._vaults) {
      if (await this.ensureVaultIdentity(vault)) dirty = true
    }
    return dirty
  }

  private async ensureVaultIdentity(vault: VaultInfo): Promise<boolean> {
    let registryDirty = false
    const pathExists = await this.fileSystem.exists(vault.path)
    const meta = pathExists ? await this.readVaultIdentityMeta(vault.path) : null

    let id = meta?.id
    if (!id && isVaultId(vault.id)) id = vault.id
    if (!id) id = deriveLegacyVaultId(vault.name)

    if (vault.id !== id) {
      vault.id = id
      registryDirty = true
    }

    // 路径尚不存在时不写 vault.json（避免改名自愈前在旧路径建幽灵目录）
    if (pathExists) {
      const needsMetaWrite = !meta || meta.id !== vault.id || meta.displayName !== vault.name
      if (needsMetaWrite) {
        await this.writeVaultIdentityMeta(vault)
      }
    }

    return registryDirty
  }

  private vaultIdentityMetaPath(vaultPath: string): string {
    return path.join(vaultPath, '.baishou', VAULT_IDENTITY_META_FILENAME)
  }

  private async readVaultIdentityMeta(vaultPath: string): Promise<VaultIdentityMeta | null> {
    try {
      const raw = await this.fileSystem.readFile(this.vaultIdentityMetaPath(vaultPath), 'utf8')
      const parsed = JSON.parse(raw) as Partial<VaultIdentityMeta>
      if (!isVaultId(parsed.id)) return null
      return {
        id: parsed.id,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : ''
      }
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null
      return null
    }
  }

  private async writeVaultIdentityMeta(vault: VaultInfo): Promise<void> {
    const metaPath = this.vaultIdentityMetaPath(vault.path)
    await this.fileSystem.mkdir(path.dirname(metaPath), { recursive: true })
    const meta: VaultIdentityMeta = {
      id: vault.id,
      displayName: vault.name,
      createdAt: vault.createdAt.toISOString()
    }
    await this.fileSystem.writeFile(metaPath, JSON.stringify(meta), 'utf8')
  }

  /**
   * 冷启动：读本机 activeVaultId；无效则回退 lastAccessedAt 并回写本机偏好。
   */
  private async hydrateActiveVaultPreference(): Promise<void> {
    let preferred: string | null = null
    try {
      preferred = (await this.pathService.getLocalActiveVaultId?.()) ?? null
    } catch {
      preferred = null
    }
    const resolved = pickActiveVault(this._vaults, preferred)
    if (!resolved) {
      this._activeVaultId = null
      return
    }
    this._activeVaultId = resolved.id
    if (preferred !== resolved.id) {
      await this.persistActiveVaultId(resolved.id)
    }
  }

  private async persistActiveVaultId(vaultId: string): Promise<void> {
    this._activeVaultId = vaultId
    try {
      await this.pathService.setLocalActiveVaultId?.(vaultId)
    } catch {
      // 本机偏好写失败不阻断切仓；内存态仍生效至下次冷启动
    }
  }

  private async saveRegistry(registryFile: string): Promise<void> {
    await this.fileSystem.mkdir(path.dirname(registryFile), { recursive: true })

    const jsonStr = JSON.stringify(
      this._vaults.map((v) => ({
        id: v.id,
        name: v.name,
        path: v.path,
        createdAt: v.createdAt.toISOString(),
        lastAccessedAt: v.lastAccessedAt.toISOString()
      }))
    )

    await this.fileSystem.writeFile(registryFile, jsonStr, 'utf8')
  }
}
