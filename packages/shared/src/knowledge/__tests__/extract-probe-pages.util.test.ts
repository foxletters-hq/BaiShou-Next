import { describe, expect, it } from 'vitest'
import { isKnowledgePdfSource, pickExtractProbePages } from '../extract-probe-pages.util'

describe('pickExtractProbePages', () => {
  it('should return no pages when the count is missing or not positive', () => {
    expect(pickExtractProbePages(0)).toEqual([])
    expect(pickExtractProbePages(-2)).toEqual([])
    expect(pickExtractProbePages(Number.NaN)).toEqual([])
  })

  it('should return the only page when the file has one page', () => {
    expect(pickExtractProbePages(1)).toEqual([1])
  })

  it('should return both pages when the file has two pages', () => {
    expect(pickExtractProbePages(2)).toEqual([1, 2])
  })

  it('should return first, middle and last pages when the file has more than two pages', () => {
    expect(pickExtractProbePages(3)).toEqual([1, 2, 3])
    expect(pickExtractProbePages(4)).toEqual([1, 2, 4])
    expect(pickExtractProbePages(5)).toEqual([1, 3, 5])
    expect(pickExtractProbePages(10)).toEqual([1, 5, 10])
  })
})

describe('isKnowledgePdfSource', () => {
  it('should accept a file whose relative path ends with pdf', () => {
    expect(
      isKnowledgePdfSource({
        sourceKind: 'file',
        relativePath: 'nb/sources/src_scan.pdf',
        title: '扫描件'
      })
    ).toBe(true)
  })

  it('should reject notes, urls and non-pdf files', () => {
    expect(isKnowledgePdfSource({ sourceKind: 'note', title: '笔记.pdf' })).toBe(false)
    expect(isKnowledgePdfSource({ sourceKind: 'url', title: 'https://a.pdf' })).toBe(false)
    expect(
      isKnowledgePdfSource({
        sourceKind: 'file',
        relativePath: 'nb/sources/src_note.txt',
        title: '说明.txt'
      })
    ).toBe(false)
  })
})
