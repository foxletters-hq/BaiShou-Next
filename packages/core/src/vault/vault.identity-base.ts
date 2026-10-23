import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  IVaultService,
  VAULT_IDENTITY_META_FILENAME,
  VaultIdentityMeta,
  VaultInfo
} from './vault.types'
import { IStoragePathService } from './storage-path.types'
import { VaultInvalidNameError, VaultNameExistsError, VaultNotFoundError } from './vault.errors'
import {
  findConflictingVaultName,
  normalizeVaultNameForCompare,
  sanitizeVaultDirectoryName,
  validateVaultName
} from './vault-name.util'
import { createRandomVaultId, deriveLegacyVaultId, isVaultId } from './vault-id.util'
import { pickActiveVault } from './active-vault.util'
import { SYNC_MANIFEST_FILENAME, SYNC_MANIFEST_VERSION, type SyncManifest } from '@baishou/shared'
import { normalizeRegistryPath } from './vault-registry.util'

export abstract class VaultIdentityBase implements Pick<
  IVaultService,
  'getActiveVault' | 'getAllVaults'
> {
  protected _vaults: VaultInfo[] = []
  /** 本机活跃仓 id 缓存（与 pathService 本地持久化对齐；不进注册表） */
  protected _activeVaultId: string | null = null

  constructor(
    protected readonly pathService: IStoragePathService,
    protected readonly fileSystem: IFileSystem
  ) {}

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
    return Boolean(
      findConflictingVaultName(
        result.name,
        this._vaults.map((v) => v.name)
      )
    )
  }

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

  protected resolveVaultNameOrThrow(vaultName: string): string {
    const result = validateVaultName(vaultName)
    if (result.ok === false) {
      throw new VaultInvalidNameError(vaultName, result.reason)
    }
    return result.name
  }

  protected resolveVaultOrThrow(nameOrId: string): VaultInfo {
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

  protected assertVaultNameAvailable(name: string, options?: { excludeVaultId?: string }): void {
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

  protected vaultIdentityMetaPath(vaultPath: string): string {
    return path.join(vaultPath, '.baishou', VAULT_IDENTITY_META_FILENAME)
  }

  protected async readVaultIdentityMeta(vaultPath: string): Promise<VaultIdentityMeta | null> {
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

  protected async writeVaultIdentityMeta(vault: VaultInfo): Promise<void> {
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
   * 三级 ID 来源回落并回写缺失级别：
   * 1. `<vault>/.baishou/vault.json`
   * 2. 注册表条目 id
   * 3. 从名字确定性派生（存量兜底；全新创建应在进入前已赋随机 id）
   */
  protected async ensureAllVaultIdentities(): Promise<boolean> {
    let dirty = false
    for (const vault of this._vaults) {
      if (await this.ensureVaultIdentity(vault)) dirty = true
    }
    return dirty
  }

  protected async ensureVaultIdentity(vault: VaultInfo): Promise<boolean> {
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

  protected async hydrateActiveVaultPreference(): Promise<void> {
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

  protected async persistActiveVaultId(vaultId: string): Promise<void> {
    this._activeVaultId = vaultId
    try {
      await this.pathService.setLocalActiveVaultId?.(vaultId)
    } catch {
      // 本机偏好写失败不阻断切仓；内存态仍生效至下次冷启动
    }
  }

  protected async saveRegistry(registryFile: string): Promise<void> {
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

  protected async addNewVault(
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

  protected vaultMatchesDiskFolder(vault: VaultInfo, diskFolderName: string): boolean {
    const diskNorm = normalizeVaultNameForCompare(diskFolderName)
    if (normalizeVaultNameForCompare(vault.name) === diskNorm) return true
    if (normalizeVaultNameForCompare(sanitizeVaultDirectoryName(vault.name)) === diskNorm) {
      return true
    }
    const pathBase = normalizeRegistryPath(vault.path).split('/').pop()
    return pathBase !== undefined && normalizeVaultNameForCompare(pathBase) === diskNorm
  }

  protected registryCoversDiskFolder(diskFolderName: string): boolean {
    return this._vaults.some((vault) => this.vaultMatchesDiskFolder(vault, diskFolderName))
  }

  protected async readLocalSyncManifest(): Promise<SyncManifest | null> {
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
}
