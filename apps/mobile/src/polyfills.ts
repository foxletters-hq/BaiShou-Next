import { TextEncoderStream, TextDecoderStream } from '@stardazed/streams-text-encoding'
import { fetch as expoFetch } from 'expo/fetch'
import * as ExpoCrypto from 'expo-crypto'

/** Hermes 没有浏览器 DOMException；必须写在其它业务代码之前。 */
function ensureDomExceptionPolyfill(): void {
  if (typeof (globalThis as { DOMException?: unknown }).DOMException === 'function') return
  ;(globalThis as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message ?? '')
      this.name = name || 'Error'
    }
  }
}

/**
 * React Native 自带的 abort-controller 不支持 AbortSignal.prototype.reason。
 * AI SDK 在流被取消时会读取 abortSignal.reason，若为 undefined 会将结果 Promise 以 undefined 拒绝。
 */
export function ensureAbortSignalReasonPolyfill(): void {
  const Controller = (globalThis as { AbortController?: typeof AbortController }).AbortController
  const Signal = (globalThis as { AbortSignal?: typeof AbortSignal }).AbortSignal
  if (typeof Controller !== 'function' || typeof Signal !== 'function') return

  const testController = new Controller()
  testController.abort()
  if ((testController.signal as { reason?: unknown }).reason !== undefined) {
    return
  }

  const reasons = new WeakMap<AbortSignal, unknown>()
  const createDefaultAbortError = (): Error => {
    const DomEx = (
      globalThis as { DOMException?: new (message?: string, name?: string) => Error }
    ).DOMException
    if (typeof DomEx === 'function') {
      return new DomEx('The operation was aborted.', 'AbortError')
    }
    const err = new Error('The operation was aborted.')
    err.name = 'AbortError'
    return err
  }

  const originalAbort = Controller.prototype.abort
  Controller.prototype.abort = function abortWithReason(this: AbortController, reason?: unknown) {
    if (this.signal && !this.signal.aborted && !reasons.has(this.signal)) {
      reasons.set(this.signal, reason !== undefined ? reason : createDefaultAbortError())
    }
    return originalAbort.call(this, reason)
  }

  Object.defineProperty(Signal.prototype, 'reason', {
    configurable: true,
    enumerable: true,
    get(this: AbortSignal): unknown {
      if (!this.aborted) return undefined
      if (reasons.has(this)) return reasons.get(this)
      const fallback = createDefaultAbortError()
      reasons.set(this, fallback)
      return fallback
    }
  })
}

ensureDomExceptionPolyfill()
ensureAbortSignalReasonPolyfill()
;(globalThis as any).TextEncoderStream = TextEncoderStream
;(globalThis as any).TextDecoderStream = TextDecoderStream

/** MCP WebStandardStreamableHTTPServerTransport 在 RN 上需要 Web Crypto（桌面 Node 版走 node:crypto） */
function ensureWebCryptoPolyfill(): void {
  const g = globalThis as typeof globalThis & { crypto?: Crypto }
  if (typeof g.crypto?.randomUUID === 'function') return

  const randomUUID = () => ExpoCrypto.randomUUID() as ReturnType<NonNullable<Crypto['randomUUID']>>

  if (g.crypto && typeof g.crypto === 'object') {
    g.crypto.randomUUID = randomUUID
    return
  }

  g.crypto = { randomUUID } as Crypto
}

ensureWebCryptoPolyfill()

// React Native's globalThis.fetch does not expose response.body as a ReadableStream.
// expo/fetch provides native JSI-based streaming that the AI SDK requires.
if (typeof expoFetch !== 'function') {
  if (__DEV__) {
    console.error('[POLYFILL] expo/fetch is not available; AI streaming will fail on mobile.')
  }
} else {
  ;(globalThis as any).__expoFetch = expoFetch
}

// 安装移动端全局字阶缩放
import { installNativeFontScaling } from '@baishou/ui/native'
installNativeFontScaling()
