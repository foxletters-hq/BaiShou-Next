/** WebDAV PROPFIND 浅层列举时，单目录内并发子目录扫描上限 */
export const WEBDAV_SHALLOW_LIST_CONCURRENCY = 4

function isIpv4Host(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

/** 缺协议时，局域网 NAS（群晖等）更常见 HTTP；公网主机仍默认 HTTPS */
export function inferWebDavDefaultScheme(hostOrUrlWithoutScheme: string): 'http' | 'https' {
  const host = (hostOrUrlWithoutScheme.split('/')[0] || '').toLowerCase().split(':')[0] || ''
  if (!host) return 'https'
  if (host === 'localhost' || host.endsWith('.local')) return 'http'
  if (!isIpv4Host(host)) return 'https'
  const octets = host.split('.').map(Number)
  const a = octets[0]
  const b = octets[1]
  if (a === undefined || b === undefined) return 'https'
  if (a === 10) return 'http'
  if (a === 172 && b >= 16 && b <= 31) return 'http'
  if (a === 192 && b === 168) return 'http'
  return 'https'
}

/**
 * 规范化 WebDAV 根 URL：补全协议、去掉末尾 `/`。
 * 移动端列举与上传/删除必须共用同一套规则，否则缺 scheme 时列举成功、传输会 Network request failed。
 */
export function normalizeWebDavBaseUrl(
  url: string | undefined | null,
  options?: { defaultScheme?: 'http' | 'https'; emptyFallback?: string }
): string {
  const emptyFallback = options?.emptyFallback ?? 'http://localhost'
  let safeUrl = (url || '').trim()
  if (!safeUrl) safeUrl = emptyFallback
  if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
    const defaultScheme = options?.defaultScheme ?? inferWebDavDefaultScheme(safeUrl)
    safeUrl = `${defaultScheme}://${safeUrl}`
  }
  return safeUrl.replace(/\/$/, '')
}

/**
 * 将 PROPFIND 返回的 href 解析为可继续请求的绝对 URL。
 * 群晖等 NAS 常在 href 里写内网 IP / 另一协议；浅层列举若直接跟随，Android fetch 会报 Network request failed。
 * 因此强制沿用用户配置的 origin，只替换 pathname。
 */
export function resolveWebDavListingUrl(
  configuredBaseUrl: string,
  href: string,
  options?: { asCollection?: boolean; defaultScheme?: 'http' | 'https'; emptyFallback?: string }
): string {
  const base = normalizeWebDavBaseUrl(configuredBaseUrl, options)
  const decoded = decodeURIComponent((href || '').trim())
  let absolute: string

  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    try {
      const baseUrl = new URL(base)
      const hrefUrl = new URL(decoded)
      absolute = `${baseUrl.origin}${hrefUrl.pathname}${hrefUrl.search}`
    } catch {
      absolute = decoded
    }
  } else if (decoded.startsWith('/')) {
    try {
      absolute = `${new URL(base).origin}${decoded}`
    } catch {
      absolute = `${base}${decoded}`
    }
  } else {
    absolute = `${base}/${decoded.replace(/^\//, '')}`
  }

  absolute = absolute.replace(/\/+$/, '')
  if (options?.asCollection) {
    absolute += '/'
  }
  return absolute
}

/** 目录 PROPFIND 使用带尾斜杠的 collection URL（群晖等对尾斜杠更敏感） */
export function ensureWebDavCollectionUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '')
  return trimmed ? `${trimmed}/` : '/'
}

/** 统一去掉末尾 `/`，用于浅层列举去重与父子比较 */
export function normalizeWebDavListingUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

/**
 * 判断 candidate 是否为 parent 的严格子路径（同 origin）。
 * 用于阻止 PROPFIND 响应里的父目录/兄弟目录被再次递归，避免列举风暴。
 */
export function isStrictWebDavChildUrl(parentUrl: string, candidateUrl: string): boolean {
  try {
    const parent = new URL(normalizeWebDavListingUrl(parentUrl))
    const child = new URL(normalizeWebDavListingUrl(candidateUrl))
    if (parent.origin !== child.origin) return false
    const parentPath = parent.pathname.replace(/\/+$/, '') || ''
    const childPath = child.pathname.replace(/\/+$/, '') || ''
    if (!childPath || childPath === parentPath) return false
    if (!parentPath) return childPath.startsWith('/')
    return childPath.startsWith(`${parentPath}/`)
  } catch {
    const parent = normalizeWebDavListingUrl(parentUrl)
    const child = normalizeWebDavListingUrl(candidateUrl)
    if (!parent || !child || parent === child) return false
    return child.startsWith(`${parent}/`)
  }
}

function isPrivateOrLocalWebDavHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return true
  if (!isIpv4Host(host)) return false
  const octets = host.split('.').map(Number)
  const a = octets[0]
  const b = octets[1]
  if (a === undefined || b === undefined) return false
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/**
 * HTTPS 连接失败时的明文回退候选（群晖 5006→5005；局域网自签 HTTPS→同主机 HTTP）。
 * 返回已去掉末尾 `/` 的 base URL；无法回退时返回 null。
 */
export function suggestWebDavHttpFallbackUrl(url: string | undefined | null): string | null {
  try {
    const normalized = normalizeWebDavBaseUrl(url)
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'https:') return null

    const port = parsed.port || '443'
    if (port === '5006') {
      parsed.protocol = 'http:'
      parsed.port = '5005'
      return parsed.toString().replace(/\/$/, '')
    }

    if (isPrivateOrLocalWebDavHost(parsed.hostname)) {
      parsed.protocol = 'http:'
      return parsed.toString().replace(/\/$/, '')
    }
  } catch {
    return null
  }
  return null
}

/** 将绝对 URL 的 origin 替换为新的 WebDAV base origin，保留 path/search */
export function rewriteWebDavUrlOrigin(absoluteUrl: string, newBaseUrl: string): string {
  const target = new URL(absoluteUrl)
  const base = new URL(normalizeWebDavBaseUrl(newBaseUrl))
  const hadTrailingSlash = /\/$/.test(absoluteUrl.trim())
  let next = `${base.origin}${target.pathname}${target.search}`
  next = next.replace(/\/+$/, '')
  if (hadTrailingSlash) next += '/'
  return next
}

/** 诊断日志用：只保留 scheme/host/port/path，不含账号 */
export function describeWebDavTarget(url: string | undefined | null): string {
  try {
    const parsed = new URL(normalizeWebDavBaseUrl(url))
    const port = parsed.port ? `:${parsed.port}` : ''
    return `${parsed.protocol}//${parsed.hostname}${port}${parsed.pathname}`
  } catch {
    return '(invalid-webdav-url)'
  }
}

/** 标准 PROPFIND 请求体（部分 NAS/代理对空 body 不友好） */
export const WEBDAV_PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:resourcetype/>
    <D:getlastmodified/>
    <D:getcontentlength/>
  </D:prop>
</D:propfind>`

/** 拼接 WebDAV 文件绝对 URL（basePath + 相对路径） */
export function buildWebDavFileUrl(
  webdavUrl: string | undefined | null,
  basePath: string,
  rel: string,
  options?: { defaultScheme?: 'http' | 'https'; emptyFallback?: string }
): string {
  const baseUrl = normalizeWebDavBaseUrl(webdavUrl, options)
  const remotePath = `${basePath}${rel}`.replace(/^\//, '')
  return `${baseUrl}/${remotePath}`
}

export type WebDavListEntry = {
  href: string
  isCollection: boolean
  lastModified?: Date
  sizeInBytes?: number
}

/**
 * 从 WebDAV PROPFIND XML 响应中提取资源 href（不经过 XML 实体展开计数，避免大目录失败）。
 */
export function parseWebDavPropfindEntries(xml: string): WebDavListEntry[] {
  const entries: WebDavListEntry[] = []
  const responseRegex = /<[^:]*:?response\b[^>]*>([\s\S]*?)<\/[^:]*:?response>/gi
  let responseMatch: RegExpExecArray | null

  while ((responseMatch = responseRegex.exec(xml))) {
    const block = responseMatch[1] || ''
    const hrefMatch = /<[^:]*:?href>([^<]+)<\/[^:]*:?href>/i.exec(block)
    if (!hrefMatch?.[1]) continue

    const href = decodeURIComponent(hrefMatch[1].trim())
    const isCollection =
      /<[^:]*:?collection\b/i.test(block) ||
      /<[^:]*:?resourcetype>\s*<[^:]*:?collection/i.test(block)

    const lastModMatch = /<[^:]*:?getlastmodified>([^<]+)<\/[^:]*:?getlastmodified>/i.exec(block)
    let lastModified: Date | undefined
    if (lastModMatch?.[1]) {
      const parsed = new Date(lastModMatch[1].trim())
      if (!Number.isNaN(parsed.getTime())) lastModified = parsed
    }

    const sizeMatch = /<[^:]*:?getcontentlength>(\d+)<\/[^:]*:?getcontentlength>/i.exec(block)
    const sizeInBytes = sizeMatch?.[1] ? parseInt(sizeMatch[1], 10) : undefined

    entries.push({ href, isCollection, lastModified, sizeInBytes })
  }

  return entries
}

/**
 * 将 WebDAV href 转为相对 basePath 的文件路径；目录以 `/` 结尾时返回 null。
 */
export function toRelativeWebDavPath(href: string, basePath: string): string | null {
  if (href.endsWith('/')) return null

  const normalizedBase = basePath.replace(/^\/+|\/+$/g, '')
  let rel = href

  const slashIdx = rel.indexOf(`/${normalizedBase}/`)
  if (slashIdx >= 0) {
    rel = rel.slice(slashIdx + normalizedBase.length + 2)
  } else if (rel.startsWith(`/${normalizedBase}`)) {
    rel = rel.slice(normalizedBase.length + 2)
  } else if (normalizedBase && rel.includes(normalizedBase)) {
    const idx = rel.indexOf(normalizedBase)
    rel = rel.slice(idx + normalizedBase.length).replace(/^\//, '')
  } else {
    rel = rel.split('/').pop() || rel
  }

  rel = rel.replace(/^\//, '')
  if (!rel || rel.includes('..')) return null
  return rel
}

export function isManagedIncrementalZipPath(relativePath: string): boolean {
  return /^BaiShou_.*\.zip$/i.test(relativePath)
}

/** 将 WebDAV HTTP 错误格式化为用户可读的同步失败说明 */
export function formatWebDavRequestError(
  action: string,
  status: number,
  statusText?: string
): string {
  const base = `WebDAV ${action}失败: HTTP ${status}${statusText ? ` ${statusText}` : ''}`
  if (status === 401) return `${base}（用户名或密码错误）`
  if (status === 403) return `${base}（请检查应用专用密码与目录读写权限）`
  if (status === 404) return `${base}（路径前缀不存在或 URL 配置有误）`
  if (status === 405) return `${base}（请确认服务端支持 WebDAV 且路径前缀可访问）`
  if (status === 429) return `${base}（请求过于频繁，请稍后重试）`
  if (status === 502 || status === 503 || status === 504) {
    return `${base}（服务暂时不可用或限流，请稍后重试）`
  }
  return base
}

/** MKCOL/上传等可退避重试的 HTTP 状态 */
export function isTransientWebDavHttpStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
}
