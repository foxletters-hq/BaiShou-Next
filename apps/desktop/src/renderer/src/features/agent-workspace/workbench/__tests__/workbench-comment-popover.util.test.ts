import { describe, expect, it } from 'vitest'
import {
  commentPopoverAnchorFromSelectionCoords,
  resolveWorkbenchCommentPopoverPosition
} from '../workbench-comment-popover.util'

describe('commentPopoverAnchorFromSelectionCoords', () => {
  it('anchors to the end of the selected text', () => {
    expect(
      commentPopoverAnchorFromSelectionCoords({
        left: 120,
        right: 240,
        top: 80,
        bottom: 96
      })
    ).toEqual({ x: 236, y: 112 })
  })

  it('returns an empty anchor when the editor has no coordinates', () => {
    expect(commentPopoverAnchorFromSelectionCoords(null)).toEqual({})
  })
})

describe('resolveWorkbenchCommentPopoverPosition', () => {
  it('keeps a valid selection-end position', () => {
    expect(
      resolveWorkbenchCommentPopoverPosition({
        x: 236,
        y: 112,
        windowWidth: 1280,
        windowHeight: 800
      })
    ).toEqual({ x: 236, y: 112 })
  })

  it('clamps to the viewport instead of sticking to the far left', () => {
    expect(
      resolveWorkbenchCommentPopoverPosition({
        x: -40,
        y: 900,
        windowWidth: 800,
        windowHeight: 600
      })
    ).toEqual({ x: 12, y: 408 })
  })
})
