import { describe, expect, it, vi } from 'vitest'
import { runIncrementalSyncWithDivergenceConfirmation } from '../sync-divergence-run.util'
import { SyncDivergenceConfirmationRequiredError } from '../sync-divergence'

describe('runIncrementalSyncWithDivergenceConfirmation', () => {
  it('retries with confirmation flag after user confirms', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new SyncDivergenceConfirmationRequiredError(95, 30))
      .mockResolvedValueOnce({ ok: true })
    const confirm = vi.fn().mockResolvedValue(true)

    const result = await runIncrementalSyncWithDivergenceConfirmation(run, confirm)

    expect(result).toEqual({ ok: true })
    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[1]?.[0]).toEqual({ highDivergenceConfirmed: true })
    expect(confirm).toHaveBeenCalledWith(95, 30)
  })

  it('returns undefined when user cancels confirmation', async () => {
    const run = vi.fn().mockRejectedValue(new SyncDivergenceConfirmationRequiredError(95, 30))
    const confirm = vi.fn().mockResolvedValue(false)

    const result = await runIncrementalSyncWithDivergenceConfirmation(run, confirm)

    expect(result).toBeUndefined()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
