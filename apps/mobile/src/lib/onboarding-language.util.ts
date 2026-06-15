import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from 'i18next'
import {
  APP_UI_LANGUAGE_ORDER,
  resolveBootstrapUiLocale,
  type ResolvedAppUiLanguage
} from '@baishou/shared'
import {
  ensureDefaultLatteAssistant,
  syncDefaultLatteAssistantLocale,
  type AssistantManagerService,
  type SettingsManagerService
} from '@baishou/core-mobile'
import { ONBOARDING_STORAGE_KEY, ONBOARDING_UI_LANGUAGE_KEY } from '../constants/storage'
import { getSystemLanguage } from './device-locale'

export type OnboardingUiLanguage = ResolvedAppUiLanguage

const LANGUAGE_LABELS: Record<OnboardingUiLanguage, string> = {
  zh: '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語'
}

export const ONBOARDING_LANGUAGE_OPTIONS = APP_UI_LANGUAGE_ORDER.map((id) => ({
  id,
  label: LANGUAGE_LABELS[id]
}))

export function isOnboardingUiLanguage(value: string): value is OnboardingUiLanguage {
  return (APP_UI_LANGUAGE_ORDER as readonly string[]).includes(value)
}

export async function resolveMobileBootstrapUiLocale(
  settingsLanguage?: string | null
): Promise<ResolvedAppUiLanguage | null> {
  const hasOnboarded = (await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)) === '1'
  const onboardingLang = await readOnboardingUiLanguage()
  return resolveBootstrapUiLocale({
    savedLanguage: settingsLanguage,
    onboardingLanguage: onboardingLang,
    systemLocale: getSystemLanguage(),
    hasCompletedOnboarding: hasOnboarded
  })
}

export async function applyOnboardingUiLanguage(
  lang: OnboardingUiLanguage,
  deps?: {
    settingsManager?: SettingsManagerService
    assistantManager?: AssistantManagerService
  }
): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_UI_LANGUAGE_KEY, lang)
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang)
  }

  if (deps?.settingsManager) {
    const settings = (await deps.settingsManager.get<Record<string, unknown>>('settings')) || {}
    settings.language = lang
    await deps.settingsManager.set('settings', settings)
  }

  if (deps?.assistantManager) {
    await ensureDefaultLatteAssistant(deps.assistantManager, lang)
    await syncDefaultLatteAssistantLocale(deps.assistantManager, lang)
  }
}

export async function readOnboardingUiLanguage(): Promise<OnboardingUiLanguage | null> {
  const raw = await AsyncStorage.getItem(ONBOARDING_UI_LANGUAGE_KEY)
  if (raw && isOnboardingUiLanguage(raw)) return raw
  return null
}

export async function hasPersistedOnboardingUiLanguage(): Promise<boolean> {
  return (await readOnboardingUiLanguage()) !== null
}
