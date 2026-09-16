import { describe, expect, it } from 'vitest'
import {
  resolveKnowledgeGraphWindow,
  splitKnowledgeGraphWindows
} from '../knowledge-graph-windows.util'

describe('splitKnowledgeGraphWindows', () => {
  it('按页边界合并，超出上限记 truncated', () => {
    const text = 'abcdefghij'.repeat(20)
    const pages = Array.from({ length: 25 }, (_, i) => ({
      page: i + 1,
      start: i * 8,
      end: (i + 1) * 8
    }))
    const { windows, truncated } = splitKnowledgeGraphWindows(text, 'src1', pages, {
      windowChars: 20,
      maxWindows: 3
    })
    expect(windows.length).toBe(3)
    expect(truncated).toBe(true)
    expect(windows[0]?.sourceRef).toBe('src1#0')
  })

  it('无页信息时按字数切窗', () => {
    const text = 'x'.repeat(12_000)
    const { windows, truncated } = splitKnowledgeGraphWindows(text, 'src2', null, {
      windowChars: 5000,
      maxWindows: 20
    })
    expect(windows.length).toBe(3)
    expect(truncated).toBe(false)
    expect(windows[2]?.sourceRef).toBe('src2#2')
  })

  it('should return the nth window when resolving by index', () => {
    const text = 'x'.repeat(12_000)
    const window = resolveKnowledgeGraphWindow({
      text,
      sourceId: 'src2',
      windowIndex: 2
    })
    expect(window?.sourceRef).toBe('src2#2')
    expect(window?.text).toBe('x'.repeat(2000))
  })

  it('should return null when window index is out of range', () => {
    expect(
      resolveKnowledgeGraphWindow({
        text: 'short',
        sourceId: 'src1',
        windowIndex: 3
      })
    ).toBeNull()
  })
})
