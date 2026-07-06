import { describe, expect, it } from 'vitest'
import {
  composeDiaryEditorContent,
  extractDiaryTagsFromContent,
  extractTagsFromTagLine,
  isDiaryTagLine,
  parseDiaryEditorContent,
  resolveDiaryTagsFromSources,
  stripDedicatedTagLinesFromContent,
  stripDiaryTagLineFromContent
} from '../diary-content-tags.util'

describe('diary-content-tags.util', () => {
  it('识别标签行与 Markdown 标题', () => {
    expect(isDiaryTagLine('#日记 #生活')).toBe(true)
    expect(isDiaryTagLine('')).toBe(true)
    expect(isDiaryTagLine('# 一级标题')).toBe(false)
    expect(isDiaryTagLine('##### 12:30:45')).toBe(false)
  })

  it('从标签行提取标签', () => {
    expect(extractTagsFromTagLine('#日记 #生活 #日记')).toEqual(['日记', '生活'])
  })

  it('从全文扫描内联标签', () => {
    const full = '##### 12:30:45\n\n今天去了 #市集 很开心，#生活'
    expect(extractDiaryTagsFromContent(full)).toEqual(['市集', '生活'])
  })

  it('跳过 Markdown 标题行中的 #', () => {
    const body = '## 周末计划\n\n#日记 写在正文里'
    expect(extractDiaryTagsFromContent(body)).toEqual(['日记'])
  })

  it('解析时正文保留内联标签', () => {
    const full = '##### 12:30:45\n\n今天 #日记 很开心'
    expect(parseDiaryEditorContent(full)).toEqual({
      tags: ['日记'],
      body: full
    })
  })

  it('合成时把时间戳块后的 FM 标签补进正文', () => {
    const body = '##### 12:30:45\n\n今天很开心'
    expect(composeDiaryEditorContent(body, ['日记', '生活'])).toBe(
      '##### 12:30:45\n\n#日记 #生活\n\n今天很开心'
    )
  })

  it('正文已有内联标签时不再从元数据重复注入', () => {
    expect(composeDiaryEditorContent('今天 #日记 很开心', ['日记', '生活'])).toBe(
      '今天 #日记 很开心'
    )
    expect(composeDiaryEditorContent('今天 #日记 很开心', ['日记'])).toBe('今天 #日记 很开心')
  })

  it('无内联标签时仍从元数据补全（旧数据迁移）', () => {
    expect(composeDiaryEditorContent('今天很开心', ['日记', '生活'])).toBe(
      '#日记 #生活\n\n今天很开心'
    )
  })

  it('无标签时正文原样保留', () => {
    const body = '##### 12:00:00\n\n正文'
    expect(parseDiaryEditorContent(body)).toEqual({ tags: [], body })
    expect(stripDiaryTagLineFromContent(body)).toBe(body)
  })

  it('剥离旧版首行纯标签行', () => {
    expect(stripDiaryTagLineFromContent('#日记\n\n正文')).toBe('正文')
    expect(stripDiaryTagLineFromContent('正文 #日记')).toBe('正文 #日记')
  })

  it('合并 frontmatter 与正文内联标签', () => {
    expect(resolveDiaryTagsFromSources(['日记'], '今天 #生活 很开心')).toEqual(['日记', '生活'])
    expect(resolveDiaryTagsFromSources([], '#疲惫 #深夜\n\n正文')).toEqual(['疲惫', '深夜'])
  })

  it('预览时剥离独立标签行，保留正文内联标签', () => {
    const full = '#疲惫 #深夜 #反思\n\n##### 12:00\n\n今天 #市集 很开心'
    expect(stripDedicatedTagLinesFromContent(full)).toBe('##### 12:00\n\n今天 #市集 很开心')
  })
})
