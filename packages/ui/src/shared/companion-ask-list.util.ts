import type { CompanionAskPresentation } from './tool-result.util'

/** 还在等用户作答时，消息列表只显示「正在提问...」，选项留给确认卡。 */
export function isCompanionAskAwaitingAnswer(
  presentation: CompanionAskPresentation | null | undefined
): boolean {
  return Boolean(presentation && !presentation.declined && !presentation.answer)
}

export function shouldRenderCompanionAskResultInList(
  presentation: CompanionAskPresentation | null | undefined,
  status: 'loading' | 'success' | 'error'
): presentation is CompanionAskPresentation {
  if (!presentation || status === 'loading' || status === 'error') return false
  return presentation.declined || Boolean(presentation.answer)
}
