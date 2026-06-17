import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { sanitizeVaultDirectoryName } from '../vault/vault-name.util'
import type { RawSqlExecutor } from './legacy-migration.shared'

const SESSION_PAGE_SIZE = 25
const MESSAGE_PAGE_SIZE = 80
const PART_PAGE_SIZE = 50

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function mapRowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = value
  }
  return out
}

function normalizeTimestamp(value: unknown): string | number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  if (typeof value === 'string') return value
  return String(value)
}

function normalizeAssistantRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined)
    mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (mapped['updatedAt'] !== undefined)
    mapped['updatedAt'] = normalizeTimestamp(mapped['updatedAt'])
  if (typeof mapped['isDefault'] === 'number') mapped['isDefault'] = mapped['isDefault'] === 1
  if (typeof mapped['isPinned'] === 'number') mapped['isPinned'] = mapped['isPinned'] === 1
  return mapped
}

function normalizeSessionRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined)
    mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (mapped['updatedAt'] !== undefined)
    mapped['updatedAt'] = normalizeTimestamp(mapped['updatedAt'])
  if (typeof mapped['isPinned'] === 'number') mapped['isPinned'] = mapped['isPinned'] === 1
  return mapped
}

function normalizeMessageRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined)
    mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (typeof mapped['isSummary'] === 'number') mapped['isSummary'] = mapped['isSummary'] === 1
  return mapped
}

function normalizePartRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined)
    mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (typeof mapped['data'] === 'string') {
    try {
      mapped['data'] = JSON.parse(mapped['data'] as string)
    } catch {
      // keep raw string
    }
  }
  return mapped
}

async function ensureDir(fileSystem: IFileSystem, dir: string): Promise<void> {
  if (!(await fileSystem.exists(dir))) {
    await fileSystem.mkdir(dir, { recursive: true })
  }
}

type TableColumnCache = Map<string, Set<string>>

async function getTableColumnNames(
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  tableName: string,
  cache: TableColumnCache
): Promise<Set<string>> {
  const cached = cache.get(tableName)
  if (cached) return cached

  const info = await executeRawSql(sqliteClient, `PRAGMA table_info(${tableName})`)
  const names = new Set(
    info.rows.map((row) => String((row as Record<string, unknown>).name)).filter(Boolean)
  )
  cache.set(tableName, names)
  return names
}

/** 旧版 Flutter agent.sqlite 的 agent_parts 无 order_index，按时间序兜底 */
async function resolveTableOrderByClause(
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  tableName: string,
  cache: TableColumnCache
): Promise<string> {
  const columns = await getTableColumnNames(sqliteClient, executeRawSql, tableName, cache)
  if (columns.has('order_index')) return 'order_index ASC'
  if (columns.has('created_at')) return 'created_at ASC, id ASC'
  return 'id ASC'
}

async function loadMessageParts(
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  messageId: string,
  columnCache: TableColumnCache
): Promise<Record<string, unknown>[]> {
  const parts: Record<string, unknown>[] = []
  let partOffset = 0
  const orderBy = await resolveTableOrderByClause(
    sqliteClient,
    executeRawSql,
    'agent_parts',
    columnCache
  )

  while (true) {
    const partRows = await executeRawSql(
      sqliteClient,
      `SELECT * FROM agent_parts
       WHERE message_id = ?
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [messageId, PART_PAGE_SIZE, partOffset]
    )

    if (partRows.rows.length === 0) break

    for (const row of partRows.rows) {
      parts.push(normalizePartRow(row as Record<string, unknown>))
    }

    partOffset += PART_PAGE_SIZE
    if (partRows.rows.length < PART_PAGE_SIZE) break
  }

  return parts
}

/** 流式写出单个会话 JSON，每次仅序列化一条消息，降低移动端导入峰值内存 */
export async function writeSessionAggregateFile(
  fileSystem: IFileSystem,
  sessionPath: string,
  session: Record<string, unknown>,
  sqliteClient: unknown,
  executeRawSql: RawSqlExecutor,
  sessionId: string
): Promise<void> {
  const tempPath = `${sessionPath}.tmp`
  const columnCache: TableColumnCache = new Map()
  const messageOrderBy = await resolveTableOrderByClause(
    sqliteClient,
    executeRawSql,
    'agent_messages',
    columnCache
  )

  try {
    await fileSystem.writeFile(
      tempPath,
      `{"session":${JSON.stringify(session)},"messages":[`,
      'utf8'
    )

    let wroteMessage = false
    let offset = 0

    while (true) {
      const messageRows = await executeRawSql(
        sqliteClient,
        `SELECT * FROM agent_messages
         WHERE session_id = ?
         ORDER BY ${messageOrderBy}
         LIMIT ? OFFSET ?`,
        [sessionId, MESSAGE_PAGE_SIZE, offset]
      )

      if (messageRows.rows.length === 0) break

      for (const rawMessage of messageRows.rows) {
        const message = normalizeMessageRow(rawMessage as Record<string, unknown>)
        const messageId = String(message['id'] ?? '')
        const parts = messageId
          ? await loadMessageParts(sqliteClient, executeRawSql, messageId, columnCache)
          : []

        const aggregateMessage = {
          ...message,
          parts
        }

        const prefix = wroteMessage ? ',' : ''
        await fileSystem.appendFile(tempPath, `${prefix}${JSON.stringify(aggregateMessage)}`, 'utf8')
        wroteMessage = true
      }

      offset += MESSAGE_PAGE_SIZE
      if (messageRows.rows.length < MESSAGE_PAGE_SIZE) break
    }

    await fileSystem.appendFile(tempPath, ']}', 'utf8')

    if (await fileSystem.exists(sessionPath)) {
      await fileSystem.unlink(sessionPath)
    }
    await fileSystem.rename(tempPath, sessionPath)
  } catch (error) {
    try {
      if (await fileSystem.exists(tempPath)) {
        await fileSystem.unlink(tempPath)
      }
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}

/**
 * 将合并后的 Agent DB 导出为新版磁盘 JSON（Assistants / Sessions），
 * 防止 bootstrap fullResyncFromDisks 误删仅存在于 SQLite 的旧版数据。
 *
 * 会话列表分页查询 + 单会话流式写出，避免 getAllAsync 一次性加载导致 OOM。
 */
export async function exportLegacyRuntimeArtifacts(options: {
  fileSystem: IFileSystem
  targetWorkspaceDir: string
  vaultNames: string[]
  sqliteClient: unknown
  executeRawSql: RawSqlExecutor
  defaultVaultName?: string
}): Promise<void> {
  const {
    fileSystem,
    targetWorkspaceDir,
    vaultNames,
    sqliteClient,
    executeRawSql,
    defaultVaultName = 'Personal'
  } = options

  const targetVaults =
    vaultNames.length > 0
      ? vaultNames.map((name) => sanitizeVaultDirectoryName(name))
      : [sanitizeVaultDirectoryName(defaultVaultName)]

  const assistantRows = await executeRawSql(sqliteClient, 'SELECT * FROM agent_assistants')
  const assistants = assistantRows.rows.map((row) =>
    normalizeAssistantRow(row as Record<string, unknown>)
  )

  for (const vaultName of targetVaults) {
    const assistantsDir = path.join(targetWorkspaceDir, vaultName, 'Assistants')
    await ensureDir(fileSystem, assistantsDir)
    for (const assistant of assistants) {
      const id = String(assistant['id'] ?? '')
      if (!id) continue
      const filePath = path.join(assistantsDir, `${id}.json`)
      await fileSystem.writeFile(filePath, JSON.stringify(assistant, null, 2), 'utf8')
    }
  }

  let sessionOffset = 0
  while (true) {
    const sessionRows = await executeRawSql(
      sqliteClient,
      `SELECT * FROM agent_sessions ORDER BY id LIMIT ? OFFSET ?`,
      [SESSION_PAGE_SIZE, sessionOffset]
    )

    if (sessionRows.rows.length === 0) break

    for (const rawSession of sessionRows.rows) {
      const session = normalizeSessionRow(rawSession as Record<string, unknown>)
      const sessionId = String(session['id'] ?? '')
      if (!sessionId) continue

      const vaultName = sanitizeVaultDirectoryName(String(session['vaultName'] ?? defaultVaultName))
      const sessionsDir = path.join(targetWorkspaceDir, vaultName, 'Sessions')
      await ensureDir(fileSystem, sessionsDir)

      const sessionPath = path.join(sessionsDir, `${sessionId}.json`)
      await writeSessionAggregateFile(
        fileSystem,
        sessionPath,
        session,
        sqliteClient,
        executeRawSql,
        sessionId
      )
    }

    sessionOffset += SESSION_PAGE_SIZE
    if (sessionRows.rows.length < SESSION_PAGE_SIZE) break
  }
}
