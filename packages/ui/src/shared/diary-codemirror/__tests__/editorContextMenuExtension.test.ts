import { describe, it, expect, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { editorContextMenuExtension } from '../extensions/editorContextMenuExtension'

describe('editorContextMenuExtension', () => {
  it('should call onOpen when contextmenu on editor text', () => {
    const onOpen = vi.fn()
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      state: EditorState.create({
        doc: 'hello',
        extensions: [editorContextMenuExtension({ onOpen })]
      }),
      parent
    })

    try {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 12,
        clientY: 34
      })
      view.contentDOM.dispatchEvent(event)

      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onOpen.mock.calls[0]?.[0]).toMatchObject({
        x: 12,
        y: 34,
        context: {
          hasSelection: false,
          readOnly: false
        }
      })
    } finally {
      view.destroy()
    }
  })

  it('should not call onOpen when contextmenu on table block', () => {
    const onOpen = vi.fn()
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      state: EditorState.create({
        doc: 'hello',
        extensions: [editorContextMenuExtension({ onOpen })]
      }),
      parent
    })

    try {
      const table = document.createElement('div')
      table.className = 'cm-table-block'
      view.contentDOM.appendChild(table)

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 1,
        clientY: 1
      })
      table.dispatchEvent(event)

      expect(onOpen).not.toHaveBeenCalled()
    } finally {
      view.destroy()
    }
  })
})
