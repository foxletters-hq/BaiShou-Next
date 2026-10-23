import { describe, expect, it } from 'vitest'
import {
  isNotebookHeavyConfirmReady,
  NOTEBOOK_HEAVY_CONFIRM_WAIT_MS,
  notebookHeavyConfirmSecondsLeft
} from '../notebook-heavy-confirm.util'

describe('notebookHeavyConfirmSecondsLeft', () => {
  it('should keep confirm locked when three seconds have not passed', () => {
    const startedAt = 1_000
    expect(isNotebookHeavyConfirmReady(startedAt, 1_000)).toBe(false)
    expect(notebookHeavyConfirmSecondsLeft(startedAt, 1_000)).toBe(3)
    expect(
      isNotebookHeavyConfirmReady(startedAt, startedAt + NOTEBOOK_HEAVY_CONFIRM_WAIT_MS - 1)
    ).toBe(false)
    expect(isNotebookHeavyConfirmReady(startedAt, startedAt + NOTEBOOK_HEAVY_CONFIRM_WAIT_MS)).toBe(
      true
    )
    expect(
      notebookHeavyConfirmSecondsLeft(startedAt, startedAt + NOTEBOOK_HEAVY_CONFIRM_WAIT_MS)
    ).toBe(0)
  })
})
