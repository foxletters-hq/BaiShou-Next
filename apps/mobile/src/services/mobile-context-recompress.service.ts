import { ContextCompressorService, AIProviderRegistry } from '@baishou/ai'
import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import type { SettingsManagerService } from '@baishou/core-mobile'
import { isConfiguredDialogueModelId } from '@baishou/shared'
import type { RecompressResult } from '@baishou/store'

export type MobileContextRecompressDeps = {
  sessionRepo: SessionRepository
  snapshotRepo: SnapshotRepository
  settingsManager: SettingsManagerService
  registry: AIProviderRegistry
}

/** 对齐 desktop agent:recompress-context IPC：按当前快照范围重新生成对话摘要。 */
export async function recompressSessionContext(
  deps: MobileContextRecompressDeps,
  sessionId: string
): Promise<RecompressResult> {
  const session = await deps.sessionRepo.getSessionById(sessionId)
  if (!session) {
    return { ok: false, error: 'Session not found' }
  }

  const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
  const globalModels = await deps.settingsManager.get<any>('global_models')

  const providerId = session.providerId ?? globalModels?.globalDialogueProviderId
  const modelId = session.modelId ?? globalModels?.globalDialogueModelId

  const config =
    providers.find((p: any) => p.id === providerId) || providers.find((p: any) => p.isEnabled)

  if (!config) {
    return { ok: false, error: 'No active provider configured' }
  }

  const provider = deps.registry.getOrUpdateProvider(config)
  const resolvedModelId = modelId || config.defaultDialogueModel || config.models?.[0]

  if (!resolvedModelId || !isConfiguredDialogueModelId(resolvedModelId)) {
    return { ok: false, error: 'No model configured for this session' }
  }

  return ContextCompressorService.recompressCurrentSnapshot(
    provider,
    resolvedModelId,
    deps.sessionRepo,
    deps.snapshotRepo,
    sessionId,
    undefined,
    config.type ?? config.providerType ?? ''
  )
}
