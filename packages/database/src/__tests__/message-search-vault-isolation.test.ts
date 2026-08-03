/**
 * P0-1：message_search 必须按 vault_id 隔离，B 仓消息不可被 A 仓搜到。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { deriveLegacyVaultId } from '@baishou/shared'
import { MessageRepository } from '../repositories/message.repository'
import { FTS_SYNC_TRIGGER_STATEMENTS } from '../schema/fts'

const VAULT_A = deriveLegacyVaultId('VaultA')
const VAULT_B = deriveLegacyVaultId('VaultB')

describe('message_search vault isolation (P0-1)', () => {
  let tempDir: string
  let client: Client
  let repo: MessageRepository

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'msg-search-vault-'))
    const dbPath = path.join(tempDir, 'agent.db')
    client = createClient({ url: `file:${dbPath}` })
    const db = drizzle(client)
    repo = new MessageRepository(db as any)

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
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS agent_parts (
        id TEXT PRIMARY KEY NOT NULL,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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

    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-a', '会话A', VAULT_A]
    })
    await client.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id, provider_id, model_id) VALUES (?, ?, ?, 'p', 'm')`,
      args: ['sess-b', '会话B', VAULT_B]
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index) VALUES (?, ?, 'user', 1)`,
      args: ['msg-a', 'sess-a']
    })
    await client.execute({
      sql: `INSERT INTO agent_messages (id, session_id, role, order_index) VALUES (?, ?, 'user', 1)`,
      args: ['msg-b', 'sess-b']
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data) VALUES (?, ?, ?, 'text', ?)`,
      args: [
        'part-a',
        'msg-a',
        'sess-a',
        JSON.stringify({ text: 'alpha secret keyword in vault A' })
      ]
    })
    await client.execute({
      sql: `INSERT INTO agent_parts (id, message_id, session_id, type, data) VALUES (?, ?, ?, 'text', ?)`,
      args: [
        'part-b',
        'msg-b',
        'sess-b',
        JSON.stringify({ text: 'beta secret keyword in vault B' })
      ]
    })
  })

  afterEach(async () => {
    client.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('searches only within the requested vault (B content invisible from A)', async () => {
    const inA = await repo.searchMessagesByKeyword('secret keyword', 10, VAULT_A)
    expect(inA.length).toBeGreaterThan(0)
    expect(inA.every((r) => String(r.content).includes('vault A'))).toBe(true)
    expect(inA.some((r) => String(r.content).includes('vault B'))).toBe(false)
    expect(inA.some((r) => r.sessionTitle === '会话B')).toBe(false)

    const inB = await repo.searchMessagesByKeyword('secret keyword', 10, VAULT_B)
    expect(inB.length).toBeGreaterThan(0)
    expect(inB.every((r) => String(r.content).includes('vault B'))).toBe(true)
    expect(inB.some((r) => String(r.content).includes('vault A'))).toBe(false)
  })

  it('fail-closed: missing vaultId returns empty (no cross-vault leak)', async () => {
    expect(await repo.searchMessagesByKeyword('secret keyword', 10)).toEqual([])
    expect(await repo.searchMessagesByKeyword('secret keyword', 10, '')).toEqual([])
    expect(await repo.searchMessagesByKeyword('secret keyword', 10, null)).toEqual([])
  })

  it('LIKE path alone still scopes by vault_id', async () => {
    const originalFts = (repo as any).searchMessagesViaFts.bind(repo)
    ;(repo as any).searchMessagesViaFts = async () => []
    try {
      const inA = await repo.searchMessagesByKeyword('secret keyword', 10, VAULT_A)
      expect(inA.some((r) => String(r.content).includes('vault B'))).toBe(false)
      expect(inA.some((r) => String(r.content).includes('vault A'))).toBe(true)
    } finally {
      ;(repo as any).searchMessagesViaFts = originalFts
    }
  })
})
