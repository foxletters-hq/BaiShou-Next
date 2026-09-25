import type { CompanionAskPresentation } from './tool-result.util'

/** 还在等用户作答时，工具行标题保持「正在提问...」，副标题带上问题，选项留给确认卡。 */
export function companionAskWaitingSubtitle(
  presentation: CompanionAskPresentation | null | undefined
): string | undefined {
  const question = presentation?.question?.trim()
  return question || undefined
}

export function isCompanionAskAwaitingAnswer(
  presentation: CompanionAskPresentation | null | undefined,
  extras?: { hasResult?: boolean }
): boolean {
  if (extras?.hasResult) return false
  if (!presentation || presentation.declined) return false
  if (presentation.answer) return false
  if (presentation.selectedOptionIds.length > 0) return false
  if (
    presentation.items?.some((item) => Boolean(item.answer) || item.selectedOptionIds.length > 0)
  ) {
    return false
  }
  return true
}
