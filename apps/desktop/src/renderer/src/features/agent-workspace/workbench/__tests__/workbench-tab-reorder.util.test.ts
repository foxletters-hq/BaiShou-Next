import { describe, expect, it } from 'vitest'
import { shouldEnableWorkbenchTabReorder } from '../workbench-tab-reorder.util'

describe('shouldEnableWorkbenchTabReorder', () => {
  it('should disable tab drag when the tab strip is empty or has one tab', () => {
    expect(shouldEnableWorkbenchTabReorder(0)).toBe(false)
    expect(shouldEnableWorkbenchTabReorder(1)).toBe(false)
  })

  it('should enable tab drag when two or more tabs are open', () => {
    expect(shouldEnableWorkbenchTabReorder(2)).toBe(true)
    expect(shouldEnableWorkbenchTabReorder(5)).toBe(true)
  })
})
