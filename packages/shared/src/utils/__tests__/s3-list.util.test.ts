import { describe, expect, it, vi } from 'vitest'
import { fetchAllS3ListPages, listAllS3Objects, parseS3ListObjectsXml } from '../s3-list.util'

describe('s3-list.util', () => {
  it.each([
    ['A&amp;B.txt', 'A&B.txt'],
    ['it&apos;s.txt', "it's.txt"],
    ['&quot;quote&quot;.txt', '"quote".txt'],
    ['&lt;name&gt;.txt', '<name>.txt'],
    ['A&#38;B.txt', 'A&B.txt'],
    ['A&#x26;B.txt', 'A&B.txt'],
    ['&#x1F600;.txt', '😀.txt'],
    ['line&#13;&#10;break.txt', 'line\r\nbreak.txt'],
    ['literal&amp;amp;.txt', 'literal&amp;.txt'],
    ['literal&#38;lt;.txt', 'literal&lt;.txt'],
    ['literal%26.txt', 'literal%26.txt'],
    ['unknown&custom;.txt', 'unknown&custom;.txt'],
    ['invalid&#0;&#xD800;&#x110000;.txt', 'invalid&#0;&#xD800;&#x110000;.txt']
  ])('should retain the object key when XML contains %s', (encoded, expected) => {
    const xml = `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>memories_sync/${encoded}</Key><Size>10</Size></Contents></ListBucketResult>`
    expect(parseS3ListObjectsXml(xml).objects[0]?.key).toBe(`memories_sync/${expected}`)
  })

  it('parses single page with truncation token', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>token-abc</NextContinuationToken>
  <Contents>
    <Key>backup_sync/a.txt</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <Size>10</Size>
  </Contents>
  <Contents>
    <Key>backup_sync/b.txt</Key>
    <LastModified>2024-01-02T00:00:00.000Z</LastModified>
    <Size>20</Size>
  </Contents>
</ListBucketResult>`

    const parsed = parseS3ListObjectsXml(xml)
    expect(parsed.isTruncated).toBe(true)
    expect(parsed.nextContinuationToken).toBe('token-abc')
    expect(parsed.objects).toEqual([
      { key: 'backup_sync/a.txt', lastModified: '2024-01-01T00:00:00.000Z', size: 10 },
      { key: 'backup_sync/b.txt', lastModified: '2024-01-02T00:00:00.000Z', size: 20 }
    ])
  })

  it('fetches all pages via continuation token', async () => {
    const pages = [
      `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>t2</NextContinuationToken><Contents><Key>k1</Key><Size>1</Size></Contents></ListBucketResult>`,
      `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>k2</Key><Size>2</Size></Contents></ListBucketResult>`
    ]
    let call = 0
    const all = await fetchAllS3ListPages(async (token) => {
      expect(token).toBe(call === 0 ? undefined : 't2')
      return pages[call++]!
    })
    expect(all.map((o) => o.key)).toEqual(['k1', 'k2'])
  })

  it('parses more than 1000 Contents blocks without XML entity limits', () => {
    const contents = Array.from(
      { length: 1002 },
      (_, i) => `<Contents><Key>memories_sync/file-${i}&amp;notes.md</Key><Size>1</Size></Contents>`
    ).join('')
    const xml = `<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`
    const parsed = parseS3ListObjectsXml(xml)
    expect(parsed.objects).toHaveLength(1002)
    expect(parsed.objects.map((object) => object.key)).toEqual(
      Array.from({ length: 1002 }, (_, i) => `memories_sync/file-${i}&notes.md`)
    )
  })

  it('should pass the decoded token to the next request when pagination contains XML references', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>next&amp;page&#x2B;&amp;amp;</NextContinuationToken><Contents><Key>A&amp;B.txt</Key><Size>1</Size></Contents></ListBucketResult>`
        )
      )
      .mockResolvedValueOnce(
        new Response(
          `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>second.txt</Key><Size>2</Size></Contents></ListBucketResult>`
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    try {
      const objects = await listAllS3Objects({
        endpoint: 'https://s3.example.com',
        bucket: 'bucket',
        prefix: '',
        region: 'us-east-1',
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key'
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const nextUrl = new URL(String(fetchMock.mock.calls[1]?.[0]))
      expect(nextUrl.searchParams.get('continuation-token')).toBe('next&page+&amp;')
      expect(objects.map((object) => object.key)).toEqual(['A&B.txt', 'second.txt'])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
