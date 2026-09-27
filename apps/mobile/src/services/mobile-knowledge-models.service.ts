import {
  filterProvidersForModelSwitcher,
  type AIProviderConfig,
  type GlobalModelsConfig
} from '@baishou/shared'
import { getDefaultGlobalModels } from '@baishou/store'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { resolveMobileEmbeddingForHydration } from './mobile-raw-data-source.runtime'

export async function mobileGetKnowledgeProcessLabels(): Promise<{
  embeddingModelId: string | null
  embeddingModelLabel: string
  graphModelLabel: string
}> {
  const runtime = agentDbRuntimeRef.current
  const settings = runtime?.settingsManager
  const global =
    (await settings?.get<GlobalModelsConfig>('global_models')) || getDefaultGlobalModels()
  const emb = settings
    ? await resolveMobileEmbeddingForHydration(settings)
    : { embeddingModelId: null as string | null }
  return {
    embeddingModelId: emb.embeddingModelId || global.globalEmbeddingModelId || null,
    embeddingModelLabel: global.globalEmbeddingModelId || '',
    graphModelLabel: global.globalGraphModelId || ''
  }
}

export async function mobileSetGlobalKnowledgeModel(input: {
  field: 'embedding' | 'graph'
  providerId: string
  modelId: string
}): Promise<GlobalModelsConfig> {
  const settings = agentDbRuntimeRef.current?.settingsManager
  if (!settings) throw new Error('runtime not ready')
  const current =
    (await settings.get<GlobalModelsConfig>('global_models')) || getDefaultGlobalModels()
  const next = { ...getDefaultGlobalModels(), ...current }
  if (input.field === 'embedding') {
    next.globalEmbeddingProviderId = input.providerId
    next.globalEmbeddingModelId = input.modelId
  } else {
    next.globalGraphProviderId = input.providerId
    next.globalGraphModelId = input.modelId
  }
  await settings.set('global_models', next)
  return next
}

export async function mobileListKnowledgeModelOptions(
  mode: 'embedding' | 'dialogue'
): Promise<Array<{ label: string; value: string }>> {
  const settings = agentDbRuntimeRef.current?.settingsManager
  const providers = (await settings?.get<AIProviderConfig[]>('ai_providers')) || []
  const filtered = filterProvidersForModelSwitcher(providers, mode)
  const options: Array<{ label: string; value: string }> = []
  for (const provider of filtered) {
    for (const model of provider.enabledModels || []) {
      options.push({
        label: `${provider.name || provider.id} / ${model}`,
        value: `${provider.id}::${model}`
      })
    }
  }
  return options
}
