import { describe, expect, it } from 'vitest'
import { shouldQueueWorkbenchFileContext } from '../workbench-file-context-queue.util'

describe('shouldQueueWorkbenchFileContext', () => {
  it('delivers immediately when the agent panel and input are mounted', () => {
    expect(
      shouldQueueWorkbenchFileContext({
        agentPanelCollapsed: false,
        sessionsViewOpen: false,
        agentPanelMounted: true
      })
    ).toBe(false)
  })

  it('queues when the sessions list is open so the input can remount', () => {
    expect(
      shouldQueueWorkbenchFileContext({
        agentPanelCollapsed: false,
        sessionsViewOpen: true,
        agentPanelMounted: true
      })
    ).toBe(true)
  })

  it('queues when the agent panel is collapsed or unmounted', () => {
    expect(
      shouldQueueWorkbenchFileContext({
        agentPanelCollapsed: true,
        sessionsViewOpen: false,
        agentPanelMounted: false
      })
    ).toBe(true)
  })
})
