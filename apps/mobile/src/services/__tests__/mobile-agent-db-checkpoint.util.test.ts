import { describe, expect, it, vi } from 'vitest'
import {
  AGENT_DB_EXPORT_CHECKPOINT_SQL,
  checkpointAgentDatabaseForExport
} from '../mobile-agent-db-checkpoint.util'

describe('checkpointAgentDatabaseForExport', () => {
  it('succeeds on first TRUNCATE', async () => {
    const execSql = vi.fn(async () => undefined)
    await checkpointAgentDatabaseForExport(execSql)
    expect(execSql).toHaveBeenCalledWith(AGENT_DB_EXPORT_CHECKPOINT_SQL[0])
    expect(execSql).toHaveBeenCalledTimes(1)
  })

  it('falls back to PASSIVE when TRUNCATE fails', async () => {
    const execSql = vi
      .fn()
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce(undefined)

    await checkpointAgentDatabaseForExport(execSql, { retries: 0 })

    expect(execSql).toHaveBeenNthCalledWith(1, AGENT_DB_EXPORT_CHECKPOINT_SQL[0])
    expect(execSql).toHaveBeenNthCalledWith(2, AGENT_DB_EXPORT_CHECKPOINT_SQL[1])
  })

  it('retries checkpoint sequence before giving up', async () => {
    const execSql = vi.fn(async () => {
      throw new Error('busy')
    })

    await expect(
      checkpointAgentDatabaseForExport(execSql, { retries: 1, retryDelayMs: 1 })
    ).rejects.toThrow('busy')
    expect(execSql).toHaveBeenCalledTimes(4)
  })
})
