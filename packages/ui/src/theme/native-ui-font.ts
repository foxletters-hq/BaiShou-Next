export type NativeUiFontRole = 'sc' | 'tc' | 'jp' | 'latin'

/** 原生 Text 只接受单个字族名，不能写 CSS 回退栈。 */
const FONT_FAMILY: Record<NativeUiFontRole, string> = {
  sc: 'Noto Sans SC',
  tc: 'Noto Sans TC',
  jp: 'Noto Sans JP',
  latin: 'Noto Sans'
}

export function resolveNativeUiFontRole(language?: string | null): NativeUiFontRole {
  const lang = (language || 'zh').replace('_', '-')
  if (lang === 'zh-TW' || lang.startsWith('zh-HK') || lang.startsWith('zh-Hant')) return 'tc'
  if (lang.startsWith('ja')) return 'jp'
  if (lang.startsWith('en')) return 'latin'
  return 'sc'
}

export function nativeUiFontFamilyName(role: NativeUiFontRole): string {
  return FONT_FAMILY[role]
}

export function nativeUiFontFamilyFromLanguage(language?: string | null): string {
  return nativeUiFontFamilyName(resolveNativeUiFontRole(language))
}
