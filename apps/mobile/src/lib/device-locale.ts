import { Platform, NativeModules } from 'react-native'

/** 与根布局 `getSystemLanguage` 一致，供设置页「跟随系统」解析 UI 语言 */
export function getSystemLanguage(): string {
  try {
    let locale = 'zh'
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        'zh'
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'zh'
    }
    const cleanLang = locale.split(/[-_]/)[0]
    return ['zh', 'en', 'ja', 'zh-TW'].includes(cleanLang) ? cleanLang : 'zh'
  } catch {
    return 'zh'
  }
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
