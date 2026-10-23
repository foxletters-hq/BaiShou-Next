import { describe, expect, it } from 'vitest'
import { extractEpubPageTexts } from '../extract-epub.util'
import { writeZipStore } from '../zip-entries.util'

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('extractEpubPageTexts', () => {
  it('reads spine HTML in order and strips tags', () => {
    const zip = writeZipStore([
      {
        name: 'META-INF/container.xml',
        data: encode(
          '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
        )
      },
      {
        name: 'OEBPS/content.opf',
        data: encode(
          '<package><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'
        )
      },
      {
        name: 'OEBPS/c1.xhtml',
        data: encode(
          '<html><head><title>一</title></head><body><h1>第一章</h1><p>视听语言是电影艺术的基础，蒙太奇通过镜头组接创造新的意义。</p></body></html>'
        )
      },
      {
        name: 'OEBPS/c2.xhtml',
        data: encode(
          '<html><body><h1>第二章</h1><p>场面调度决定人物在空间中的位置与关系，声音则补足画面信息。</p></body></html>'
        )
      }
    ])

    const pages = extractEpubPageTexts(zip)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain('第一章')
    expect(pages[0]).toContain('视听语言是电影艺术的基础')
    expect(pages[1]).toContain('第二章')
    expect(pages[1]).not.toContain('<p>')
  })
})
