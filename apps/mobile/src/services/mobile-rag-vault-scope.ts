import { deriveLegacyVaultId } from '@baishou/shared'
import type { AppDatabase } from '@baishou/database'
import { shadowConnectionManager } from '@baishou/database'
import type { VaultService } from '@baishou/core-mobile'
import type { MobileRagServiceDeps } from './mobile-rag.service'

export type MobileRagVaultScope = {
  resolveActiveVaultName(): Promise<string>
  resolveActiveVaultId(): Promise<string>
  resolveVaultIdByName(name: string): Promise<string>
  listVaultNames(): Promise<string[]>
  listVaultEntries(): Promise<Array<{ id: string; name: string }>>
  getShadowDb?(): AppDatabase | null
}

type PathServiceLike = {
  getActiveVaultNameForContext(): Promise<string>
}

export function createMobileRagVaultScope(deps: {
  pathService: PathServiceLike
  vaultService: VaultService
  getShadowDb?: () => AppDatabase | null
}): MobileRagVaultScope {
  const resolveVaultIdByName = async (name: string): Promise<string> => {
    const trimmed = name.trim()
    if (!trimmed) return deriveLegacyVaultId('Personal')
    await deps.vaultService.initRegistry()
    const fromRegistry = deps.vaultService.getAllVaults().find((v) => v.name === trimmed)
    return fromRegistry?.id ?? deriveLegacyVaultId(trimmed)
  }

  return {
    async resolveActiveVaultName() {
      try {
        const name = await deps.pathService.getActiveVaultNameForContext()
        return name.trim() || 'Personal'
      } catch {
        return 'Personal'
      }
    },
    async resolveActiveVaultId() {
      await deps.vaultService.initRegistry()
      const active = deps.vaultService.getActiveVault()
      if (active?.id) return active.id
      const name = await this.resolveActiveVaultName()
      return deriveLegacyVaultId(name)
    },
    resolveVaultIdByName,
    async listVaultNames() {
      await deps.vaultService.initRegistry()
      const names = deps.vaultService.getAllVaults().map((v) => v.name)
      return names.length > 0 ? names : ['Personal']
    },
    async listVaultEntries() {
      await deps.vaultService.initRegistry()
      const vaults = deps.vaultService.getAllVaults()
      return vaults.length > 0
        ? vaults.map((v) => ({ id: v.id, name: v.name }))
        : [{ id: deriveLegacyVaultId('Personal'), name: 'Personal' }]
    },
    getShadowDb:
      deps.getShadowDb ??
      (() => (shadowConnectionManager.isConnected() ? shadowConnectionManager.getDb() : null))
  }
}

export function attachMobileRagVaultScope(
  deps: Omit<MobileRagServiceDeps, 'vaultScope'>,
  pathService: PathServiceLike,
  vaultService: VaultService
): MobileRagServiceDeps {
  return {
    ...deps,
    vaultScope: createMobileRagVaultScope({ pathService, vaultService })
  }
}
