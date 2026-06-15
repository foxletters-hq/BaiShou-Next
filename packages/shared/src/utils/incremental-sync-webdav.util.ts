/** WebDAV PROPFIND 浅层列举时，单目录内并发子目录扫描上限 */
export const WEBDAV_SHALLOW_LIST_CONCURRENCY = 4

export type WebDavListEntry = {
  href: string
  isCollection: boolean
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

    entries.push({ href, isCollection })
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
