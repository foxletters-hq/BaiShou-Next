/** Map UI / store locale to i18next language code. */
export function resolveAppLanguage(locale?: string): string {
  const normalized = (locale || 'zh').toLowerCase().replace('_', '-')
  if (normalized === 'system' || normalized === '') {
    return 'zh'
  }
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return 'zh-TW'
  }
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('en')) return 'en'
  return 'en'
}
