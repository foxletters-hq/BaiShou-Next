import { getMobileNotebookRawManager } from './mobile-raw-data-source.runtime'
import {
  ensureMobileKnowledgeRepo as requireRepo,
  resolveMobileActiveVaultId
} from './mobile-knowledge-repo'

async function resolveCoverUri(relativePath?: string | null): Promise<string | null> {
  const rel = String(relativePath || '').trim()
  if (!rel) return null
  const manager = getMobileNotebookRawManager()
  if (!manager) return null
  try {
    const abs = await manager.absolutePath(rel)
    if (!abs) return null
    return abs.startsWith('file://')
      ? abs
      : abs.startsWith('/')
        ? `file://${abs}`
        : `file:///${abs}`
  } catch {
    return null
  }
}

export async function mobileListMountSummaries() {
  const repo = await requireRepo()
  const vaultId = await resolveMobileActiveVaultId()
  const notebooks = await repo.listNotebooks({ vaultId })
  const stats = await repo.listNotebookStats(vaultId)
  const statsById = new Map(stats.map((row) => [row.notebookId, row]))
  const profiles = await repo.listNotebookEmbeddingProfiles({
    vaultId,
    notebookIds: notebooks.map((row) => row.id)
  })
  const graphCounts = await repo.listNotebookGraphCounts(vaultId)
  const graphById = new Map(graphCounts.map((row) => [row.notebookId, row]))
  const profilesById = new Map<string, typeof profiles>()
  for (const profile of profiles) {
    const list = profilesById.get(profile.notebookId) ?? []
    list.push(profile)
    profilesById.set(profile.notebookId, list)
  }
  return Promise.all(
    notebooks.map(async (notebook) => {
      const stat = statsById.get(notebook.id)
      const notebookProfiles = profilesById.get(notebook.id) ?? []
      const dimensions = [...new Set(notebookProfiles.map((row) => row.dimension))]
      const graph = graphById.get(notebook.id)
      return {
        id: notebook.id,
        name: notebook.name,
        coverTone: notebook.coverTone,
        coverIcon: notebook.coverIcon,
        coverImageUrl: await resolveCoverUri(notebook.coverImage),
        sources: stat?.sources ?? 0,
        chunks: stat?.chunks ?? 0,
        dimension: dimensions.length === 1 ? dimensions[0]! : null,
        mixedEmbeddings: dimensions.length > 1,
        graphNodes: graph?.nodes ?? 0,
        graphEdges: graph?.edges ?? 0
      }
    })
  )
}
