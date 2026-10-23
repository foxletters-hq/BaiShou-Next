import {
  getKnowledgeIngestService,
  handleKnowledgeIpc,
  requireActiveVaultId,
  requireKnowledgeRepo,
  withCoverImageUrl
} from './knowledge-ipc.context'

export function registerKnowledgeNotebookIpc(): void {
  handleKnowledgeIpc(
    'knowledge:create-notebook',
    async (
      _e,
      input: { name: string; description?: string; coverTone?: string; coverIcon?: string }
    ) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.createNotebook(input))
    }
  )

  handleKnowledgeIpc('knowledge:list-notebooks', async () => {
    const svc = getKnowledgeIngestService()
    const rows = await svc.listNotebooks()
    return Promise.all(rows.map((row) => withCoverImageUrl(row)))
  })

  handleKnowledgeIpc('knowledge:list-mount-summaries', async () => {
    const repo = requireKnowledgeRepo()
    const vaultId = requireActiveVaultId()
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
        const withCover = await withCoverImageUrl(notebook)
        return {
          id: notebook.id,
          name: notebook.name,
          coverTone: notebook.coverTone,
          coverIcon: notebook.coverIcon,
          coverImageUrl: withCover.coverImageUrl,
          updatedAt: notebook.updatedAt,
          sources: stat?.sources ?? 0,
          chunks: stat?.chunks ?? 0,
          dimension: dimensions.length === 1 ? dimensions[0] : null,
          dimensions,
          modelIds: [...new Set(notebookProfiles.map((row) => row.modelId).filter(Boolean))],
          mixedEmbeddings: dimensions.length > 1,
          graphNodes: graph?.nodes ?? 0,
          graphEdges: graph?.edges ?? 0
        }
      })
    )
  })

  handleKnowledgeIpc(
    'knowledge:update-notebook',
    async (
      _e,
      input: {
        notebookId: string
        name?: string
        description?: string
        coverTone?: string | null
        coverIcon?: string | null
        coverImage?: string | null
      }
    ) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.updateNotebook(input))
    }
  )

  handleKnowledgeIpc(
    'knowledge:set-cover-image',
    async (_e, input: { notebookId: string; absolutePath: string }) => {
      const svc = getKnowledgeIngestService()
      return withCoverImageUrl(await svc.setCoverImage(input))
    }
  )

  handleKnowledgeIpc('knowledge:reorder-notebooks', async (_e, orderedIds: string[]) => {
    const svc = getKnowledgeIngestService()
    const rows = await svc.reorderNotebooks(Array.isArray(orderedIds) ? orderedIds : [])
    return Promise.all(rows.map((row) => withCoverImageUrl(row)))
  })

  handleKnowledgeIpc('knowledge:get-notebook', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    const row = await repo.getNotebook(String(notebookId || ''))
    return row ? withCoverImageUrl(row) : null
  })

  handleKnowledgeIpc('knowledge:list-notebook-stats', async () => {
    const repo = requireKnowledgeRepo()
    return repo.listNotebookStats(requireActiveVaultId())
  })

  handleKnowledgeIpc('knowledge:delete-notebook', async (_e, notebookId: string) => {
    const svc = getKnowledgeIngestService()
    await svc.deleteNotebook(String(notebookId || ''))
    return { deleted: true }
  })
}
