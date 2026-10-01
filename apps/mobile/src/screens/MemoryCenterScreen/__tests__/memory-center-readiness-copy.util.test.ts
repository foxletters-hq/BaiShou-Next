import { describe, expect, it } from 'vitest'
import type { MemoryReadinessRow } from '@baishou/shared'
import {
  memoryProviderTypeOf,
  memoryReadinessRowById,
  memoryReadinessRowLabel,
  memoryReadinessRowOpensModels,
  memoryReadinessRowValue,
  memoryVectorMetaLine
} from '../memory-center-readiness-copy.util'

const t = (key: string, fallback: string, options?: Record<string, unknown>) => {
  if (options?.count != null) return `${fallback}:${options.count}`
  return fallback
}

describe('memory readiness copy', () => {
  it('should label embedding extract vector and graph rows', () => {
    expect(memoryReadinessRowLabel('embedding', t)).toBe('嵌入模型')
    expect(memoryReadinessRowLabel('extract', t)).toBe('关系抽取')
    expect(memoryReadinessRowLabel('vector', t)).toBe('向量片段')
    expect(memoryReadinessRowLabel('graph', t)).toBe('关系图谱')
  })

  it('should show pending count and missing state', () => {
    const pending: MemoryReadinessRow = { id: 'vector', state: 'pending', count: 3 }
    expect(memoryReadinessRowValue(pending, t)).toBe('未整理 {{count}} 篇:3')
    expect(memoryReadinessRowValue({ id: 'embedding', state: 'missing' }, t)).toBe('未配置')
  })

  it('should open global models only for embedding and extract rows', () => {
    expect(memoryReadinessRowOpensModels('embedding')).toBe(true)
    expect(memoryReadinessRowOpensModels('extract')).toBe(true)
    expect(memoryReadinessRowOpensModels('vector')).toBe(false)
    expect(memoryReadinessRowOpensModels('graph')).toBe(false)
  })

  it('should resolve provider type from the provider list', () => {
    expect(
      memoryProviderTypeOf(
        [
          { id: 'p1', type: 'openai' },
          { id: 'p2', type: 'deepseek' }
        ],
        'p2'
      )
    ).toBe('deepseek')
    expect(memoryProviderTypeOf([{ id: 'p1', type: 'openai' }], 'missing')).toBeUndefined()
    expect(memoryProviderTypeOf([], undefined)).toBeUndefined()
    expect(memoryProviderTypeOf(undefined, 'p1')).toBeUndefined()
  })

  it('should return undefined when readiness rows are missing', () => {
    expect(memoryReadinessRowById(undefined, 'embedding')).toBeUndefined()
    expect(memoryReadinessRowById([{ id: 'embedding', state: 'missing' }], 'embedding')).toEqual({
      id: 'embedding',
      state: 'missing'
    })
  })

  it('should join vector count and dimension into one line', () => {
    expect(memoryVectorMetaLine(12, 1536, t)).toBe('{{count}} 条片段:12 · {{dim}} 维')
    expect(memoryVectorMetaLine(0, 0, t)).toBe('{{count}} 条片段:0 · 维度未检测')
  })
})
