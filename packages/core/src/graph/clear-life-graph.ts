import type { DerivedFreshnessService } from '../raw-data/derived-freshness.service'
import type { GraphRawManager } from '../raw-data/managers/graph.raw-manager'

export async function clearLifeGraphData(input: {
  vaultId: string
  graphRepo: { deleteAllForVault(vaultId: string): Promise<void> }
  graphManager: GraphRawManager
  freshness?: DerivedFreshnessService
  stopExtract?: () => void
}): Promise<{ shardCount: number }> {
  const vaultId = input.vaultId.trim()
  if (!vaultId) throw new Error('clearLifeGraphData: vaultId is required')
  input.stopExtract?.()
  await input.graphRepo.deleteAllForVault(vaultId)
  const shardCount = await input.graphManager.wipeAllCollections()
  input.freshness?.clearReextractMarks()
  return { shardCount }
}
