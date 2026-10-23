import { describe, expect, it } from 'vitest'
import {
  buildNotebookOpenGuideRows,
  resolveNotebookStatusPicker
} from '../notebook-open-guide.util'

describe('buildNotebookOpenGuideRows', () => {
  it('marks missing embedding and graph extract models', () => {
    const rows = buildNotebookOpenGuideRows({
      sourceCount: 2
    })
    expect(rows.find((row) => row.key === 'embedding')).toMatchObject({
      value: '未配置',
      warn: true
    })
    expect(rows.find((row) => row.key === 'graphExtract')).toMatchObject({
      value: '未配置',
      warn: true
    })
    expect(rows.find((row) => row.key === 'dialogue')).toBeUndefined()
  })

  it('shows the graph extract model and does not add a dialogue row', () => {
    const rows = buildNotebookOpenGuideRows({
      embeddingModelId: 'emb-1',
      graphModelId: 'graph-chat',
      extractEngine: 'ocr',
      sourceCount: 3
    })
    expect(rows.find((row) => row.key === 'graphExtract')).toMatchObject({
      label: '图抽取模型',
      value: 'graph-chat'
    })
    expect(rows.find((row) => row.key === 'dialogue')).toBeUndefined()
    expect(rows.find((row) => row.key === 'engine')?.value).toBe('OCR')
    expect(rows.find((row) => row.key === 'graph')).toBeUndefined()
    expect(rows.find((row) => row.key === 'sources')?.value).toBe('3 个')
  })

  it('attaches provider icons when given', () => {
    const rows = buildNotebookOpenGuideRows({
      embeddingModelId: 'emb-1',
      sourceCount: 0,
      icons: { embedding: 'icon://emb', graphExtract: 'icon://graph' }
    })
    expect(rows.find((row) => row.key === 'embedding')?.iconSrc).toBe('icon://emb')
    expect(rows.find((row) => row.key === 'graphExtract')?.iconSrc).toBe('icon://graph')
  })
})

describe('resolveNotebookStatusPicker', () => {
  it('should open settings for engine and a model picker for extract models', () => {
    const anchor = { x: 0, y: 0 } as DOMRect
    expect(resolveNotebookStatusPicker('engine', anchor)).toEqual({ action: 'settings' })
    expect(resolveNotebookStatusPicker('graphExtract', anchor)).toMatchObject({
      action: 'picker',
      kind: 'chat',
      field: 'graph'
    })
  })
})
