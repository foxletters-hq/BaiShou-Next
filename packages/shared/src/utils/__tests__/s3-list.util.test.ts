import { describe, expect, it } from 'vitest'
import { fetchAllS3ListPages, parseS3ListObjectsXml } from '../s3-list.util'

describe('s3-list.util', () => {
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
})
