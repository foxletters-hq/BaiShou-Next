import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { MigrationTargetStoragePathService } from '../migration-target-path.service'
import { migrateLegacyArchiveContents } from '../legacy-archive-migration.shared'
import { isBetterSqlite3Available } from './better-sqlite3-available'

async function executeRawSql(
  client: unknown,
  statement: string,
  args: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const db = client as Database.Database
  const stmt = db.prepare(statement)
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

describe.skipIf(!isBetterSqlite3Available())('legacy upgrade bootstrap safety', () => {
  let tempDir: string
  let sourceDir: string
  let targetDir: string
  const fileSystem = createNodeFileSystem()
  let db: Database.Database

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-bootstrap-'))
    sourceDir = path.join(tempDir, 'source')
    targetDir = path.join(tempDir, 'target')
    await fs.mkdir(path.join(sourceDir, 'Personal', 'Journals', '2024', '01'), { recursive: true })
    await fs.writeFile(
      path.join(sourceDir, 'Personal', 'Journals', '2024', '01', '2024-01-15.md'),
      'legacy journal',
      'utf8'
    )
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
    db?.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('exports vault files without merging agent sqlite into main database', async () => {
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

    const mergedAgents = await executeRawSql(db, 'SELECT id FROM agent_assistants')
    expect(mergedAgents.rows).toHaveLength(0)

    const personalVault = path.join(targetDir, 'Personal')
    expect(await fileSystem.exists(personalVault)).toBe(true)
    expect(
      await fileSystem.exists(
        path.join(targetDir, 'Personal', 'Journals', '2024', '01', '2024-01-15.md')
      )
    ).toBe(false)
  })

  it('copies Journals when migrating across different workspace directories', async () => {
    await migrateLegacyArchiveContents({
      fileSystem,
      sourceDir,
      targetWorkspaceDir: targetDir,
      sqliteClient: db,
      executeRawSql,
      importAvatar: async () => 'avatars/test.png'
    })

    expect(
      await fileSystem.exists(
        path.join(targetDir, 'Personal', 'Journals', '2024', '01', '2024-01-15.md')
      )
    ).toBe(true)
  })
})
