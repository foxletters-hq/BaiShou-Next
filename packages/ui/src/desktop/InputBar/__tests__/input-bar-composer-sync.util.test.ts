import { describe, expect, it } from 'vitest'
import { appendPlainWithBreaks, toSendFileRefs } from '../input-bar-composer-sync.util'

describe('appendPlainWithBreaks', () => {
  it('should insert br nodes when the text contains line breaks', () => {
    const root = document.createElement('div')
    appendPlainWithBreaks(root, 'a\nb')
    expect(root.childNodes).toHaveLength(3)
    expect(root.childNodes[1]?.nodeName).toBe('BR')
    expect(root.textContent).toBe('ab')
  })
})

describe('toSendFileRefs', () => {
  it('should drop empty paths when converting composer chips', () => {
    expect(
      toSendFileRefs([
        { id: '1', relativePath: 'docs/a.md', origin: 'mention' },
        { id: '2', relativePath: '', origin: 'mention' }
      ])
    ).toEqual([
      {
        relativePath: 'docs/a.md',
        selection: undefined,
        comment: undefined,
        origin: 'mention'
      }
    ])
  })

  it('should keep directory flag when the chip marks a folder', () => {
    expect(
      toSendFileRefs([{ id: '1', relativePath: 'src', origin: 'mention', isDirectory: true }])
    ).toEqual([{ relativePath: 'src', origin: 'mention', isDirectory: true }])
  })
})
