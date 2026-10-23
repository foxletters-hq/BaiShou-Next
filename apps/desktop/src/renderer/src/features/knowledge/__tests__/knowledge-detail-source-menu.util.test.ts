import { describe, expect, it, vi } from 'vitest'
import {
  knowledgeSourceMenuOcrRunning,
  mapKnowledgeDetailSourceMenuItems
} from '../knowledge-detail-source-menu.util'
import type { KnowledgeSourceRow } from '../knowledge-detail.types'

function source(partial: Partial<KnowledgeSourceRow>): KnowledgeSourceRow {
  return {
    id: 's1',
    title: 'a.pdf',
    sourceKind: 'file',
    status: 'ready',
    ...partial
  }
}

describe('knowledge-detail-source-menu.util', () => {
  it('should treat extracting or pending OCR engines as running', () => {
    expect(knowledgeSourceMenuOcrRunning(source({ status: 'extracting' }))).toBe(true)
    expect(knowledgeSourceMenuOcrRunning(source({ status: 'pending', extractEngine: 'ocr' }))).toBe(
      true
    )
    expect(knowledgeSourceMenuOcrRunning(source({ status: 'ready' }))).toBe(false)
    expect(knowledgeSourceMenuOcrRunning(source({ status: 'ready' }), { page: 1, total: 3 })).toBe(
      true
    )
  })

  it('should insert a divider before delete and nest reembed children', () => {
    const run = vi.fn()
    const items = mapKnowledgeDetailSourceMenuItems(
      ['preview', 'reembed', 'delete'],
      (action) => action,
      run
    )
    expect(items).toHaveLength(4)
    expect(items[0]).toMatchObject({ label: 'preview' })
    expect(items[1]?.children).toHaveLength(2)
    expect(items[2]).toMatchObject({ divider: true })
    expect(items[3]).toMatchObject({ label: 'delete' })
    items[1]?.children?.[0]?.onClick?.()
    expect(run).toHaveBeenCalledWith('reembed-vector')
  })
})
