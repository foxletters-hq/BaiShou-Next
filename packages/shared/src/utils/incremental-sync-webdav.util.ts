/** WebDAV PROPFIND 浅层列举时，单目录内并发子目录扫描上限 */
export const WEBDAV_SHALLOW_LIST_CONCURRENCY = 4

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
  return base
}
