/**
 * HTTP header values must be ISO-8859-1 (ByteString). Electron's fetch rejects wider chars
 * (e.g. localized navigator.userAgent or mistaken non-ASCII API keys).
 */
export function toHttpHeaderByteString(value: string): string {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 255) {
      out += value[i]
    }
  }
  return out
}

function collectHeaderEntries(headers: HeadersInit): Array<[string, string]> {
  const entries: Array<[string, string]> = []

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      entries.push([key, value])
    })
    return entries
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (value != null) {
        entries.push([key, String(value)])
      }
    }
    return entries
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value != null) {
      entries.push([key, String(value)])
    }
  }
  return entries
}

export function sanitizeRequestHeaders(headers?: HeadersInit): HeadersInit | undefined {
  if (headers == null) {
    return headers
  }

  const sanitized = new Headers()
  for (const [key, value] of collectHeaderEntries(headers)) {
    sanitized.set(key, toHttpHeaderByteString(value))
  }
  return sanitized
}

export function sanitizeRequestInit(init?: RequestInit): RequestInit | undefined {
  if (!init) {
    return init
  }

  return {
    ...init,
    headers: sanitizeRequestHeaders(init.headers)
  }
}

function isReactNativeRuntime(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as { product?: string }).product === 'ReactNative'
  )
}

function resolvePlatformFetch(): typeof fetch {
  const expoFetch = (globalThis as any).__expoFetch
  if (typeof expoFetch === 'function') {
    return expoFetch
  }
  if (isReactNativeRuntime()) {
    console.warn(
      '[FetchAdapter] __expoFetch is missing on React Native; falling back to global fetch (no response.body streaming). Import apps/mobile polyfills before AI calls.'
    )
  }
  return globalThis.fetch.bind(globalThis)
}

const DEFAULT_OPENCODE_SESSION_ID = `sess-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

function hashStringHex(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5 ^ 0x9e3779b9
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ (c + (i & 0xff)), 0x01000193)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

export function resolveOpenCodeSessionIdFromBody(body?: unknown): string {
  if (typeof body !== 'string' || !body.trim()) {
    return DEFAULT_OPENCODE_SESSION_ID
  }
  try {
    const parsed = JSON.parse(body) as {
      system?: unknown
      messages?: Array<{ role?: string; content?: unknown }>
    }
    if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
      const firstUser =
        parsed.messages.find((m) => m && m.role === 'user') ??
        parsed.messages.find((m) => m && m.role !== 'system') ??
        parsed.messages[0]
      const seed = firstUser
        ? JSON.stringify(firstUser.content ?? '')
            .slice(0, 512)
            .trim()
        : ''
      if (seed && seed !== '""') {
        return `sess-${hashStringHex(seed)}`
      }
    }
  } catch {
    // ignore JSON parse errors
  }
  return DEFAULT_OPENCODE_SESSION_ID
}

export function isOpenCodeGoUrl(url: RequestInfo | URL): boolean {
  const urlStr = typeof url === 'string' ? url : url.toString()
  return /https?:\/\/([^/]+\.)?opencode\.ai(\/|$)/i.test(urlStr)
}

export function ensureOpenCodeSessionHeaders(
  init?: RequestInit,
  options?: { force?: boolean; url?: RequestInfo | URL }
): RequestInit | undefined {
  const safeInit = sanitizeRequestInit(init)
  const shouldApply = options?.force || (options?.url != null && isOpenCodeGoUrl(options.url))
  if (!shouldApply) {
    return safeInit
  }
  const headers = new Headers(safeInit?.headers)
  if (!headers.get('x-opencode-session')?.trim()) {
    headers.set('x-opencode-session', resolveOpenCodeSessionIdFromBody(safeInit?.body))
  }
  if (!headers.get('user-agent')?.trim()) {
    headers.set('user-agent', 'baishou-agent/1.0')
  }
  return {
    ...(safeInit ?? {}),
    headers
  }
}

export function createSanitizedFetch(
  fetchImpl?: typeof fetch,
  options?: { forceOpenCodeSession?: boolean }
): typeof fetch {
  const impl = fetchImpl || resolvePlatformFetch()
  return async (url, init) =>
    impl(
      url,
      ensureOpenCodeSessionHeaders(init, {
        force: options?.forceOpenCodeSession,
        url
      })
    )
}

export function sanitizeApiKeyForHttp(apiKey: string): string {
  return toHttpHeaderByteString(apiKey.trim())
}

export function assertAsciiApiKey(apiKey: string, label = 'API Key'): void {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return
  }
  const sanitized = sanitizeApiKeyForHttp(trimmed)
  if (sanitized !== trimmed) {
    throw new Error(
      `${label} contains non-ASCII characters. Paste only the key from your provider dashboard.`
    )
  }
}
