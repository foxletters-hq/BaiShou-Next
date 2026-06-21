import { TextEncoderStream, TextDecoderStream } from '@stardazed/streams-text-encoding'
import { fetch as expoFetch } from 'expo/fetch'
import * as ExpoCrypto from 'expo-crypto'
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
