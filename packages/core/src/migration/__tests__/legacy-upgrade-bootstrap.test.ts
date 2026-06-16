import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { AssistantManagerService } from '../../assistant/assistant-manager.service'
import { AssistantFileService } from '../../assistant/assistant-file.service'
import { MigrationTargetStoragePathService } from '../migration-target-path.service'
import { migrateLegacyArchiveContents } from '../legacy-archive-migration.shared'

async function executeRawSql(
  client: Database.Database,
  statement: string,
  args: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const stmt = client.prepare(statement)
  const head = statement.trim().split(/\s+/)[0]?.toUpperCase()
  if (head === 'SELECT' || head === 'WITH') {
    const rows = (args.length > 0 ? stmt.all(...args) : stmt.all()) as Record<string, unknown>[]
    return { rows }
  }
  if (head === 'PRAGMA') {
    try {
      const rows = (args.length > 0 ? stmt.all(...args) : stmt.all()) as Record<string, unknown>[]
      return { rows }
    } catch {
      if (args.length > 0) stmt.run(...args)
      else stmt.run()
      return { rows: [] }
    }
  }
  if (args.length > 0) stmt.run(...args)
  else stmt.run()
  return { rows: [] }
}

function createFullAgentSchema(db: Database.Database): void {
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

describe('legacy upgrade bootstrap safety', () => {
  let tempDir: string
  let sourceDir: string
  let targetDir: string
  const fileSystem = createNodeFileSystem()
  let db: Database.Database

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-bootstrap-'))
    sourceDir = path.join(tempDir, 'source')
    targetDir = path.join(tempDir, 'target')
    await fs.mkdir(path.join(sourceDir, 'Personal', 'Journals'), { recursive: true })
    await fs.mkdir(path.join(sourceDir, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(sourceDir, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }])
    )

    const legacyDbPath = path.join(sourceDir, '.baishou', 'agent.sqlite')
    const legacyDb = new Database(legacyDbPath)
    createFullAgentSchema(legacyDb)
    legacyDb
      .prepare(
        `INSERT INTO agent_assistants (id, name, is_default, created_at, updated_at)
         VALUES ('legacy-ast', 'From Flutter', 1, '2024-01-01', '2024-01-02')`
      )
      .run()
    legacyDb.close()

    db = new Database(':memory:')
    createFullAgentSchema(db)
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('keeps assistants after fullResyncFromDisks when JSON artifacts were exported during migration', async () => {
    const migrationPath = new MigrationTargetStoragePathService(targetDir, 'Personal')
    const avatarImports: string[] = []

    await migrateLegacyArchiveContents({
      fileSystem,
      sourceDir,
      targetWorkspaceDir: targetDir,
      sqliteClient: db,
      executeRawSql,
      importAvatar: async (absPath, prefix) => {
        avatarImports.push(`${prefix}:${absPath}`)
        const avatarsDir = await migrationPath.getAvatarsDirectory()
        await fileSystem.mkdir(avatarsDir, { recursive: true })
        const rel = `avatars/${prefix}-avatar.png`
        await fileSystem.writeFile(path.join(targetDir, 'Personal', 'Attachments', rel), 'x')
        return rel
      }
    })

    const assistantJson = path.join(targetDir, 'Personal', 'Assistants', 'legacy-ast.json')
    expect(await fileSystem.exists(assistantJson)).toBe(true)

    const mockRepo = {
      findAll: async () => {
        const rows = await executeRawSql(db, 'SELECT * FROM agent_assistants')
        return rows.rows.map((row) => ({
          id: String(row.id),
          name: String(row.name)
        }))
      },
      findById: async (id: string) => {
        const rows = await executeRawSql(db, 'SELECT * FROM agent_assistants WHERE id = ?', [id])
        return rows.rows[0] ?? null
      },
      create: async () => {},
      update: async () => {},
      delete: async () => {}
    }

    const assistantFileService = new AssistantFileService(migrationPath, fileSystem)
    const mockAttachmentManager = {
      importAvatar: async () => 'avatars/test.jpg',
      resolveAvatarPath: async () => '/abs/test.jpg',
      listOrphans: async () => [],
      deleteBatch: async () => undefined
    } as any

    const manager = new AssistantManagerService(
      mockRepo as any,
      assistantFileService,
      mockAttachmentManager
    )

    await manager.fullResyncFromDisks()

    const remaining = await executeRawSql(db, 'SELECT id FROM agent_assistants')
    expect(remaining.rows.map((row) => row.id)).toContain('legacy-ast')
  })
})
