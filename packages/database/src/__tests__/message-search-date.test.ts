import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { deriveLegacyVaultId } from '@baishou/shared'
import {
  DATE_RANGE_LIST_MAX_LIMIT,
  DATE_RANGE_SNIPPET_MAX_CHARS,
  MessageRepository,
  resolveLocalCalendarDayRange
} from '../repositories/message.repository'
import { FTS_SYNC_TRIGGER_STATEMENTS } from '../schema/fts'

const VAULT_ID = deriveLegacyVaultId('DateSearchVault')

function toUnixSec(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

describe('resolveLocalCalendarDayRange', () => {
  it('covers the local calendar day inclusively', () => {
    const range = resolveLocalCalendarDayRange('2026-09-07', '2026-09-07')
    expect(range).not.toBeNull()
    expect(range!.start.getFullYear()).toBe(2026)
    expect(range!.start.getMonth()).toBe(8)
    expect(range!.start.getDate()).toBe(7)
    expect(range!.start.getHours()).toBe(0)
    expect(range!.end.getHours()).toBe(23)
    expect(range!.end.getDate()).toBe(7)
  })

  it('returns null when both dates are missing', () => {
    expect(resolveLocalCalendarDayRange()).toBeNull()
  })

  it('should return null when a calendar date does not exist', () => {
    expect(resolveLocalCalendarDayRange('2026-02-31', '2026-03-01')).toBeNull()
    expect(resolveLocalCalendarDayRange('2026-09-01', '2026-13-40')).toBeNull()
  })
})

describe('message_search date range (pre-compression text)', () => {
  let tempDir: string
  let client: Client
  let repo: MessageRepository

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'msg-search-date-'))
    const dbPath = path.join(tempDir, 'agent.db')
    client = createClient({ url: `file:${dbPath}` })
    const db = drizzle(client)
    repo = new MessageRepository(db as never)

    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '新对话',
        vault_id TEXT NOT NULL,
        assistant_id TEXT,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        system_prompt TEXT,
        provider_id TEXT NOT NULL DEFAULT 'x',
        model_id TEXT NOT NULL DEFAULT 'y',
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_micros INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        is_summary INTEGER NOT NULL DEFAULT 0,
        ask_id TEXT,
        provider_id TEXT,
        model_id TEXT,
        order_index INTEGER NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_input_tokens INTEGER,
        cache_write_input_tokens INTEGER,
        cost_micros INTEGER,
        created_at INTEGER NOT NULL
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_parts (
        id TEXT PRIMARY KEY NOT NULL,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL
      )
    `)
    await client.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(
        part_id UNINDEXED,
        message_id UNINDEXED,
        session_id UNINDEXED,
        content,
        tokenize='unicode61'
      )
    `)
    for (const stmt of FTS_SYNC_TRIGGER_STATEMENTS) {
      await client.execute(stmt)
    }

    const inRange = toUnixSec(new Date(2026, 8, 3, 10, 0, 0))
    const outOfRange = toUnixSec(new Date(2026, 7, 20, 10, 0, 0))

    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-date', '日期会话', VAULT_ID]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 1, ?)`,
      args: ['msg-in', 'sess-date', inRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 2, ?)`,
      args: ['msg-out', 'sess-date', outOfRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: [
        'part-in',
        'msg-in',
        'sess-date',
        JSON.stringify({ text: '区间内原文 keyword' }),
        inRange
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: [
        'part-out',
        'msg-out',
        'sess-date',
        JSON.stringify({ text: '区间外原文 keyword' }),
        outOfRange
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'compaction', ?, ?)`,
      args: [
        'part-compaction',
        'msg-in',
        'sess-date',
        JSON.stringify({
          status: 'completed',
          streamTranscript: '摘要里也有 keyword',
          coveredUpToMessageId: 'msg-in'
        }),
        inRange
      ]
    })
  })

  afterEach(async () => {
    client.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('only hits pre-compression text inside the local calendar range', async () => {
    const hits = await repo.searchMessagesByKeyword('keyword', 10, VAULT_ID, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    expect(hits).toHaveLength(1)
    expect(String(hits[0]?.content)).toContain('区间内原文')
    expect(hits.some((row) => String(row.content).includes('区间外原文'))).toBe(false)
    expect(hits.some((row) => String(row.content).includes('摘要里也有'))).toBe(false)
  })

  it('LIKE path alone still respects the date range', async () => {
    const originalFts = (repo as any).searchMessagesViaFts.bind(repo)
    ;(repo as any).searchMessagesViaFts = async () => []
    try {
      const hits = await repo.searchMessagesByKeyword('keyword', 10, VAULT_ID, {
        startDate: '2026-09-01',
        endDate: '2026-09-07'
      })
      expect(hits).toHaveLength(1)
      expect(String(hits[0]?.content)).toContain('区间内原文')
    } finally {
      ;(repo as any).searchMessagesViaFts = originalFts
    }
  })
})

describe('listSessionsInDateRange / listMessagesInDateRange', () => {
  let tempDir: string
  let client: Client
  let repo: MessageRepository

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'msg-date-list-'))
    const dbPath = path.join(tempDir, 'agent.db')
    client = createClient({ url: `file:${dbPath}` })
    const db = drizzle(client)
    repo = new MessageRepository(db as never)

    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '新对话',
        vault_id TEXT NOT NULL,
        assistant_id TEXT,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        system_prompt TEXT,
        provider_id TEXT NOT NULL DEFAULT 'x',
        model_id TEXT NOT NULL DEFAULT 'y',
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_micros INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        is_summary INTEGER NOT NULL DEFAULT 0,
        ask_id TEXT,
        provider_id TEXT,
        model_id TEXT,
        order_index INTEGER NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_input_tokens INTEGER,
        cache_write_input_tokens INTEGER,
        cost_micros INTEGER,
        created_at INTEGER NOT NULL
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_parts (
        id TEXT PRIMARY KEY NOT NULL,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL
      )
    `)

    const inRange = toUnixSec(new Date(2026, 8, 3, 10, 0, 0))
    const laterInRange = toUnixSec(new Date(2026, 8, 5, 16, 0, 0))
    const outOfRange = toUnixSec(new Date(2026, 7, 20, 10, 0, 0))
    const otherVault = deriveLegacyVaultId('OtherDateVault')

    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-date', '日期会话', VAULT_ID]
    })
    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-later', '稍后会话', VAULT_ID]
    })
    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-foreign', '外仓会话', otherVault]
    })
    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-compact-only', '仅摘要会话', VAULT_ID]
    })

    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 1, ?)`,
      args: ['msg-in', 'sess-date', inRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 2, ?)`,
      args: ['msg-out', 'sess-date', outOfRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'assistant', 1, ?)`,
      args: ['msg-later', 'sess-later', laterInRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 1, ?)`,
      args: ['msg-foreign', 'sess-foreign', inRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 1, ?)`,
      args: ['msg-compact-only', 'sess-compact-only', inRange]
    })

    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: ['part-in', 'msg-in', 'sess-date', JSON.stringify({ text: '区间内原文 keyword' }), inRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: [
        'part-out',
        'msg-out',
        'sess-date',
        JSON.stringify({ text: '区间外原文 keyword' }),
        outOfRange
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'compaction', ?, ?)`,
      args: [
        'part-compaction',
        'msg-in',
        'sess-date',
        JSON.stringify({ status: 'completed', streamTranscript: '摘要里也有 keyword' }),
        inRange
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: ['part-later', 'msg-later', 'sess-later', JSON.stringify({ text: '稍后正文' }), laterInRange]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: [
        'part-foreign',
        'msg-foreign',
        'sess-foreign',
        JSON.stringify({ text: '外仓原文 keyword' }),
        inRange
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'compaction', ?, ?)`,
      args: [
        'part-compact-only',
        'msg-compact-only',
        'sess-compact-only',
        JSON.stringify({ status: 'completed', streamTranscript: '只有摘要' }),
        inRange
      ]
    })
  })

  afterEach(async () => {
    client.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should list sessions with in-range user or assistant text when grouping by session', async () => {
    const rows = await repo.listSessionsInDateRange(VAULT_ID, '2026-09-01', '2026-09-07', 20)
    expect(rows.map((row) => row.sessionTitle)).toEqual(['稍后会话', '日期会话'])
    expect(rows[0]?.messageCount).toBe(1)
    expect(rows[0]?.preview).toContain('稍后正文')
    expect(rows[1]?.messageCount).toBe(1)
    expect(rows[1]?.preview).toContain('区间内原文')
    expect(rows.some((row) => row.sessionTitle === '仅摘要会话')).toBe(false)
    expect(rows.some((row) => row.sessionTitle === '外仓会话')).toBe(false)
  })

  it('should return empty sessions when the date range has no text messages', async () => {
    const rows = await repo.listSessionsInDateRange(VAULT_ID, '2026-01-01', '2026-01-02', 20)
    expect(rows).toEqual([])
  })

  it('should fail-closed when vaultId is missing for session listing', async () => {
    expect(await repo.listSessionsInDateRange('', '2026-09-01', '2026-09-07', 20)).toEqual([])
    expect(await repo.listSessionsInDateRange(null, '2026-09-01', '2026-09-07', 20)).toEqual([])
  })

  it('should list only pre-compression text messages inside the local calendar range', async () => {
    const rows = await repo.listMessagesInDateRange(VAULT_ID, 20, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => String(row.content))).toEqual(['稍后正文', '区间内原文 keyword'])
    expect(rows.some((row) => String(row.content).includes('区间外原文'))).toBe(false)
    expect(rows.some((row) => String(row.content).includes('摘要'))).toBe(false)
    expect(rows.some((row) => row.sessionTitle === '外仓会话')).toBe(false)
  })

  it('should fail-closed when vaultId is missing for message listing', async () => {
    expect(
      await repo.listMessagesInDateRange('', 20, { startDate: '2026-09-01', endDate: '2026-09-07' })
    ).toEqual([])
  })

  it('should return empty when the calendar date does not exist', async () => {
    expect(await repo.listSessionsInDateRange(VAULT_ID, '2026-02-31', '2026-03-01', 20)).toEqual([])
    expect(
      await repo.listMessagesInDateRange(VAULT_ID, 20, {
        startDate: '2026-02-31',
        endDate: '2026-03-01'
      })
    ).toEqual([])
  })

  it('should keep sessionId on listed sessions and filter messages by it', async () => {
    const sessions = await repo.listSessionsInDateRange(VAULT_ID, '2026-09-01', '2026-09-07', 20)
    const dateSession = sessions.find((row) => row.sessionTitle === '日期会话')
    expect(dateSession?.sessionId).toBe('sess-date')

    const messages = await repo.listMessagesInDateRange(VAULT_ID, 20, {
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      sessionId: 'sess-date'
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.sessionId).toBe('sess-date')
    expect(String(messages[0]?.content)).toContain('区间内原文')
  })

  it('should truncate listed message text to a snippet', async () => {
    const longText = '长'.repeat(DATE_RANGE_SNIPPET_MAX_CHARS + 40)
    const at = toUnixSec(new Date(2026, 8, 4, 12, 0, 0))
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 3, ?)`,
      args: ['msg-long', 'sess-date', at]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
      args: ['part-long', 'msg-long', 'sess-date', JSON.stringify({ text: longText }), at]
    })

    const rows = await repo.listMessagesInDateRange(VAULT_ID, 20, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    const longRow = rows.find((row) => row.sessionTitle === '日期会话' && String(row.content).startsWith('长'))
    expect(longRow?.content.length).toBe(DATE_RANGE_SNIPPET_MAX_CHARS + 3)
    expect(longRow?.content.endsWith('...')).toBe(true)
  })

  it('should return one extra row above the display max so callers can detect truncation', async () => {
    const at = toUnixSec(new Date(2026, 8, 6, 9, 0, 0))
    for (let i = 0; i < DATE_RANGE_LIST_MAX_LIMIT; i++) {
      const sessionId = `sess-extra-${i}`
      const messageId = `msg-extra-${i}`
      await client.execute({
        sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
        args: [sessionId, `额外会话${i}`, VAULT_ID]
      })
      await client.execute({
        sql: `INSERT INTO agent_messages (id, session_id, role, order_index, created_at) VALUES (?, ?, 'user', 1, ?)`,
        args: [messageId, sessionId, at]
      })
      await client.execute({
        sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at) VALUES (?, ?, ?, 'text', ?, ?)`,
        args: [
          `part-extra-${i}`,
          messageId,
          sessionId,
          JSON.stringify({ text: `额外正文${i}` }),
          at
        ]
      })
    }

    const sessions = await repo.listSessionsInDateRange(
      VAULT_ID,
      '2026-09-01',
      '2026-09-07',
      DATE_RANGE_LIST_MAX_LIMIT + 1
    )
    expect(sessions.length).toBe(DATE_RANGE_LIST_MAX_LIMIT + 1)

    const messages = await repo.listMessagesInDateRange(VAULT_ID, DATE_RANGE_LIST_MAX_LIMIT + 1, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    expect(messages.length).toBe(DATE_RANGE_LIST_MAX_LIMIT + 1)
  })
})
