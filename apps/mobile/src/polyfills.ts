import { TextEncoderStream, TextDecoderStream } from '@stardazed/streams-text-encoding'
import { fetch as expoFetch } from 'expo/fetch'
;(globalThis as any).TextEncoderStream = TextEncoderStream
;(globalThis as any).TextDecoderStream = TextDecoderStream

// React Native's globalThis.fetch does not expose response.body as a ReadableStream.
// expo/fetch provides native JSI-based streaming that the AI SDK requires.
if (typeof expoFetch !== 'function') {
  console.error('[POLYFILL] expo/fetch is not available; AI streaming will fail on mobile.')
} else {
  ;(globalThis as any).__expoFetch = expoFetch
}

console.log(
  '[POLYFILL] _layout.tsx polyfill loaded. TDS=' + typeof (globalThis as any).TextDecoderStream
)
console.log('[POLYFILL] __expoFetch set:', typeof (globalThis as any).__expoFetch)
