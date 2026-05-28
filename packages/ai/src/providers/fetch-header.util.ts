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

export function createSanitizedFetch(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): typeof fetch {
  return async (url, init) => fetchImpl(url, sanitizeRequestInit(init))
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
