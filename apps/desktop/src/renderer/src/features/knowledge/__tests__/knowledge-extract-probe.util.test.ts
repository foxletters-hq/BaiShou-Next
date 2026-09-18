import { describe, expect, it } from 'vitest'
import { formatExtractProbePagesList, listExtractProbeSources } from '../knowledge-extract-probe.util'

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
