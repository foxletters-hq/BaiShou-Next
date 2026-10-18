import { describe, it, expect } from 'vitest'
import { classifyExtractQuality, analyzePageTexts, pageTextNeedsOcr } from '../knowledge-extract'
import {
  resolveExtractEngine,
  resolvePdfExtractEngine,
  type ExtractEngineCapabilities
} from '../extract-engine-capabilities'

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

  it('should keep PDF on vision when pdfVisionOnly even if OCR exists', () => {
    const r = resolvePdfExtractEngine({
      requested: 'simple',
      caps: {
        ...caps,
        ocr: { available: true }
      },
      pdfVisionOnly: true
    })
    expect(r.engine).toBe('vision')
    expect(r.degraded).toBe(true)
    expect(r.message).toContain('no vision model')
  })

  it('should use vision without degrading when pdfVisionOnly and vision is ready', () => {
    const r = resolvePdfExtractEngine({
      requested: 'ocr',
      caps: {
        ...caps,
        vision: { available: true },
        recommended: 'vision'
      },
      pdfVisionOnly: true
    })
    expect(r).toEqual({ engine: 'vision', degraded: false })
  })

  it('should keep desktop PDF degradation when pdfVisionOnly is off', () => {
    const r = resolvePdfExtractEngine({
      requested: 'vision',
      caps: {
        ...caps,
        ocr: { available: true }
      }
    })
    expect(r.engine).toBe('ocr')
    expect(r.degraded).toBe(true)
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
