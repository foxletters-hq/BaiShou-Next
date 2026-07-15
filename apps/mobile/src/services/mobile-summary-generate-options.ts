import {
  logger,
  resolveSummaryGenerationRuntime,
  resolveSummaryTemplatesForGeneration,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type SummaryConfig
} from '@baishou/shared'
import type { SummaryGenerateOptions } from '@baishou/core-mobile'
import type { SettingsManagerService, AssistantManagerService } from '@baishou/core-mobile'
import { resolveSummaryConfig } from './mobile-summary-config.util'

export async function resolveMobileSummaryGenerateOptions(deps: {
  settingsManager: SettingsManagerService
  assistantManager: AssistantManagerService
  buildSharedContext: (
    lookbackMonths: number,
    locale?: string,
    userCopyPrefix?: string,
    window?: { referenceDate?: Date; untilExclusive?: Date }
  ) => Promise<string>
  /** 目标总结周期起点；注入共同回忆时锚定「本期之前」 */
  periodStart?: Date
}): Promise<{
  generateOptions: SummaryGenerateOptions
  providerIdForLog?: string
  usedDialogueFallback?: boolean
  fellBackToPrompt: boolean
}> {
  const { settingsManager, assistantManager, buildSharedContext, periodStart } = deps
  const summaryConfig =
    (await settingsManager.get<SummaryConfig>('summary_config')) || ({} as SummaryConfig)
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels =
    (await settingsManager.get<GlobalModelsConfig>('global_models')) || ({} as GlobalModelsConfig)
  const monthlySummarySource =
    globalModels.monthlySummarySource === 'diaries' ? 'diaries' : 'weeklies'

  let assistant = null
  const assistantId = summaryConfig.generationAssistantId?.trim()
  if (summaryConfig.generationMode === 'assistant' && assistantId) {
    try {
      assistant = (await assistantManager.findById(assistantId)) ?? null
    } catch (e) {
      logger.warn('[MobileSummaryQueue] Failed to load generation assistant:', e as Error)
    }
  }

  const runtime = resolveSummaryGenerationRuntime(summaryConfig, assistant, providers)
  if (runtime.fellBackToPrompt) {
    logger.warn(
      '[MobileSummaryQueue] Assistant generation mode unavailable; falling back to prompt mode'
    )
  }

  let sharedContextText: string | undefined
  if (runtime.injectSharedMemoryBeforeGenerate) {
    try {
      const anchor = periodStart ?? new Date()
      // 显式传空串，避免 builder 回落到 settings 里的复制前缀
      const text = await buildSharedContext(
        runtime.sharedMemoryLookbackMonths,
        summaryConfig.promptLocale,
        '',
        periodStart
          ? { referenceDate: anchor, untilExclusive: anchor }
          : undefined
      )
      sharedContextText = text.trim() ? text : undefined
    } catch (e) {
      logger.warn('[MobileSummaryQueue] Shared memory inject skipped:', e as Error)
      sharedContextText = undefined
    }
  }

  const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig) as Record<
    string,
    string
  >
  const promptLocale = (summaryConfig.promptLocale ?? 'zh') as SummaryGenerateOptions['promptLocale']

  if (runtime.mode === 'assistant' && runtime.modelId && runtime.providerId) {
    return {
      generateOptions: {
        modelId: runtime.modelId,
        providerId: runtime.providerId,
        systemPrompt: runtime.systemPrompt,
        customTemplates,
        promptLocale,
        sharedContextText,
        monthlySummarySource
      },
      providerIdForLog: runtime.providerId,
      fellBackToPrompt: false
    }
  }

  const resolution = await resolveSummaryConfig(settingsManager)
  if (!resolution.ok) {
    if (resolution.reason === 'no_api_key') {
      throw new Error(
        `No active provider with API key for summary generation (provider: ${
          resolution.providerName ?? 'unknown'
        })`
      )
    }
    throw new Error('No summary model configured')
  }

  return {
    generateOptions: {
      modelId: resolution.modelId,
      systemPrompt: runtime.systemPrompt,
      customTemplates,
      promptLocale,
      sharedContextText,
      monthlySummarySource
    },
    providerIdForLog: resolution.providerConfig.id,
    usedDialogueFallback: resolution.isFallback,
    fellBackToPrompt: runtime.fellBackToPrompt
  }
}
