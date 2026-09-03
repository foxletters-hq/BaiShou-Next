import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resolveWorkbenchSelectionAffordancePosition,
  workbenchSelectionAffordance
} from '../workbench-selection-affordance'

const editorRect = {
  top: 100,
  right: 700,
  bottom: 600,
  left: 100
}

describe('resolveWorkbenchSelectionAffordancePosition', () => {
  it('shows below a downward selection when space is available', () => {
    expect(
      resolveWorkbenchSelectionAffordancePosition({
        coords: { top: 220, right: 420, bottom: 240, left: 400 },
        editorRect,
        windowWidth: 1000,
        windowHeight: 800,
        pointsUp: false
      })
    ).toEqual({
      left: 400,
      top: 248,
      placement: 'below'
    })
  })

  it('shows above upward selections and selections near the bottom edge', () => {
    expect(
      resolveWorkbenchSelectionAffordancePosition({
        coords: { top: 560, right: 420, bottom: 580, left: 400 },
        editorRect,
        windowWidth: 1000,
        windowHeight: 800,
        pointsUp: true
      })
    ).toEqual({
      left: 400,
      top: 552,
      placement: 'above'
    })
  })

  it('clamps horizontally and hides endpoints outside the editor viewport', () => {
    expect(
      resolveWorkbenchSelectionAffordancePosition({
        coords: { top: 220, right: 690, bottom: 240, left: 680 },
        editorRect,
        windowWidth: 1000,
        windowHeight: 800,
        pointsUp: false
      })?.left
    ).toBe(462)

    expect(
      resolveWorkbenchSelectionAffordancePosition({
        coords: { top: 620, right: 420, bottom: 640, left: 400 },
        editorRect,
        windowWidth: 1000,
        windowHeight: 800,
        pointsUp: false
      })
    ).toBeNull()
  })
})

describe('workbenchSelectionAffordance', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('publishes a meaningful selection after the delay and hides for the context menu', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: 'alpha\nbeta',
        extensions: [workbenchSelectionAffordance(onChange)]
      })
    })
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({
      top: 220,
      right: 420,
      bottom: 240,
      left: 400
    } as DOMRect)
    vi.spyOn(view.scrollDOM, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      right: 700,
      bottom: 600,
      left: 100
    } as DOMRect)

    view.focus()
    view.dispatch({ selection: { anchor: 0, head: 5 } })
    vi.advanceTimersByTime(240)

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: '0:5',
        startLine: 1,
        endLine: 1,
        placement: 'below',
        endLeft: 420,
        endTop: 240
      })
    )

    view.dom.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(onChange).toHaveBeenLastCalledWith(null)
    view.destroy()
  })
})
