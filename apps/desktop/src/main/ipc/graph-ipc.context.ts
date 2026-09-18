import { connectionManager, GraphRepository } from '@baishou/database-desktop'
import { resolveActiveVaultId, vaultService } from './vault.ipc'

export function requireVaultName(): string {
  return vaultService.getActiveVault()?.name || 'Personal'
}

export function requireVaultId(): string {
  return resolveActiveVaultId()
}

export function requireGraphRepo(): GraphRepository {
  if (!connectionManager.isConnected()) {
    throw new Error('Agent database not connected')
  }
  return new GraphRepository(connectionManager.getDb())
}

export function parseProps(propsJson: string | null | undefined): Record<string, unknown> {
  try {
    return JSON.parse(propsJson || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/** Prefer record vaultId; never fall back to name-derived id (random-id vaults). */
export function writeVaultId(recordVaultId: string | null | undefined): string {
  return recordVaultId?.trim() || requireVaultId()
}
