import {
  buildSharedContextText,
  computeLookbackCutoffDate,
  formatLookbackCutoffIso,
  type SummaryGenerateOptions
} from '@baishou/core-desktop'
import {
  logger,
  resolveSummaryGenerationRuntime,
  resolveSummaryTemplatesForGeneration,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type SummaryConfig
} from '@baishou/shared'
import { settingsManager } from '../ipc/settings.ipc'
import { getAgentManagers } from '../ipc/agent-helpers'
import { getActiveVaultShadowRepo } from '../ipc/vault.ipc'
import type { SummaryManagerService } from '@baishou/core-desktop'

export type DesktopSummaryGenerateResolution = {
  generateOptions: SummaryGenerateOptions
  fellBackToPrompt: boolean
}

/** 按当前 summary_config 解析一次生成任务的模型/人设/共同回忆注入参数 */
export async function resolveDesktopSummaryGenerateOptions(
  summaryManager: SummaryManagerService,
  /** 目标总结周期起点；注入共同回忆时锚定「本期之前」 */
  periodStart?: Date
): Promise<DesktopSummaryGenerateResolution> {
  const summaryConfig =
    (await settingsManager.get<SummaryConfig>('summary_config')) || ({} as SummaryConfig)
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []

  let assistant = null
  const assistantId = summaryConfig.generationAssistantId?.trim()
  if (summaryConfig.generationMode === 'assistant' && assistantId) {
    try {
      const { assistantManager } = getAgentManagers()
      assistant = (await assistantManager.findById(assistantId)) ?? null
    } catch (e) {
      logger.warn('[SummaryQueue] Failed to load generation assistant:', e as Error)
    }
  }

  const runtime = resolveSummaryGenerationRuntime(summaryConfig, assistant, providers)
  if (runtime.fellBackToPrompt) {
    logger.warn(
      '[SummaryQueue] Assistant generation mode unavailable; falling back to prompt mode'
    )
  }

  let sharedContextText: string | undefined
  if (runtime.injectSharedMemoryBeforeGenerate) {
    try {
      const lookback = runtime.sharedMemoryLookbackMonths
      const anchor = periodStart ?? new Date()
      const cutoff = computeLookbackCutoffDate(lookback, anchor)
      const summaries = await summaryManager.listForGallery({ endAfter: cutoff })
      const diaries = await getActiveVaultShadowRepo().listContentSinceDate(
        formatLookbackCutoffIso(lookback, anchor)
      )
      // 生成注入不含复制前缀（前缀面向「复制给外部」话术）
      // 窗口锚定本期 startDate：只注入「本期开始之前」的共同回忆
      sharedContextText = await buildSharedContextText(
        summaries,
        lookback,
        summaryConfig.promptLocale,
        {
          diaries,
          userCopyPrefix: '',
          referenceDate: anchor,
          untilExclusive: periodStart ? anchor : undefined
        }
      )
      if (!sharedContextText.trim()) {
        sharedContextText = undefined
      }
    } catch (e) {
      logger.warn('[SummaryQueue] Shared memory inject skipped:', e as Error)
      sharedContextText = undefined
    }
  }

  const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig) as Record<
    string,
    string
  >
  const promptLocale = summaryConfig.promptLocale ?? 'zh'

  const globalModels =
    (await settingsManager.get<GlobalModelsConfig>('global_models')) || ({} as GlobalModelsConfig)
  const monthlySummarySource =
    globalModels.monthlySummarySource === 'diaries' ? 'diaries' : 'weeklies'

  if (runtime.mode === 'assistant' && runtime.modelId && runtime.providerId) {
    return {
      generateOptions: {
        modelId: runtime.modelId,
        providerId: runtime.providerId,
        systemPrompt: runtime.systemPrompt,
        customTemplates,
        promptLocale: promptLocale as SummaryGenerateOptions['promptLocale'],
        sharedContextText,
        monthlySummarySource
      },
      fellBackToPrompt: false
    }
  }

  return {
    generateOptions: {
      modelId: runtime.modelId,
      providerId: runtime.providerId,
      systemPrompt: runtime.systemPrompt,
      customTemplates,
      promptLocale: promptLocale as SummaryGenerateOptions['promptLocale'],
      sharedContextText,
      monthlySummarySource
    },
    fellBackToPrompt: runtime.fellBackToPrompt
  }
}
