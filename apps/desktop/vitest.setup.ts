import '@testing-library/jest-dom'
import i18n from 'i18next'

if (!i18n.isInitialized) {
  void i18n.init({
    lng: 'zh',
    fallbackLng: 'zh',
    resources: {},
    initImmediate: false
  })
}

// react-dom@19 在 jsdom unmount 时需要访问 window
if (typeof window === 'undefined') {
  ;(globalThis as any).window = globalThis
}
