import type { AppDatabase } from '@baishou/database'
import { shadowConnectionManager } from '@baishou/database'
import type { VaultService } from '@baishou/core-mobile'
import type { MobileRagServiceDeps } from './mobile-rag.service'

export type MobileRagVaultScope = {
  resolveActiveVaultName(): Promise<string>
  listVaultNames(): Promise<string[]>
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
  return {
    async resolveActiveVaultName() {
      try {
        const name = await deps.pathService.getActiveVaultNameForContext()
        return name.trim() || 'Personal'
      } catch {
        return 'Personal'
      }
    },
    async listVaultNames() {
      await deps.vaultService.initRegistry()
      const names = deps.vaultService.getAllVaults().map((v) => v.name)
      return names.length > 0 ? names : ['Personal']
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
