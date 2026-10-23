import { describe, expect, it } from 'vitest'
import {
  formatExtractProbePagesList,
  formatExtractProbeSampleText,
  isKnowledgePdfSource,
  listExtractProbeSources,
  pickExtractProbePages
} from '../extract-probe-pages.util'

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

describe('listExtractProbeSources', () => {
  it('should keep only imported pdf files', () => {
    expect(
      listExtractProbeSources([
        {
          id: 'pdf',
          title: '扫描件',
          sourceKind: 'file',
          relativePath: 'nb/sources/a.pdf',
          pageCount: 8
        },
        {
          id: 'note',
          title: '笔记.pdf',
          sourceKind: 'note',
          relativePath: 'nb/sources/b.md'
        },
        {
          id: 'txt',
          title: '说明.txt',
          sourceKind: 'file',
          relativePath: 'nb/sources/c.txt'
        }
      ]).map((row) => row.id)
    ).toEqual(['pdf'])
  })
})

describe('formatExtractProbePagesList', () => {
  it('should format sampled pages when the page count is known', () => {
    expect(formatExtractProbePagesList(10)).toBe('1、5、10')
  })

  it('should return an empty string when the page count is unknown', () => {
    expect(formatExtractProbePagesList(null)).toBe('')
  })
})

describe('formatExtractProbeSampleText', () => {
  it('should label each sampled page before the extracted text', () => {
    expect(
      formatExtractProbeSampleText([
        { page: 1, text: '封面' },
        { page: 5, text: '目录' }
      ])
    ).toBe('第 1 页\n封面\n\n第 5 页\n目录')
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
