import { describe, it, expect } from 'vitest'
import { parseJournalMarkdown, splitJournalFrontmatter } from '../journal-markdown.parser'

const LEGACY_FRONTMATTER = `---
id: 1772890752147
createdAt: "2025-02-20T21:37:48.815608"
updatedAt: "2026-03-27T09:50:27.225280"
weather: null
mood: null
location: null
locationDetail: null
isFavorite: false
tags:
- "市集"
- "陪伴"
- "甜蜜"
mediaPaths: []
---`

describe('journal-markdown.parser', () => {
  it('应剥离标准 frontmatter 并保留正文', () => {
    const raw = `${LEGACY_FRONTMATTER}
##### 21:37:48

今天去了市集`
    const parsed = parseJournalMarkdown(raw, '2025-02-20')
    expect(parsed?.content).toBe('##### 21:37:48\n\n今天去了市集')
    expect(parsed?.tags).toEqual(['市集', '陪伴', '甜蜜'])
    expect(parsed?.id).toBe(1772890752147)
    expect(parsed?.isFavorite).toBe(false)
  })

  it('应兼容闭合 --- 后无换行直接接正文', () => {
    const raw = `---
id: 1
date: 2025-02-20
tags:
- "日记"
---##### 标题

正文`
    const parsed = parseJournalMarkdown(raw, '2025-02-20')
    expect(parsed?.content).toBe('##### 标题\n\n正文')
    expect(parsed?.tags).toEqual(['日记'])
  })

  it('应兼容仅 frontmatter 无正文', () => {
    const raw = `---
id: 2
date: 2025-02-20
---`
    const parsed = parseJournalMarkdown(raw, '2025-02-20')
    expect(parsed?.content).toBe('')
  })

  it('应剥离 UTF-8 BOM', () => {
    const raw = `\uFEFF---
id: 3
date: 2025-02-20
---
正文`
    expect(splitJournalFrontmatter(raw)?.body).toBe('正文')
  })

  it('应解析内联 tags 数组', () => {
    const raw = `---
id: 4
date: 2025-02-20
tags: [日记, 生活]
---
内容`
    const parsed = parseJournalMarkdown(raw, '2025-02-20')
    expect(parsed?.tags).toEqual(['日记', '生活'])
  })

  it('应解析 tag_colors JSON', () => {
    const raw = `---
id: 5
date: 2025-02-20
tags: [日记, 生活]
tag_colors: {"日记":1,"生活":3}
---
内容`
    const parsed = parseJournalMarkdown(raw, '2025-02-20')
    expect(parsed?.tagColors).toEqual({ 日记: 1, 生活: 3 })
  })
})
