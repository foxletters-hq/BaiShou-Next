import { readGraphNameRegistry } from '@baishou/shared'
import { parseProps, requireGraphRepo, writeVaultId } from './graph-ipc.context'
import { toNameCandidate, type GraphNameCandidate } from './graph-name-candidates.util'

export type { GraphNameCandidate }

export { toNameCandidate }

export async function listNameCandidatesForNode(nodeId: string): Promise<GraphNameCandidate[]> {
  const repo = requireGraphRepo()
  const node = await repo.getNodeById(nodeId)
  if (!node) return []
  const vaultId = writeVaultId(node.vaultId)
  const rows = await repo.findNodesByNameOrAlias(vaultId, node.name, node.nodeType)
  const bare = rows.find((row) => !(row.discriminator ?? '')) ?? rows[0] ?? node
  const registry = readGraphNameRegistry(parseProps(bare.propsJson))
  const labelById = new Map(registry.map((entry) => [entry.nodeId, entry.label]))
  const seen = new Set<string>()
  const candidates: GraphNameCandidate[] = []
  for (const row of rows) {
    seen.add(row.id)
    candidates.push(toNameCandidate(row, labelById.get(row.id)))
  }
  for (const entry of registry) {
    if (seen.has(entry.nodeId)) continue
    seen.add(entry.nodeId)
    candidates.push({
      nodeId: entry.nodeId,
      name: node.name,
      discriminator: entry.discriminator,
      label: entry.label
    })
  }
  return candidates
}

export async function listSplitEdgesForNode(nodeId: string): Promise<
  Array<{
    edgeId: string
    edgeType: string
    partnerName: string
    sourceRef: string | null
    sourceExcerpt: string
  }>
> {
  const repo = requireGraphRepo()
  const node = await repo.getNodeById(nodeId)
  if (!node) return []
  const vaultId = writeVaultId(node.vaultId)
  const edges = await repo.listEdgesTouching(vaultId, nodeId)
  const partnerIds = [
    ...new Set(edges.map((edge) => (edge.fromId === nodeId ? edge.toId : edge.fromId)))
  ]
  const partners = await repo.getNodesByIds(vaultId, partnerIds)
  const nameById = new Map(partners.map((partner) => [partner.id, partner.name]))
  return edges.map((edge) => {
    const partnerId = edge.fromId === nodeId ? edge.toId : edge.fromId
    return {
      edgeId: edge.id,
      edgeType: edge.edgeType,
      partnerName: nameById.get(partnerId) || partnerId,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt ?? ''
    }
  })
}
