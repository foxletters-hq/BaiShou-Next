import i18n from 'i18next'
;(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true

if (!i18n.isInitialized) {
  void i18n.init({
    lng: 'zh',
    fallbackLng: 'zh'
  })
}
