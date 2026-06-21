import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { scanLegacyVersionMigration } from '../legacy-version-migration.scan'

async function executeRawSql(
  client: unknown,
  statement: string,
  args: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const db = client as Database.Database
  const stmt = db.prepare(statement)
  const head = statement.trim().split(/\s+/)[0]?.toUpperCase()
  if (head === 'SELECT' || head === 'WITH' || head === 'PRAGMA') {
    const rows = (args.length > 0 ? stmt.all(...args) : stmt.all()) as Record<string, unknown>[]
    return { rows }
  }
  if (args.length > 0) stmt.run(...args)
  else stmt.run()
  return { rows: [] }
}

describe('legacy-version-migration.scan', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()
  let db: Database.Database

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'version-migration-scan-'))
    await fs.mkdir(path.join(tempDir, 'Personal', 'Journals', '2024', '01'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'Personal', 'Journals', '2024', '01', '2024-01-15.md'),
      '---\ndate: 2024-01-15\n---\n\nhello',
      'utf8'
    )
    await fs.mkdir(path.join(tempDir, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }]),
      'utf8'
    )

    const agentDbPath = path.join(tempDir, 'Personal', '.baishou', 'agent.sqlite')
    await fs.mkdir(path.dirname(agentDbPath), { recursive: true })
    const legacyDb = new Database(agentDbPath)
    legacyDb.exec(`
      CREATE TABLE agent_assistants (id TEXT PRIMARY KEY, name TEXT, updated_at TEXT);
      CREATE TABLE agent_sessions (id TEXT PRIMARY KEY, title TEXT, vault_name TEXT, assistant_id TEXT);
      CREATE TABLE agent_messages (id TEXT PRIMARY KEY, session_id TEXT);
      INSERT INTO agent_assistants VALUES ('a1', 'Latte', '2024-01-01');
      INSERT INTO agent_sessions VALUES ('s1', 'Hi', 'Personal', 'a1');
      INSERT INTO agent_messages VALUES ('m1', 's1');
    `)
    legacyDb.close()

    db = new Database(':memory:')
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('returns global sections and workspace previews for legacy root', async () => {
    const result = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: tempDir,
      sourceDisplayPath: tempDir,
      flutterPrefsConfig: { user_nickname: 'Alice' },
      flutterRawSp: {
        user_personas: JSON.stringify({ 默认: { 城市: '上海' } })
      },
      flutterDocumentsAvatarsDir: null,
      sqliteClient: db,
      executeRawSql
    })

    expect(result.globalSections.find((s) => s.sectionId === 'personas')?.count).toBe(1)
    expect(result.globalSections.find((s) => s.sectionId === 'config')?.available).toBe(true)
    expect(result.workspaces).toHaveLength(1)
    const personal = result.workspaces[0]!
    expect(personal.legacyVaultName).toBe('Personal')
    expect(personal.diaryCount).toBe(1)
    expect(personal.assistantCount).toBe(1)
    expect(personal.sessionCount).toBe(1)
    expect(personal.sectionId).toBe('workspace:Personal')
  })

  it('scans agent data for vault names with special characters', async () => {
    const vaultName = 'My Work/Space'
    const journalsDir = path.join(tempDir, vaultName, 'Journals', '2024', '01')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(
      path.join(journalsDir, '2024-01-20.md'),
      '---\ndate: 2024-01-20\n---\n\nx',
      'utf8'
    )

    const agentDbPath = path.join(tempDir, vaultName, '.baishou', 'agent.sqlite')
    await fs.mkdir(path.dirname(agentDbPath), { recursive: true })
    const legacyDb = new Database(agentDbPath)
    legacyDb.exec(`
      CREATE TABLE agent_assistants (id TEXT PRIMARY KEY, name TEXT, updated_at TEXT);
      CREATE TABLE agent_sessions (id TEXT PRIMARY KEY, title TEXT, vault_name TEXT, assistant_id TEXT);
      CREATE TABLE agent_messages (id TEXT PRIMARY KEY, session_id TEXT);
      INSERT INTO agent_assistants VALUES ('a2', 'Special', '2024-01-01');
      INSERT INTO agent_sessions VALUES ('s2', 'Chat', '${vaultName.replace(/'/g, "''")}', 'a2');
      INSERT INTO agent_messages VALUES ('m2', 's2');
    `)
    legacyDb.close()

    await fs.writeFile(
      path.join(tempDir, '.baishou', 'vault_registry.json'),
      JSON.stringify([{ name: 'Personal' }, { name: vaultName }]),
      'utf8'
    )

    const result = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: tempDir,
      sourceDisplayPath: tempDir,
      flutterPrefsConfig: null,
      flutterRawSp: null,
      flutterDocumentsAvatarsDir: null,
      sqliteClient: db,
      executeRawSql
    })

    const special = result.workspaces.find((ws) => ws.legacyVaultName === vaultName)
    expect(special?.assistantCount).toBe(1)
    expect(special?.sessionCount).toBe(1)
  })

  it('derives config and personas from flutterRawSp when flutterPrefsConfig is null', async () => {
    const result = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: tempDir,
      sourceDisplayPath: tempDir,
      flutterPrefsConfig: null,
      flutterRawSp: {
        user_nickname: 'Bob',
        user_personas: JSON.stringify({ 默认: { 城市: '北京' } }),
        global_dialogue_provider_id: 'openai'
      },
      flutterDocumentsAvatarsDir: null,
      sqliteClient: db,
      executeRawSql
    })

    expect(result.globalSections.find((s) => s.sectionId === 'personas')?.available).toBe(true)
    expect(result.globalSections.find((s) => s.sectionId === 'config')?.available).toBe(true)
  })

  it('detects personas from device_preferences when SP has no user_personas', async () => {
    const result = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: tempDir,
      sourceDisplayPath: tempDir,
      flutterPrefsConfig: {
        user_personas: JSON.stringify({ 备份身份: { name: 'FromConfig' } })
      },
      flutterRawSp: {
        user_nickname: 'Bob',
        global_dialogue_provider_id: 'openai'
      },
      flutterDocumentsAvatarsDir: null,
      sqliteClient: db,
      executeRawSql
    })

    const personasSection = result.globalSections.find((s) => s.sectionId === 'personas')
    expect(personasSection?.available).toBe(true)
    expect(personasSection?.count).toBe(1)
    expect(personasSection?.previewItems?.[0]?.label).toBe('备份身份')
  })

  it('counts archive markdown under Vault/Archives as summaries', async () => {
    await fs.mkdir(path.join(tempDir, 'Personal', 'Archives'), { recursive: true })
    await fs.writeFile(
      path.join(tempDir, 'Personal', 'Archives', '2024-W03.md'),
      '---\ntitle: Week 3\n---\n\nsummary body',
      'utf8'
    )

    const result = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: tempDir,
      sourceDisplayPath: tempDir,
      flutterPrefsConfig: null,
      flutterRawSp: null,
      flutterDocumentsAvatarsDir: null,
      sqliteClient: db,
      executeRawSql
    })

    const personal = result.workspaces[0]!
    expect(personal.archiveCount).toBeGreaterThanOrEqual(1)
    expect(personal.available).toBe(true)
  })
})
