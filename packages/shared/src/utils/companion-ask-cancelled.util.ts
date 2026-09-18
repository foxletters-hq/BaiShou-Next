import { APP_UI_LANGUAGE_ORDER } from '../constants/app-locale.constants'
import { translateMain } from './main-i18n.util'

export const COMPANION_ASK_CANCELLED_I18N_KEY = 'agent.tools.companion_ask_cancelled'

export const COMPANION_ASK_CANCELLED_DEFAULT = '用户取消了这一次操作'

export function companionAskCancelledMessage(locale?: string): string {
  return translateMain(locale, COMPANION_ASK_CANCELLED_I18N_KEY, COMPANION_ASK_CANCELLED_DEFAULT)
}

export function isCompanionAskCancelledMessage(text: string | null | undefined): boolean {
  const trimmed = text?.trim()
  if (!trimmed) return false
  return APP_UI_LANGUAGE_ORDER.some((locale) => companionAskCancelledMessage(locale) === trimmed)
}
