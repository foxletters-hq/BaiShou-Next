import { describe, it, expect } from 'vitest'
import { classifyExtractQuality, analyzePageTexts, pageTextNeedsOcr } from '../knowledge-extract'
import {
  resolveExtractEngine,
  type ExtractEngineCapabilities
} from '../extract-engine-capabilities'
import { heuristicSplitSubQueries } from '../knowledge-ask.service'
import { trimSourcesToBudget } from '../knowledge-chat.service'

describe('K1.5 extract engine resolve', () => {
  const caps: ExtractEngineCapabilities = {
    simple: { available: true },
    ocr: { available: false, reason: 'tesseract missing' },
    vision: { available: false, reason: 'no vision model' },
    recommended: 'simple'
  }

  it('降级 ocr → simple 并告知', () => {
    const r = resolveExtractEngine('ocr', caps)
    expect(r.engine).toBe('simple')
    expect(r.degraded).toBe(true)
    expect(r.message).toContain('tesseract')
  })

  it('vision 不可用且 ocr 可用时降到 ocr', () => {
    const r = resolveExtractEngine('vision', {
      ...caps,
      ocr: { available: true }
    })
    expect(r.engine).toBe('ocr')
    expect(r.degraded).toBe(true)
  })
})

describe('K1.5 multi-query heuristic', () => {
  it('最多拆 2 段', () => {
    expect(heuristicSplitSubQueries('对齐问题，以及可解释性争议', 2)).toEqual([
      '对齐问题',
      '以及可解释性争议'
    ])
    const parts = heuristicSplitSubQueries('对齐和可解释性', 2)
    expect(parts.length).toBe(2)
    expect(parts[0]).toContain('对齐')
    expect(parts[1]).toContain('可解释')
  })

  it('无连接词保持单查询', () => {
    expect(heuristicSplitSubQueries('什么是对齐？')).toEqual(['什么是对齐？'])
  })
})

describe('K1.5 chat budget trim', () => {
  it('超预算截断', () => {
    const { blocks, truncated } = trimSourcesToBudget(
      [
        { sourceId: 'a', title: 'A', text: 'x'.repeat(100) },
        { sourceId: 'b', title: 'B', text: 'y'.repeat(100) }
      ],
      80
    )
    expect(truncated).toBe(true)
    expect(blocks.length).toBeLessThanOrEqual(120)
  })
})

describe('extract quality still works', () => {
  it('三态', () => {
    expect(classifyExtractQuality(10, 10).quality).toBe('ok')
    expect(classifyExtractQuality(10, 5).quality).toBe('partial')
    expect(classifyExtractQuality(10, 0).quality).toBe('needs_ocr')
  })

  it('页边界', () => {
    const result = analyzePageTexts(['aaa', 'bbbb'])
    expect(result.pages.pages).toEqual([
      { page: 1, start: 0, end: 3 },
      { page: 2, start: 5, end: 9 }
    ])
  })

  it('损坏文本层按需要 OCR 处理', () => {
    const garbled =
      '和 1 AR 1 次 兴 SN=A I E 4 人 人 0 0 加 Ar 区，和 0 人 0 人 N S ee 1 1 由 0 | 人 0 0 人 RE 省 区 的'
    expect(pageTextNeedsOcr(garbled)).toBe(true)
    const result = analyzePageTexts([garbled])
    expect(result.textPageCount).toBe(0)
    expect(result.quality).toBe('needs_ocr')
  })
})
