import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { IVaultService, VaultInfo } from './vault.types'
import { IStoragePathService } from './storage-path.types'
import {
  VaultActiveDeleteError,
  VaultInvalidNameError,
  VaultNameExistsError,
  VaultNotFoundError
} from './vault.errors'
import { sanitizeVaultDirectoryName, validateVaultName } from './vault-name.util'
import {
  discoverVaultNames,
  readLegacyVaultRegistry,
  writeNextVaultRegistry
} from '../migration/legacy-migration.shared'

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
        const discovered = await discoverLegacyVaultNamesOnDisk(this.fileSystem, rootDir)
        if (discovered.length > 0) {
          this._vaults = await writeNextVaultRegistry(this.fileSystem, rootDir, discovered)
          shouldSave = false
        } else {
          const defaultVaultName = 'Personal'
          const defaultVaultPath = await this.pathService.getVaultDirectory(defaultVaultName)

          this._vaults = [
            {
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
          name: item.name,
          path: item.path,
          createdAt: parseRegistryTimestamp(item.createdAt, fallbackNow),
          lastAccessedAt: parseRegistryTimestamp(item.lastAccessedAt, fallbackNow)
        }))

        for (let i = 0; i < this._vaults.length; i++) {
          const vault = this._vaults[i]
          if (!vault) continue
          const expectedPath = path.join(rootDir, sanitizeVaultDirectoryName(vault.name))
          if (normalizeRegistryPath(vault.path) !== normalizeRegistryPath(expectedPath)) {
            vault.path = expectedPath
            shouldSave = true
          }
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
            const discovered = await discoverLegacyVaultNamesOnDisk(this.fileSystem, rootDir)
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
            name: 'Personal',
            path: defaultVaultPath,
            createdAt: new Date(),
            lastAccessedAt: new Date()
          }
        ]
        shouldSave = true
      }
    }

    if (shouldSave) {
      await this.saveRegistry(registryFile)
    }

    const activeVault = this.getActiveVault()
    if (activeVault) {
      await this.fileSystem.mkdir(activeVault.path, { recursive: true })
      try {
        await this.fileSystem.mkdir(path.join(activeVault.path, 'config'), { recursive: true })
      } catch {}
    }
  }

  public getActiveVault(): VaultInfo | null {
    if (this._vaults.length === 0) return null

    return (
      [...this._vaults].sort(
        (a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
      )[0] || null
    )
  }

  public getAllVaults(): VaultInfo[] {
    return [...this._vaults]
  }

  public vaultExists(vaultName: string): boolean {
    const result = validateVaultName(vaultName)
    if (!result.ok) return false
    return this._vaults.some((v) => v.name === result.name)
  }

  public async createVault(vaultName: string): Promise<void> {
    const name = this.resolveVaultNameOrThrow(vaultName)
    if (this._vaults.some((v) => v.name === name)) {
      throw new VaultNameExistsError(name)
    }
    await this.addNewVault(name)
    const rootDir = await this.pathService.getRootDirectory()
    await this.saveRegistry(path.join(rootDir, 'vault_registry.json'))
  }

  public async switchVault(vaultName: string): Promise<void> {
    const result = validateVaultName(vaultName)
    if (result.ok === false) {
      throw new VaultInvalidNameError(vaultName, result.reason)
    }
    const name = result.name
    const existingIndex = this._vaults.findIndex((v) => v.name === name)
    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')

    if (existingIndex !== -1) {
      const existing = this._vaults[existingIndex]
      if (existing) {
        existing.lastAccessedAt = new Date()
      }
    } else {
      this.resolveVaultNameOrThrow(name)
      await this.addNewVault(name)
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

  private async addNewVault(vaultName: string): Promise<void> {
    const newPath = await this.pathService.getVaultDirectory(vaultName)
    await this.fileSystem.mkdir(newPath, { recursive: true })
    await this.fileSystem.mkdir(await this.pathService.getVaultSystemDirectory(vaultName), {
      recursive: true
    })

    const newVault: VaultInfo = {
      name: vaultName,
      path: newPath,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    }
    this._vaults.push(newVault)
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
    const vaultPath = existing.path
    this._vaults.splice(existingIndex, 1)

    if (this._vaults.length === 0) {
      const p = await this.pathService.getVaultDirectory('Personal')
      this._vaults.push({
        name: 'Personal',
        path: p,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      })
    }

    const rootDir = await this.pathService.getRootDirectory()
    const registryFile = path.join(rootDir, 'vault_registry.json')
    await this.saveRegistry(registryFile)

    try {
      await this.fileSystem.rm(vaultPath, { recursive: true, force: true })
    } catch {}
  }

  private async saveRegistry(registryFile: string): Promise<void> {
    await this.fileSystem.mkdir(path.dirname(registryFile), { recursive: true })

    const jsonStr = JSON.stringify(
      this._vaults.map((v) => ({
        name: v.name,
        path: v.path,
        createdAt: v.createdAt.toISOString(),
        lastAccessedAt: v.lastAccessedAt.toISOString()
      }))
    )

    await this.fileSystem.writeFile(registryFile, jsonStr, 'utf8')
  }
}
