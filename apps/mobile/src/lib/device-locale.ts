import { Platform, NativeModules } from 'react-native'
import { resolveAppUiLanguageFromSystemLocale } from '@baishou/shared'

function readDeviceLocaleString(): string {
  try {
    if (Platform.OS === 'ios') {
      return (
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        'zh'
      )
    }
    if (Platform.OS === 'android') {
      return NativeModules.I18nManager?.localeIdentifier || 'zh'
    }
  } catch {
    /* fall through */
  }
  return 'zh'
}

/** 与根布局一致，供设置页「跟随系统」与 bootstrap 解析 UI 语言 */
export function getSystemLanguage(): string {
  return resolveAppUiLanguageFromSystemLocale(readDeviceLocaleString())
}

export function resolveAppUiLanguage(
  savedLanguage: string | undefined,
  i18nLanguage: string
): string {
  if (!savedLanguage || savedLanguage === 'system') {
    return getSystemLanguage()
  }
  return savedLanguage
}
