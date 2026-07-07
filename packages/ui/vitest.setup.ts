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

/** codemirror-markdown-tables 检测 hover 能力 */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
}

/** codemirror-markdown-tables 表格尺寸观测 */
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
}
