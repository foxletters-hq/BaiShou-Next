import { describe, it, expect } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { executeRawSql } from '@baishou/database'
import { deriveLegacyVaultId } from '@baishou/shared'
import { buildLegacySessionAggregate } from '../legacy-version-migration.importer.chats.build'
import {
  replaceTargetSessionRows,
  resolveTargetVaultId,
  streamLegacySessionFromSource
} from '../legacy-version-migration.importer.chats.persist'
import type { LegacyVersionMigrationImporterDeps } from '../legacy-version-migration.importer.types'

function createModernSessionTableSql(): string {
  return `
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_id TEXT NOT NULL,
      assistant_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      system_prompt TEXT,
      mounted_notebook_ids TEXT NOT NULL DEFAULT '',
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_micros INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_messages (
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
    );
    CREATE TABLE agent_parts (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT,
      created_at INTEGER NOT NULL
    );
  `
}

function createLegacySessionTableSql(): string {
  return `
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_name TEXT,
      assistant_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      system_prompt TEXT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_micros INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      is_summary INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_micros INTEGER,
      provider_id TEXT,
      model_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE agent_parts (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT,
      created_at INTEGER NOT NULL
    );
  `
}

function createDualColumnSessionTableSql(): string {
  return `
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_id TEXT NOT NULL,
      vault_name TEXT,
      assistant_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      system_prompt TEXT,
      mounted_notebook_ids TEXT NOT NULL DEFAULT '',
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_cost_micros INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE agent_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      is_summary INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost_micros INTEGER,
      provider_id TEXT,
      model_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE agent_parts (
      id TEXT PRIMARY KEY NOT NULL,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT,
      created_at INTEGER NOT NULL
    );
  `
}

function createMockFs() {
  const files = new Map<string, string>()
  return {
    files,
    mkdir: async () => {},
    writeFile: async (p: string, content: string) => {
      files.set(p, content)
    },
    appendFile: async (p: string, content: string) => {
      files.set(p, (files.get(p) ?? '') + content)
    },
    exists: async (p: string) => files.has(p),
    unlink: async (p: string) => {
      files.delete(p)
    },
    rename: async (oldP: string, newP: string) => {
      const val = files.get(oldP) ?? ''
      files.delete(oldP)
      files.set(newP, val)
    }
  }
}

describe('legacy-version-migration chats persist & schema compatibility', () => {
  it('resolveTargetVaultId resolves registry id when available or derives legacy id', () => {
    const depsWithRegistry = {
      vaultService: {
        getAllVaults: () => [
          { id: 'vlt_real_123', name: 'Work' },
          { id: 'vlt_real_456', name: 'Personal' }
        ]
      }
    } as unknown as LegacyVersionMigrationImporterDeps

    expect(resolveTargetVaultId(depsWithRegistry, 'Work')).toBe('vlt_real_123')
    expect(resolveTargetVaultId(depsWithRegistry, 'Personal')).toBe('vlt_real_456')
    expect(resolveTargetVaultId(depsWithRegistry, 'Unknown')).toBe(deriveLegacyVaultId('Unknown'))

    const depsWithoutRegistry = {
      vaultService: {
        getAllVaults: () => []
      }
    } as unknown as LegacyVersionMigrationImporterDeps

    expect(resolveTargetVaultId(depsWithoutRegistry, 'Personal')).toBe(
      deriveLegacyVaultId('Personal')
    )
  })

  it('buildLegacySessionAggregate includes both vaultName and resolved vaultId', () => {
    const session = buildLegacySessionAggregate(
      { id: 's1', title: 'Hello', is_pinned: 1 },
      's1_new',
      'ast_1',
      'Personal'
    )
    expect(session.id).toBe('s1_new')
    expect(session.vaultName).toBe('Personal')
    expect(session.vaultId).toBe(deriveLegacyVaultId('Personal'))

    const sessionWithExplicitId = buildLegacySessionAggregate(
      { id: 's2', title: 'Work Chat' },
      's2_new',
      'ast_2',
      'Work',
      'vlt_explicit_999'
    )
    expect(sessionWithExplicitId.vaultName).toBe('Work')
    expect(sessionWithExplicitId.vaultId).toBe('vlt_explicit_999')
  })

  it('replaceTargetSessionRows works with modern schema (vault_id only, no vault_name)', async () => {
    const db: Client = createClient({ url: ':memory:' })
    await db.executeMultiple(createModernSessionTableSql())

    const deps = {
      sqliteClient: db,
      executeRawSql
    } as unknown as LegacyVersionMigrationImporterDeps

    const session = buildLegacySessionAggregate(
      {
        id: 'sess_1',
        title: 'Modern Session',
        provider_id: 'openai',
        model_id: 'gpt-4o'
      },
      'sess_1',
      'ast_default',
      'Personal'
    )

    await replaceTargetSessionRows(deps, session)

    const res = await db.execute('SELECT * FROM agent_sessions WHERE id = ?', ['sess_1'])
    expect(res.rows.length).toBe(1)
    const row = res.rows[0] as Record<string, unknown>
    expect(row.id).toBe('sess_1')
    expect(row.title).toBe('Modern Session')
    expect(row.vault_id).toBe(deriveLegacyVaultId('Personal'))
    expect(row.mounted_notebook_ids).toBe('')
    expect(row.vault_name).toBeUndefined()
  })

  it('replaceTargetSessionRows works with legacy schema (vault_name only, no vault_id)', async () => {
    const db: Client = createClient({ url: ':memory:' })
    await db.executeMultiple(createLegacySessionTableSql())

    const deps = {
      sqliteClient: db,
      executeRawSql
    } as unknown as LegacyVersionMigrationImporterDeps

    const session = buildLegacySessionAggregate(
      {
        id: 'sess_legacy',
        title: 'Legacy Session',
        provider_id: 'anthropic',
        model_id: 'claude-3-5'
      },
      'sess_legacy',
      'ast_1',
      'Personal'
    )

    await replaceTargetSessionRows(deps, session)

    const res = await db.execute('SELECT * FROM agent_sessions WHERE id = ?', ['sess_legacy'])
    expect(res.rows.length).toBe(1)
    const row = res.rows[0] as Record<string, unknown>
    expect(row.id).toBe('sess_legacy')
    expect(row.vault_name).toBe('Personal')
    expect(row.vault_id).toBeUndefined()
  })

  it('replaceTargetSessionRows works with transitional schema (both vault_id and vault_name)', async () => {
    const db: Client = createClient({ url: ':memory:' })
    await db.executeMultiple(createDualColumnSessionTableSql())

    const deps = {
      sqliteClient: db,
      executeRawSql
    } as unknown as LegacyVersionMigrationImporterDeps

    const session = buildLegacySessionAggregate(
      {
        id: 'sess_dual',
        title: 'Dual Session',
        provider_id: 'deepseek',
        model_id: 'deepseek-chat'
      },
      'sess_dual',
      'ast_1',
      'Work',
      'vlt_work_001'
    )

    await replaceTargetSessionRows(deps, session)

    const res = await db.execute('SELECT * FROM agent_sessions WHERE id = ?', ['sess_dual'])
    expect(res.rows.length).toBe(1)
    const row = res.rows[0] as Record<string, unknown>
    expect(row.id).toBe('sess_dual')
    expect(row.vault_id).toBe('vlt_work_001')
    expect(row.vault_name).toBe('Work')
  })

  it('streamLegacySessionFromSource successfully streams session into modern SQLite and disk JSON', async () => {
    const targetDb: Client = createClient({ url: ':memory:' })
    await targetDb.executeMultiple(createModernSessionTableSql())

    const sourceDb: Client = createClient({ url: ':memory:' })
    await sourceDb.executeMultiple(createLegacySessionTableSql())

    // 插入旧会话、消息与 parts
    await sourceDb.executeMultiple(`
      INSERT INTO agent_sessions (id, title, vault_name, assistant_id, provider_id, model_id, total_input_tokens, total_output_tokens, total_cost_micros, created_at, updated_at)
      VALUES ('old_s1', 'Streaming Chat', 'Personal', 'ast_old', 'p1', 'm1', 100, 200, 50, 1000, 2000);
      INSERT INTO agent_messages (id, session_id, role, order_index, created_at)
      VALUES ('msg_1', 'old_s1', 'user', 0, 1000);
      INSERT INTO agent_parts (id, message_id, session_id, type, data, created_at)
      VALUES ('part_1', 'msg_1', 'old_s1', 'text', 'Hello World', 1000);
    `)

    const mockFs = createMockFs()

    const deps = {
      fileSystem: mockFs,
      sqliteClient: targetDb,
      executeRawSql: async (_client: any, sql: string, args: any[] = []) => {
        // mock attach: query from sourceDb if querying alias 'legacy_src'
        if (sql.includes('legacy_src.')) {
          return await executeRawSql(sourceDb, sql.replace(/legacy_src\./g, ''), args)
        }
        return await executeRawSql(targetDb, sql, args)
      },
      resolveTargetVaultName: async (name: string) => name,
      vaultService: {
        getAllVaults: () => [{ id: 'vlt_pers_test', name: 'Personal' }]
      },
      getSessionsBaseDirectory: async (vName: string) => `/storage/${vName}/Sessions`
    } as unknown as LegacyVersionMigrationImporterDeps

    await streamLegacySessionFromSource({
      deps,
      alias: 'legacy_src',
      oldSessionId: 'old_s1',
      newSessionId: 'new_s1',
      sessionRow: {
        id: 'old_s1',
        title: 'Streaming Chat',
        assistant_id: 'ast_old',
        provider_id: 'p1',
        model_id: 'm1'
      },
      mappedAssistantId: 'ast_mapped',
      legacyVaultName: 'Personal'
    })

    // 验证目标 SQLite 表已正确落库
    const sessionRes = await targetDb.execute('SELECT * FROM agent_sessions WHERE id = ?', [
      'new_s1'
    ])
    expect(sessionRes.rows.length).toBe(1)
    const sessionRow = sessionRes.rows[0] as Record<string, unknown>
    expect(sessionRow.vault_id).toBe('vlt_pers_test')
    expect(sessionRow.assistant_id).toBe('ast_mapped')

    const messageRes = await targetDb.execute('SELECT * FROM agent_messages WHERE session_id = ?', [
      'new_s1'
    ])
    expect(messageRes.rows.length).toBe(1)

    const partRes = await targetDb.execute('SELECT * FROM agent_parts WHERE session_id = ?', [
      'new_s1'
    ])
    expect(partRes.rows.length).toBe(1)
    expect((partRes.rows[0] as Record<string, unknown>).data).toBe('{"text":"Hello World"}')

    // 验证磁盘 JSON 文件已生成且内容包含规范 vaultId
    const jsonPath = '/storage/Personal/Sessions/new_s1.json'
    expect(mockFs.files.has(jsonPath)).toBe(true)
    const fileContent = JSON.parse(mockFs.files.get(jsonPath)!)
    expect(fileContent.session.id).toBe('new_s1')
    expect(fileContent.session.vaultId).toBe('vlt_pers_test')
    expect(fileContent.session.vaultName).toBe('Personal')
    expect(fileContent.messages.length).toBe(1)
    expect(fileContent.messages[0].parts[0].data).toEqual({ text: 'Hello World' })
  })
})
