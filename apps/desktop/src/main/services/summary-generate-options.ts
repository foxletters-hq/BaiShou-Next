import {
  buildSharedContextText,
  computeLookbackCutoffDate,
  formatLookbackCutoffIso,
  type SummaryGenerateOptions
} from '@baishou/core-desktop'
import {
  logger,
  resolveSummaryConfigFromSettings,
  resolveSummaryGenerationRuntime,
  resolveSummaryTemplatesForGeneration,
  resolveAppUiLanguageFromSystemLocale,
  withSummaryPromptLocaleFromUi,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type SummaryAssistantSnapshot,
  type SummaryConfig
} from '@baishou/shared'
import { app } from 'electron'
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
  const appSettings = (await settingsManager.get<{ language?: string }>('settings')) || {}
  const featureSettings =
    (await settingsManager.get<{ language?: string }>('feature_settings')) || {}
  const rawLanguage = featureSettings.language || appSettings.language
  const uiLang =
    !rawLanguage || rawLanguage === 'system'
      ? resolveAppUiLanguageFromSystemLocale(app.getLocale())
      : rawLanguage
  const { config: summaryConfigForGen, promptLocale } = withSummaryPromptLocaleFromUi(
    summaryConfig,
    uiLang
  )
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []

  let assistant: SummaryAssistantSnapshot | null = null
  const assistantId = summaryConfigForGen.generationAssistantId?.trim()
  if (summaryConfigForGen.generationMode === 'assistant' && assistantId) {
    try {
      const { assistantManager } = getAgentManagers()
      assistant = (await assistantManager.findById(assistantId)) ?? null
    } catch (e) {
      logger.warn('[SummaryQueue] Failed to load generation assistant:', e as Error)
    }
  }

  const runtime = resolveSummaryGenerationRuntime(summaryConfigForGen, assistant, providers)
  if (runtime.fellBackToPrompt) {
    logger.warn('[SummaryQueue] Assistant generation mode unavailable; falling back to prompt mode')
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
      sharedContextText = await buildSharedContextText(summaries, lookback, promptLocale, {
        diaries,
        userCopyPrefix: '',
        referenceDate: anchor,
        untilExclusive: periodStart ? anchor : undefined
      })
      if (!sharedContextText.trim()) {
        sharedContextText = undefined
      }
    } catch (e) {
      logger.warn('[SummaryQueue] Shared memory inject skipped:', e as Error)
      sharedContextText = undefined
    }
  }

  const customTemplates = resolveSummaryTemplatesForGeneration(
    summaryConfigForGen,
    promptLocale
  ) as Record<string, string>

  const globalModels =
    (await settingsManager.get<GlobalModelsConfig>('global_models')) || ({} as GlobalModelsConfig)
  const monthlySummarySource =
    globalModels.monthlySummarySource === 'diaries' ? 'diaries' : 'weeklies'

  // 无论提示词模式还是伙伴模式，总结模型一律用全局默认；伙伴模式只换 systemPrompt
  const resolution = resolveSummaryConfigFromSettings(providers, globalModels)
  if (!resolution.ok) {
    if (resolution.reason === 'no_api_key') {
      throw new Error(
        `No active provider with API key for summary generation (provider: ${
          resolution.providerName ?? 'unknown'
        })`
      )
    }
    if (resolution.reason === 'no_model') {
      throw new Error('No summary model configured')
    }
    throw new Error('No active AI provider configured for summary generation')
  }

  return {
    generateOptions: {
      modelId: resolution.modelId,
      providerId: resolution.providerConfig.id,
      systemPrompt: runtime.systemPrompt,
      customTemplates,
      promptLocale: promptLocale as SummaryGenerateOptions['promptLocale'],
      sharedContextText,
      monthlySummarySource
    },
    fellBackToPrompt: runtime.fellBackToPrompt
  }
}
