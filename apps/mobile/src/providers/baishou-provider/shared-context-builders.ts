import {
  buildSharedContextText,
  computeLookbackCutoffDate,
  computeSharedMemoryCopyPreview,
  formatLookbackCutoffIso
} from '@baishou/core-mobile'
import type { SummaryConfig, SharedMemoryCopyPreview } from '@baishou/shared'
import type { SummaryManagerService, SettingsManagerService } from '@baishou/core-mobile'
import type { VaultBoundDiaryStack } from '../../services/mobile-vault-runtime.service'

export function createSharedContextBuilders(deps: {
  diaryStackRef: { current: VaultBoundDiaryStack | null }
  summaryManager: SummaryManagerService
  settingsManager: SettingsManagerService
}) {
  const { diaryStackRef, summaryManager, settingsManager } = deps
  const buildSharedContext = async (
    lookbackMonths: number,
    locale?: string,
    userCopyPrefix?: string
  ) => {
    const stack = diaryStackRef.current
    if (!stack) return ''
    const cutoff = computeLookbackCutoffDate(lookbackMonths)
    const allSummaries = await summaryManager.listForGallery({ endAfter: cutoff })
    const diaries = await stack.shadowRepo.listContentSinceDate(formatLookbackCutoffIso(lookbackMonths))
    const prefix =
      userCopyPrefix ??
      (await settingsManager.get<SummaryConfig>('summary_config'))?.sharedMemoryCopyPrefix
    return buildSharedContextText(allSummaries, lookbackMonths, locale, {
      diaries,
      userCopyPrefix: prefix
    })
  }

  const buildSharedContextPreview = async (
    lookbackMonths: number,
    options?: { userCopyPrefix?: string; locale?: string }
  ) => {
    const stack = diaryStackRef.current
    const empty: SharedMemoryCopyPreview = {
      lookbackMonths,
      yearly: 0,
      quarterly: 0,
      monthly: 0,
      weekly: 0,
      diary: 0,
      total: 0,
      estimatedChars: 0,
      estimatedTokens: 0
    }
    if (!stack) return empty
    const cutoff = computeLookbackCutoffDate(lookbackMonths)
    const allSummaries = await summaryManager.listForGallery({ endAfter: cutoff })
    const diaries = await stack.shadowRepo.listContentSinceDate(formatLookbackCutoffIso(lookbackMonths))
    const summaryConfig = (await settingsManager.get<SummaryConfig>('summary_config')) || {}
    const userCopyPrefix = options?.userCopyPrefix ?? summaryConfig.sharedMemoryCopyPrefix
    return computeSharedMemoryCopyPreview(allSummaries, diaries, lookbackMonths, {
      userCopyPrefix,
      locale: options?.locale
    })
  }
  return { buildSharedContext, buildSharedContextPreview }
}
