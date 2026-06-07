// Polyfill for __dirname and __filename in Hermes (not available in New Architecture by default)
if (typeof global.__dirname === 'undefined') {
  global.__dirname = '/'
}
if (typeof global.__filename === 'undefined') {
  global.__filename = '/index.js'
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

// Register expo/fetch before any bundle code runs (AI SDK needs response.body streaming on RN).
try {
  const { fetch: expoFetch } = require('expo/fetch')
  if (typeof expoFetch === 'function') {
    globalThis.__expoFetch = expoFetch
  } else {
    console.warn('[POLYFILL] expo/fetch export is not a function')
  }
} catch (e) {
  console.warn('[POLYFILL] Failed to load expo/fetch:', e)
}

console.log('[POLYFILL] Metro-injected polyfill loaded. TDS=' + typeof globalThis.TextDecoderStream)
console.log('[POLYFILL] __expoFetch (metro):', typeof globalThis.__expoFetch)
