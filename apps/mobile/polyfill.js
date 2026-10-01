// Polyfill for __dirname and __filename in Hermes (not available in New Architecture by default)
if (typeof global.__dirname === 'undefined') {
  global.__dirname = '/'
}
if (typeof global.__filename === 'undefined') {
  global.__filename = '/index.js'
}

// Hermes 没有浏览器 DOMException；Agent 流中止与部分 Web 库会构造它。
if (typeof globalThis.DOMException !== 'function') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message || '')
      this.name = name || 'Error'
    }
  }
}

// Zustand devtools / 部分 Web 库会在 RN 启动时调用 window.addEventListener。
// 新架构 Hermes 上 window 可能存在但没有 EventTarget 方法，导致 store 初始化失败。
;(() => {
  const w =
    typeof globalThis.window === 'object' && globalThis.window != null
      ? globalThis.window
      : globalThis
  if (globalThis.window == null) {
    globalThis.window = w
  }
  if (typeof w.addEventListener !== 'function') {
    w.addEventListener = () => {}
  }
  if (typeof w.removeEventListener !== 'function') {
    w.removeEventListener = () => {}
  }
  if (typeof w.dispatchEvent !== 'function') {
    w.dispatchEvent = () => false
  }
})()

// Hermes release bundle can execute polyfills before RN installs `console`.
const noop = () => {}
const consoleRef = globalThis.console
if (consoleRef == null || typeof consoleRef.log !== 'function') {
  globalThis.console = {
    log: noop,
    warn: noop,
    error: noop,
    info: noop,
    debug: noop
  }
}

// Fortified Polyfill for Node/Web modules (like webidl-conversions) that strictly enforce invasive property checks on SharedArrayBuffer in React Native
if (typeof global !== 'undefined' && typeof global.SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = function () {}
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'byteLength', {
    get: function () {
      return 0
    }
  })
  Object.defineProperty(global.SharedArrayBuffer.prototype, 'growable', {
    get: function () {
      return false
    }
  })
}

// MCP SDK WebStandardStreamableHTTPServerTransport 依赖全局 crypto.randomUUID()（桌面 Node 版用 node:crypto）。
if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  const randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  const existing = globalThis.crypto
  if (existing && typeof existing === 'object') {
    existing.randomUUID = randomUUID
  } else {
    globalThis.crypto = { randomUUID }
  }
}

// Register expo/fetch before any bundle code runs (AI SDK needs response.body streaming on RN).
try {
  const { fetch: expoFetch } = require('expo/fetch')
  if (typeof expoFetch === 'function') {
    globalThis.__expoFetch = expoFetch
  } else if (__DEV__) {
    console.warn('[POLYFILL] expo/fetch export is not a function')
  }
} catch (e) {
  if (__DEV__) {
    console.warn('[POLYFILL] Failed to load expo/fetch:', e)
  }
}

if (__DEV__) {
  console.log(
    '[POLYFILL] Metro-injected polyfill loaded. TDS=' + typeof globalThis.TextDecoderStream
  )
  console.log('[POLYFILL] __expoFetch (metro):', typeof globalThis.__expoFetch)
}
