import { describe, expect, it } from 'vitest'
import {
  canConfirmNotebookDataManage,
  notebookDataManageStatusKind,
  parseNotebookDataManageResult
} from '../notebook-data-manage.util'

describe('notebook-data-manage.util', () => {
  it('should require the clear phrase before confirming a clear action', () => {
    expect(
      canConfirmNotebookDataManage({
        action: 'clear',
        vector: true,
        graph: false,
        phrase: '确认清除',
        typed: '确认清除'
      })
    ).toBe(true)
    expect(
      canConfirmNotebookDataManage({
        action: 'clear',
        vector: true,
        graph: false,
        phrase: '确认清除',
        typed: '不对'
      })
    ).toBe(false)
  })

  it('should parse a queued reprocess result', () => {
    const result = parseNotebookDataManageResult({
      action: 'reprocess',
      vector: true,
      graph: true,
      sourceCount: 2,
      vectorQueued: 2,
      graphQueued: 1
    })
    expect(result).not.toBeNull()
    expect(notebookDataManageStatusKind(result!)).toBe('reprocess-queued')
  })
})
