import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { exportLegacyRuntimeArtifacts } from '../legacy-runtime-artifacts.shared'

async function executeRawSql(
  client: Database.Database,
  statement: string,
  args: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const stmt = client.prepare(statement)
  const rows = (args.length > 0 ? stmt.all(...args) : stmt.all()) as Record<string, unknown>[]
  return { rows }
}

function createAgentSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE agent_assistants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE agent_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      vault_name TEXT,
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE agent_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT,
      order_index INTEGER,
      created_at TEXT
    );
    CREATE TABLE agent_parts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT,
      data TEXT,
      created_at TEXT
    );
  `)
}

describe('exportLegacyRuntimeArtifacts', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()
  let db: Database.Database

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-artifacts-'))
    db = new Database(':memory:')
    createAgentSchema(db)
    db.prepare(
      `INSERT INTO agent_assistants (id, name, is_default, created_at, updated_at)
       VALUES ('ast-1', 'Legacy Bot', 1, '2024-01-01', '2024-01-02')`
    ).run()
    db.prepare(
      `INSERT INTO agent_sessions (id, title, vault_name, created_at, updated_at)
       VALUES ('sess-1', 'Hello', 'Personal', '2024-01-03', '2024-01-04')`
    ).run()
    db.prepare(
      `INSERT INTO agent_messages (id, session_id, role, order_index, created_at)
       VALUES ('msg-1', 'sess-1', 'user', 0, '2024-01-03')`
    ).run()
    db.prepare(
      `INSERT INTO agent_parts (id, session_id, message_id, type, data, created_at)
       VALUES ('part-1', 'sess-1', 'msg-1', 'text', '{"text":"hi"}', '2024-01-03')`
    ).run()
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('exports assistants and sessions JSON under target vault directories', async () => {
    await exportLegacyRuntimeArtifacts({
      fileSystem,
      targetWorkspaceDir: tempDir,
      vaultNames: ['Personal'],
      sqliteClient: db,
      executeRawSql
    })

    const assistantPath = path.join(tempDir, 'Personal', 'Assistants', 'ast-1.json')
    const sessionPath = path.join(tempDir, 'Personal', 'Sessions', 'sess-1.json')

    expect(await fileSystem.exists(assistantPath)).toBe(true)
    expect(await fileSystem.exists(sessionPath)).toBe(true)

    const assistant = JSON.parse(await fs.readFile(assistantPath, 'utf8'))
    expect(assistant.id).toBe('ast-1')
    expect(assistant.name).toBe('Legacy Bot')
    expect(assistant.isDefault).toBe(true)

    const sessionAggregate = JSON.parse(await fs.readFile(sessionPath, 'utf8'))
    expect(sessionAggregate.session.id).toBe('sess-1')
    expect(sessionAggregate.messages).toHaveLength(1)
    expect(sessionAggregate.messages[0].parts).toHaveLength(1)
    expect(sessionAggregate.messages[0].parts[0].data).toEqual({ text: 'hi' })
  })
})
