import { describe, expect, it } from 'vitest'
import { WORKBENCH_EXPLORER_DND_MIME } from '../workbench-file-explorer-dnd.util'
import { shouldAcceptWorkbenchAgentPanelDrag } from '../workbench-agent-panel-drop.util'

function mockTransfer(types: string[]): DataTransfer {
  return { types } as unknown as DataTransfer
}

describe('shouldAcceptWorkbenchAgentPanelDrag', () => {
  it('should accept explorer entries when the panel can take a drop', () => {
    expect(
      shouldAcceptWorkbenchAgentPanelDrag(mockTransfer([WORKBENCH_EXPLORER_DND_MIME]), true)
    ).toBe(true)
  })

  it('should reject explorer entries when history view hides the composer', () => {
    expect(
      shouldAcceptWorkbenchAgentPanelDrag(mockTransfer([WORKBENCH_EXPLORER_DND_MIME]), false)
    ).toBe(false)
  })

  it('should reject plain text without explorer or file types', () => {
    expect(shouldAcceptWorkbenchAgentPanelDrag(mockTransfer(['text/plain']), true)).toBe(false)
  })
})
