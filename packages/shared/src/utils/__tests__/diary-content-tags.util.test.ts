import { describe, expect, it } from 'vitest'
import {
  composeDiaryEditorContent,
  extractDiaryTagsFromContent,
  extractTagsFromTagLine,
  isDiaryTagLine,
  parseDiaryEditorContent,
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

  it('已有部分内联标签时只补缺失项', () => {
    expect(composeDiaryEditorContent('今天 #日记 很开心', ['日记', '生活'])).toBe(
      '今天 #日记 很开心 #生活'
    )
    expect(composeDiaryEditorContent('今天 #日记 很开心', ['日记'])).toBe('今天 #日记 很开心')
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
})
