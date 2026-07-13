import { describe, it, expect } from 'vitest'
import {
  formatWebDavRequestError,
  isManagedIncrementalZipPath,
  parseWebDavPropfindEntries,
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
  })
})
