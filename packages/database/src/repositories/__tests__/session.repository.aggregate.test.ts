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

  it('upsert rebuilds compression_snapshots from portable snapshots[]', async () => {
    await sync.upsertAggregate({
      session: {
        id: 's3',
        vaultId: 'vlt_test',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000
      },
      messages: [],
      snapshots: [
        {
          coveredUpToMessageId: 'm2',
          tailStartMessageId: 'm3',
          summaryText: '摘要',
          messageCount: 2,
          tokenCount: 12,
          createdAt: 1_700_000_050_000
        }
      ]
    })
    const stmts = batchMock.mock.calls[0]?.[0] as Array<{ sql: string; args?: unknown[] }>
    expect(stmts.some((stmt) => stmt.sql.includes('DELETE FROM compression_snapshots'))).toBe(true)
    const insert = stmts.find((stmt) => stmt.sql.includes('INSERT INTO compression_snapshots'))
    expect(insert?.args).toEqual(['s3', '摘要', 'm2', 'm3', 2, 12, 1_700_000_050])
  })

  it('normalizes legacy default assistantId to latte when syncing session aggregate from disk', async () => {
    await sync.upsertAggregate({
      session: {
        id: 's-legacy-latte',
        vaultId: 'vlt_test',
        assistantId: 'default',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000
      },
      messages: []
    })
    const stmts = batchMock.mock.calls[0]?.[0] as Array<{ sql: string; args?: unknown[] }>
    const sessionInsert = stmts.find((stmt) => stmt.sql.includes('INSERT INTO agent_sessions'))
    expect(sessionInsert?.args?.[3]).toBe('latte')
  })

  it('keeps Personal45 sessions scoped to Personal45 instead of collapsing into Personal when vaultId is absent', async () => {
    const { deriveLegacyVaultId } = await import('@baishou/shared')
    await sync.upsertAggregate({
      session: {
        id: 's-personal45',
        vaultName: 'Personal45',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000
      },
      messages: []
    })
    const stmts = batchMock.mock.calls[0]?.[0] as Array<{ sql: string; args?: unknown[] }>
    const sessionInsert = stmts.find((stmt) => stmt.sql.includes('INSERT INTO agent_sessions'))
    expect(sessionInsert?.args?.[2]).toBe(deriveLegacyVaultId('Personal45'))
    expect(sessionInsert?.args?.[2]).not.toBe(deriveLegacyVaultId('Personal'))
  })

  it('batches agent_messages by 200 and agent_parts by 400 while preserving FK insert order', async () => {
    const messages = Array.from({ length: 450 }, (_, i) => ({
      id: `m-${i}`,
      sessionId: 's-big',
      role: i % 2 === 0 ? 'user' : 'assistant',
      isSummary: false,
      orderIndex: i,
      createdAt: 1_700_000_000_000 + i * 1000,
      parts: [
        {
          id: `p-${i}-a`,
          messageId: `m-${i}`,
          sessionId: 's-big',
          type: 'text',
          data: { text: `hello ${i}` },
          createdAt: 1_700_000_000_000 + i * 1000
        },
        {
          id: `p-${i}-b`,
          messageId: `m-${i}`,
          sessionId: 's-big',
          type: 'text',
          data: { text: `world ${i}` },
          createdAt: 1_700_000_000_000 + i * 1000
        }
      ]
    }))

    await sync.upsertAggregate({
      session: {
        id: 's-big',
        vaultId: 'vlt_test',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_500_000
      },
      messages
    })

    const stmts = batchMock.mock.calls[0]?.[0] as Array<{ sql: string; args?: unknown[] }>
    const msgStmts = stmts.filter((s) => s.sql.includes('INSERT OR IGNORE INTO agent_messages'))
    const partStmts = stmts.filter((s) => s.sql.includes('INSERT OR IGNORE INTO agent_parts'))

    // 450 条消息 -> 200 + 200 + 50 = 3 批
    expect(msgStmts).toHaveLength(3)
    expect(msgStmts[0]!.args).toHaveLength(200 * 14)
    expect(msgStmts[1]!.args).toHaveLength(200 * 14)
    expect(msgStmts[2]!.args).toHaveLength(50 * 14)

    // 900 条 parts -> 400 + 400 + 100 = 3 批
    expect(partStmts).toHaveLength(3)
    expect(partStmts[0]!.args).toHaveLength(400 * 6)
    expect(partStmts[1]!.args).toHaveLength(400 * 6)
    expect(partStmts[2]!.args).toHaveLength(100 * 6)

    // 所有消息插入必须先于任意 part 插入，保证外键有效
    const lastMsgIdx = stmts.lastIndexOf(msgStmts[msgStmts.length - 1]!)
    const firstPartIdx = stmts.indexOf(partStmts[0]!)
    expect(lastMsgIdx).toBeLessThan(firstPartIdx)
  })
})
