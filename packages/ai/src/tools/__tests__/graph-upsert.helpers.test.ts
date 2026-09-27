import { describe, expect, it } from 'vitest'
import {
  collapseGraphDisplayName,
  formatGraphUpsertCounts,
  graphUpsertSourceRefError
} from '../graph-upsert.helpers'

describe('graph upsert helpers', () => {
  it('should accept a real calendar date and a memory id', () => {
    expect(graphUpsertSourceRefError('1999-01-01')).toBeNull()
    expect(graphUpsertSourceRefError('mem_abc')).toBeNull()
    expect(graphUpsertSourceRefError('Journals/2026/06/2026-06-20.md')).toBeNull()
  })

  it('should reject a fake date or a non-date source_ref', () => {
    expect(graphUpsertSourceRefError('1999-02-31')).toContain('1999-02-31')
    expect(graphUpsertSourceRefError('not-a-date')).toContain('not-a-date')
  })

  it('should collapse newlines in a display name', () => {
    expect(collapseGraphDisplayName('测试节点\n带换行')).toBe('测试节点 带换行')
  })

  it('should print created and updated node counts with skip reasons', () => {
    const text = formatGraphUpsertCounts({
      nodesCreated: 0,
      nodesUpdated: 1,
      edgesWritten: 0,
      edgesUpdated: 0,
      edgesDeleted: 0,
      skips: [{ reason: 'missing_node', from: '测试人物A', to: '不存在的ABC' }]
    })
    expect(text).toContain('新建节点 0')
    expect(text).toContain('更新节点 1')
    expect(text).toContain('from=测试人物A to=不存在的ABC reason=missing_node')
  })
})
