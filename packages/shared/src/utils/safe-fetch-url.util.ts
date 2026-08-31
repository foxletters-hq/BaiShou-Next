/**
 * HTTP(S) 地址校验。
 * 知识库导入允许内网；代理发起的 url_read 仍走公网限制，降低 SSRF。
 */

function assertHttpOrHttpsUrl(url: string): URL {
  const trimmed = url?.trim()
  if (!trimmed) throw new Error('url is required')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('invalid url')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('only http/https urls are allowed')
  }
  return parsed
}

function isIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

function isBlockedIpv4(host: string): boolean {
  if (!isIpv4(host)) return false
  const octets = host.split('.').map(Number)
  const a = octets[0]!
  const b = octets[1]!
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '0.0.0.0') return true
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    // rough IPv6 ULA / link-local
    if (host.includes(':')) return true
  }
  if (isBlockedIpv4(host)) return true
  return false
}

/**
 * 只要求 http/https，允许内网 / 本机（知识库用户主动导入）。
 */
export function assertSafeHttpUrl(url: string): void {
  assertHttpOrHttpsUrl(url)
}

/**
 * @throws Error 当 URL 非法或指向私网/本机
 */
export function assertSafePublicHttpUrl(url: string): void {
  const parsed = assertHttpOrHttpsUrl(url)
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('private or local network url is blocked')
  }
}
