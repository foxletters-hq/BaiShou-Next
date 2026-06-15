import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { ShadowIndexConnectionManager } from '../shadow-index.connection.manager'
import { SHADOW_INDEX_DB_FILENAME } from '../shadow-index-schema.shared'

import { sql } from 'drizzle-orm'
import { existsSync } from 'node:fs'

describe('ShadowIndexConnectionManager', () => {
  let manager: ShadowIndexConnectionManager
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-shadow-test-'))
    manager = new ShadowIndexConnectionManager()
  })

  afterEach(async () => {
    if (manager.isConnected()) {
      manager.disconnect()
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (e) {
      // ignore
    }
    vi.clearAllMocks()
  })

  it('should initialize successfully in global shadow directory', async () => {
    await manager.connect(tempDir)
    expect(manager.isConnected()).toBe(true)
    expect(existsSync(path.join(tempDir, SHADOW_INDEX_DB_FILENAME))).toBe(true)

    const db = manager.getDb()
    await db.run(sql`PRAGMA journal_mode`)
    expect(db).toBeDefined()
  })

  it('should throw an error when getDb is called before connection', () => {
    expect(() => manager.getDb()).toThrowError(
      '[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()'
    )
  })

  it('should ensure journals_fts and journals_index tables are initialized with vault_name', async () => {
    await manager.connect(tempDir)
    const db = manager.getDb()

    const tablesResult = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('journals_index', 'journals_fts')`
    )

    const tableNames = tablesResult.map((row) => (row as any).name)
    expect(tableNames).toContain('journals_index')
    expect(tableNames).toContain('journals_fts')

    const columnsResult = await db.all(sql`PRAGMA table_info(journals_index)`)
    const columnNames = columnsResult.map((row) => (row as any).name)
    expect(columnNames).toContain('vault_name')
  })

  it('should migrate legacy schema without vault_name by rebuilding tables', async () => {
    const dbFile = path.join(tempDir, SHADOW_INDEX_DB_FILENAME)
    await fs.mkdir(tempDir, { recursive: true })

    const { createClient } = await import('@libsql/client')
    const legacy = createClient({ url: `file:${dbFile}` })
    await legacy.execute(`
      CREATE TABLE journals_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        file_path TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        content_hash TEXT NOT NULL
      )
    `)
    await legacy.execute('PRAGMA user_version = 1')
    legacy.close()

    await manager.connect(tempDir)
    expect(manager.isConnected()).toBe(true)

    const db = manager.getDb()
    const columnsResult = await db.all(sql`PRAGMA table_info(journals_index)`)
    const columnNames = columnsResult.map((row) => (row as any).name)
    expect(columnNames).toContain('vault_name')

    const versionResult = await db.all(sql`PRAGMA user_version`)
    expect((versionResult[0] as any).user_version).toBe(2)
  })

  it('should be able to recover from a corrupted database file', async () => {
    const dbFile = path.join(tempDir, SHADOW_INDEX_DB_FILENAME)
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(dbFile, 'THIS_IS_NOT_A_SQLITE_FILE_TOTALLY_CORRUPT')

    await expect(manager.connect(tempDir)).resolves.not.toThrow()
    expect(manager.isConnected()).toBe(true)

    const db = manager.getDb()
    const tablesResult = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='journals_index'`
    )
    expect(tablesResult.length).toBeGreaterThan(0)
  })

  it('should reuse connection when connect is called again with same global dir', async () => {
    await manager.connect(tempDir)
    const firstDb = manager.getDb()
    await manager.connect(tempDir)
    expect(manager.getDb()).toBe(firstDb)
  })

  it('should disconnect successfully without errors', async () => {
    await manager.connect(tempDir)
    expect(manager.isConnected()).toBe(true)

    manager.disconnect()
    expect(manager.isConnected()).toBe(false)
  })
})
