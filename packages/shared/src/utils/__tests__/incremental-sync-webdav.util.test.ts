import { describe, it, expect } from 'vitest'
import {
  buildWebDavFileUrl,
  describeWebDavTarget,
  ensureWebDavCollectionUrl,
  formatWebDavRequestError,
  inferWebDavDefaultScheme,
  isManagedIncrementalZipPath,
  isStrictWebDavChildUrl,
  isTransientWebDavHttpStatus,
  normalizeWebDavBaseUrl,
  normalizeWebDavListingUrl,
  parseWebDavPropfindEntries,
  resolveWebDavListingUrl,
  suggestWebDavHttpFallbackUrl,
  toRelativeWebDavPath
} from '../incremental-sync-webdav.util'

describe('incremental-sync-webdav.util', () => {
  it('parses file and collection hrefs from PROPFIND xml', () => {
    const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/memories_sync/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/memories_sync/Personal/Journals/a.md</d:href>
    <d:propstat><d:prop><d:resourcetype/><d:getlastmodified>Mon, 01 Jan 2026 00:00:00 GMT</d:getlastmodified><d:getcontentlength>42</d:getcontentlength></d:prop></d:propstat>
  </d:response>
</d:multistatus>`

    const entries = parseWebDavPropfindEntries(xml)
    expect(entries).toHaveLength(2)
    expect(entries[0]?.isCollection).toBe(true)
    expect(entries[1]?.href).toContain('a.md')
    expect(entries[1]?.isCollection).toBe(false)
    expect(entries[1]?.lastModified?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(entries[1]?.sizeInBytes).toBe(42)
  })

  it('maps href to relative path under base prefix', () => {
    expect(toRelativeWebDavPath('/dav/memories_sync/Personal/Journals/a.md', 'memories_sync')).toBe(
      'Personal/Journals/a.md'
    )
    expect(toRelativeWebDavPath('/dav/memories_sync/', 'memories_sync')).toBeNull()
  })

  it('detects managed incremental zip filenames', () => {
    expect(isManagedIncrementalZipPath('BaiShou_IncrementalSync_1.zip')).toBe(true)
    expect(isManagedIncrementalZipPath('Personal/Journals/a.md')).toBe(false)
  })

  it('formats WebDAV HTTP errors with actionable hints', () => {
    expect(formatWebDavRequestError('列举目录', 403, 'Forbidden')).toContain('403')
    expect(formatWebDavRequestError('列举目录', 403, 'Forbidden')).toContain('应用专用密码')
    expect(formatWebDavRequestError('列举目录', 401)).toContain('用户名或密码错误')
    expect(formatWebDavRequestError('创建目录', 503)).toContain('服务暂时不可用')
    expect(formatWebDavRequestError('创建目录', 429)).toContain('过于频繁')
  })

  it('recognizes transient WebDAV HTTP statuses for retry', () => {
    expect(isTransientWebDavHttpStatus(503)).toBe(true)
    expect(isTransientWebDavHttpStatus(429)).toBe(true)
    expect(isTransientWebDavHttpStatus(404)).toBe(false)
    expect(isTransientWebDavHttpStatus(403)).toBe(false)
  })

  it('normalizes WebDAV base URL with missing scheme', () => {
    expect(normalizeWebDavBaseUrl('dav.example.com/remote.php/dav')).toBe(
      'https://dav.example.com/remote.php/dav'
    )
    expect(normalizeWebDavBaseUrl('http://nas.local/dav/')).toBe('http://nas.local/dav')
    expect(normalizeWebDavBaseUrl('https://dav.example.com/')).toBe('https://dav.example.com')
    expect(normalizeWebDavBaseUrl('nas.local', { defaultScheme: 'http' })).toBe('http://nas.local')
    expect(normalizeWebDavBaseUrl('192.168.1.10:5005')).toBe('http://192.168.1.10:5005')
    expect(normalizeWebDavBaseUrl('')).toBe('http://localhost')
    expect(inferWebDavDefaultScheme('192.168.1.10:5005')).toBe('http')
    expect(inferWebDavDefaultScheme('dav.example.com')).toBe('https')
  })

  it('builds file URL with the same base normalization as listing', () => {
    expect(buildWebDavFileUrl('dav.example.com/remote.php/dav', 'memories_sync/', 'a.md')).toBe(
      'https://dav.example.com/remote.php/dav/memories_sync/a.md'
    )
    expect(buildWebDavFileUrl('https://dav.example.com/dav/', 'sync/', 'dir/b.md')).toBe(
      'https://dav.example.com/dav/sync/dir/b.md'
    )
  })

  it('rewrites Synology absolute hrefs onto the configured origin', () => {
    const configured = 'https://alice.synology.me:5006'
    expect(
      resolveWebDavListingUrl(configured, 'http://192.168.1.20:5005/baishou_backup/Personal/', {
        asCollection: true
      })
    ).toBe('https://alice.synology.me:5006/baishou_backup/Personal/')

    expect(
      resolveWebDavListingUrl(configured, '/baishou_backup/Personal/Journals/', {
        asCollection: true
      })
    ).toBe('https://alice.synology.me:5006/baishou_backup/Personal/Journals/')

    expect(ensureWebDavCollectionUrl('https://nas.local:5005/webdav')).toBe(
      'https://nas.local:5005/webdav/'
    )
  })

  it('suggests Synology HTTP fallback from HTTPS 5006', () => {
    expect(suggestWebDavHttpFallbackUrl('https://192.168.1.20:5006')).toBe(
      'http://192.168.1.20:5005'
    )
    expect(suggestWebDavHttpFallbackUrl('https://192.168.1.20:5006/webdav')).toBe(
      'http://192.168.1.20:5005/webdav'
    )
    expect(suggestWebDavHttpFallbackUrl('http://192.168.1.20:5005')).toBeNull()
    expect(describeWebDavTarget('https://192.168.1.20:5006/baishou_backup/')).toContain(
      '192.168.1.20:5006'
    )
  })

  it('only treats strict child paths as WebDAV subdirs', () => {
    const parent = 'https://sion.yeqiyu.cn:54614/baishou'
    expect(isStrictWebDavChildUrl(parent, `${parent}/Personal`)).toBe(true)
    expect(isStrictWebDavChildUrl(parent, `${parent}/Personal/`)).toBe(true)
    expect(isStrictWebDavChildUrl(parent, parent)).toBe(false)
    expect(isStrictWebDavChildUrl(parent, `${parent}/`)).toBe(false)
    expect(isStrictWebDavChildUrl(`${parent}/Personal`, parent)).toBe(false)
    expect(isStrictWebDavChildUrl(`${parent}/Personal`, `${parent}/Personal81`)).toBe(false)
    expect(normalizeWebDavListingUrl(`${parent}/`)).toBe(parent)
  })
})
