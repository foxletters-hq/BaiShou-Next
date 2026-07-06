import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionAggregateSync } from '../session.repository.aggregate'

describe('SessionAggregateSync', () => {
  let batchMock: ReturnType<typeof vi.fn>
  let sync: SessionAggregateSync

  beforeEach(() => {
    batchMock = vi.fn().mockResolvedValue(undefined)
    sync = new SessionAggregateSync({
      $client: { batch: batchMock }
    } as never)
  })

  it('preserves per-message token usage when syncing JSON aggregate into SQLite', async () => {
    await sync.upsertAggregate({
      session: {
        id: 's1',
        vaultName: 'default',
        totalInputTokens: 47300,
        totalOutputTokens: 601,
        totalCacheReadInputTokens: 46100,
        totalCacheWriteInputTokens: 0,
        totalCostMicros: 1200,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000
      },
      messages: [
        {
          id: 'a1',
          sessionId: 's1',
          role: 'assistant',
          isSummary: false,
          orderIndex: 2,
          inputTokens: 47300,
          outputTokens: 601,
          cacheReadInputTokens: 46100,
          cacheWriteInputTokens: 0,
          costMicros: 1200,
          providerId: 'openai',
          modelId: 'gpt-4o',
          createdAt: 1_700_000_050_000,
          parts: []
        }
      ]
    })

    const messageInsert = batchMock.mock.calls[0]?.[0]?.find((stmt: { sql: string }) =>
      stmt.sql.includes('INSERT OR IGNORE INTO agent_messages')
    )
    expect(messageInsert).toBeDefined()
    expect(messageInsert.sql).toContain('input_tokens')
    expect(messageInsert.args).toEqual([
      'a1',
      's1',
      'assistant',
      0,
      2,
      47300,
      601,
      46100,
      0,
      1200,
      'openai',
      'gpt-4o',
      null,
      1_700_000_050
    ])
  })

  it('accepts snake_case token fields from legacy session JSON', async () => {
    await sync.upsertAggregate({
      session: {
        id: 's2',
        vault_name: 'default',
        total_input_tokens: 100,
        total_output_tokens: 20,
        total_cache_read_input_tokens: 0,
        total_cache_write_input_tokens: 0,
        total_cost_micros: 50,
        created_at: 1_700_000_000,
        updated_at: 1_700_000_100
      },
      messages: [
        {
          id: 'a2',
          session_id: 's2',
          role: 'assistant',
          is_summary: false,
          order_index: 1,
          input_tokens: 100,
          output_tokens: 20,
          cache_read_input_tokens: 0,
          cache_write_input_tokens: 0,
          cost_micros: 50,
          provider_id: 'deepseek',
          model_id: 'deepseek-chat',
          created_at: 1_700_000_050,
          parts: []
        }
      ]
    })

    const messageInsert = batchMock.mock.calls[0]?.[0]?.find((stmt: { sql: string }) =>
      stmt.sql.includes('INSERT OR IGNORE INTO agent_messages')
    )
    expect(messageInsert?.args?.[5]).toBe(100)
    expect(messageInsert?.args?.[6]).toBe(20)
    expect(messageInsert?.args?.[9]).toBe(50)
  })
})
