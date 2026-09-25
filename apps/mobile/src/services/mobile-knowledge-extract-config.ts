import {
  buildVisionLanguageSlots,
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  isVisionModel,
  resolveProviderModelSlot,
  normalizeKnowledgeDefaultExtractEngine,
  normalizeKnowledgeImportProcessMode,
  type AIProviderConfig,
  type KnowledgeConfig
} from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'

export const DEFAULT_MOBILE_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  defaultExtractEngine: 'ocr',
  importProcessMode: 'both',
  ocrLanguage: 'chi_sim+eng',
  ocrDpi: 250,
  ocrConcurrency: DEFAULT_OCR_CONCURRENCY,
  multiQueryAsk: false
}

export type MobileKnowledgeExtractProgress = {
  sourceId: string
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render' | 'embed'
}

type ProgressListener = (info: MobileKnowledgeExtractProgress) => void

const progressListeners = new Set<ProgressListener>()

export function subscribeMobileKnowledgeExtractProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

export function emitMobileKnowledgeExtractProgress(info: MobileKnowledgeExtractProgress): void {
  for (const listener of progressListeners) listener(info)
}

export async function mobileGetKnowledgeConfig(): Promise<KnowledgeConfig> {
  const settings = agentDbRuntimeRef.current?.settingsManager
  const raw = (await settings?.get<KnowledgeConfig>('knowledge_config')) || {}
  const merged = { ...DEFAULT_MOBILE_KNOWLEDGE_CONFIG, ...raw }
  merged.importProcessMode = normalizeKnowledgeImportProcessMode(merged.importProcessMode)
  merged.defaultExtractEngine = normalizeKnowledgeDefaultExtractEngine(merged.defaultExtractEngine)
  merged.ocrConcurrency = clampOcrConcurrency(merged.ocrConcurrency)
  return merged
}

export async function mobileSetKnowledgeConfig(
  patch: Partial<KnowledgeConfig>
): Promise<KnowledgeConfig> {
  const settings = agentDbRuntimeRef.current?.settingsManager
  if (!settings) throw new Error('runtime not ready')
  const current = await mobileGetKnowledgeConfig()
  const next = { ...current, ...patch }
  next.importProcessMode = normalizeKnowledgeImportProcessMode(next.importProcessMode)
  next.defaultExtractEngine = normalizeKnowledgeDefaultExtractEngine(next.defaultExtractEngine)
  next.ocrConcurrency = clampOcrConcurrency(next.ocrConcurrency)
  await settings.set('knowledge_config', next)
  return next
}

export async function resolveMobileKnowledgeExtractConfig(): Promise<{
  defaultEngine: KnowledgeConfig['defaultExtractEngine']
  ocrLanguage: string
  ocrDpi: number
  ocrConcurrency: number
  visionModelConfigured: boolean
  visionModelId: string | null
}> {
  const settings = agentDbRuntimeRef.current?.settingsManager
  const cfg = await mobileGetKnowledgeConfig()
  const providers = (await settings?.get<AIProviderConfig[]>('ai_providers')) || []
  const hit = resolveProviderModelSlot(
    providers,
    buildVisionLanguageSlots({
      visionProviderId: cfg.visionProviderId,
      visionModelId: cfg.visionModelId
    })
  )
  return {
    defaultEngine: cfg.defaultExtractEngine,
    ocrLanguage: cfg.ocrLanguage || 'chi_sim+eng',
    ocrDpi: cfg.ocrDpi || 250,
    ocrConcurrency: clampOcrConcurrency(cfg.ocrConcurrency),
    visionModelConfigured: Boolean(
      hit && isVisionModel(hit.modelId, hit.provider.type || hit.provider.id)
    ),
    visionModelId: hit?.modelId ?? null
  }
}
