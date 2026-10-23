import { isEmbeddingModel, isTtsModel, isVisionModel } from '@baishou/shared'

export type KnowledgeModelMenuKind = 'embedding' | 'chat' | 'vision'

export type KnowledgeMenuProvider = {
  id: string
  name?: string
  type?: string
  models?: string[]
  enabledModels?: string[]
}

export function filterKnowledgeMenuProviders(
  providers: KnowledgeMenuProvider[],
  kind: KnowledgeModelMenuKind
): Array<{
  id: string
  name: string
  type: string
  models: string[]
  enabledModels: string[]
}> {
  return providers
    .map((provider) => {
      const modelList =
        provider.enabledModels && provider.enabledModels.length > 0
          ? provider.enabledModels
          : provider.models || []
      const enabledModels = modelList.filter((model) => {
        if (kind === 'embedding') return isEmbeddingModel(model)
        if (kind === 'vision') {
          return (
            !isEmbeddingModel(model) &&
            !isTtsModel(model) &&
            isVisionModel(model, provider.type || provider.id)
          )
        }
        return !isEmbeddingModel(model) && !isTtsModel(model)
      })
      return {
        id: provider.id,
        name: provider.name || provider.id,
        type: provider.type || 'custom',
        models: provider.models || [],
        enabledModels
      }
    })
    .filter((provider) => provider.enabledModels.length > 0)
}
