import { describe, expect, it } from 'vitest'
import { buildNotebookOpenGuideRows } from '../notebook-open-guide.util'

describe('buildNotebookOpenGuideRows', () => {
  it('marks missing embedding and dialogue models', () => {
    const rows = buildNotebookOpenGuideRows({
      sourceCount: 2,
      graphPending: 0
    })
    expect(rows.find((row) => row.key === 'embedding')).toMatchObject({
      value: '未配置',
      warn: true
    })
    expect(rows.find((row) => row.key === 'dialogue')).toMatchObject({
      value: '未配置',
      warn: true
    })
  })

  it('prefers the partner model over the global dialogue model', () => {
    const rows = buildNotebookOpenGuideRows({
      embeddingModelId: 'emb-1',
      dialogueModelId: 'global-chat',
      assistantName: '校对',
      assistantModelId: 'partner-chat',
      extractEngine: 'ocr',
      sourceCount: 3,
      graphPending: 2
    })
    expect(rows.find((row) => row.key === 'dialogue')?.value).toBe('partner-chat')
    expect(rows.find((row) => row.key === 'assistant')?.value).toBe('校对')
    expect(rows.find((row) => row.key === 'engine')?.value).toBe('OCR')
    expect(rows.find((row) => row.key === 'graph')?.value).toBe('进行中 2 项')
  })
})
