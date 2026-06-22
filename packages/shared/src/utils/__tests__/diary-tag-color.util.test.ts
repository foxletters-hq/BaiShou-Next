import { describe, expect, it } from 'vitest'
import {
  DIARY_TAG_COLOR_COUNT,
  getDiaryTagColorIndex,
  mergeDiaryTagColorRegistries,
  normalizeDiaryTagColorRegistry,
  pickEntryTagColors,
  resolveDiaryTagColorIndex,
  syncDiaryTagColorRegistry
} from '../diary-tag-color.util'

describe('diary-tag-color.util', () => {
  it('同名标签索引稳定', () => {
    expect(getDiaryTagColorIndex('日记')).toBe(getDiaryTagColorIndex('日记'))
  })

  it('索引落在配色槽范围内', () => {
    expect(getDiaryTagColorIndex('abc')).toBeGreaterThanOrEqual(0)
    expect(getDiaryTagColorIndex('abc')).toBeLessThan(DIARY_TAG_COLOR_COUNT)
  })

  it('解析与合并注册表', () => {
    expect(normalizeDiaryTagColorRegistry('{"日记":1}')).toEqual({ 日记: 1 })
    expect(
      mergeDiaryTagColorRegistries({ 日记: 1 }, { 生活: 2 })
    ).toEqual({ 日记: 1, 生活: 2 })
  })

  it('优先使用持久化配色', () => {
    expect(resolveDiaryTagColorIndex('日记', { 日记: 2 })).toBe(2)
    expect(resolveDiaryTagColorIndex('新标签', {})).toBe(getDiaryTagColorIndex('新标签'))
  })

  it('删掉再输会换色', () => {
    const first = syncDiaryTagColorRegistry(['日记'], [], {})
    const index = first['日记']!
    const second = syncDiaryTagColorRegistry(['日记'], [], first)
    expect(second['日记']).not.toBe(index)
  })

  it('提取条目标签配色子集', () => {
    expect(pickEntryTagColors(['日记', '生活'], { 日记: 1, 其他: 3 })).toEqual({ 日记: 1 })
  })
})
