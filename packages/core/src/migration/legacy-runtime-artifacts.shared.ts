import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { sanitizeVaultDirectoryName } from '../vault/vault-name.util'
import type { RawSqlExecutor } from './legacy-migration.shared'

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
  if (mapped['createdAt'] !== undefined) mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (mapped['updatedAt'] !== undefined) mapped['updatedAt'] = normalizeTimestamp(mapped['updatedAt'])
  if (typeof mapped['isDefault'] === 'number') mapped['isDefault'] = mapped['isDefault'] === 1
  if (typeof mapped['isPinned'] === 'number') mapped['isPinned'] = mapped['isPinned'] === 1
  return mapped
}

function normalizeSessionRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined) mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (mapped['updatedAt'] !== undefined) mapped['updatedAt'] = normalizeTimestamp(mapped['updatedAt'])
  if (typeof mapped['isPinned'] === 'number') mapped['isPinned'] = mapped['isPinned'] === 1
  return mapped
}

function normalizeMessageRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined) mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
  if (typeof mapped['isSummary'] === 'number') mapped['isSummary'] = mapped['isSummary'] === 1
  return mapped
}

function normalizePartRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped = mapRowToCamel(row)
  if (mapped['createdAt'] !== undefined) mapped['createdAt'] = normalizeTimestamp(mapped['createdAt'])
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

/**
 * 将合并后的 Agent DB 导出为新版磁盘 JSON（Assistants / Sessions），
 * 防止 bootstrap fullResyncFromDisks 误删仅存在于 SQLite 的旧版数据。
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

  const sessionRows = await executeRawSql(sqliteClient, 'SELECT * FROM agent_sessions')
  for (const rawSession of sessionRows.rows) {
    const session = normalizeSessionRow(rawSession as Record<string, unknown>)
    const sessionId = String(session['id'] ?? '')
    if (!sessionId) continue

    const vaultName = sanitizeVaultDirectoryName(
      String(session['vaultName'] ?? defaultVaultName)
    )
    const sessionsDir = path.join(targetWorkspaceDir, vaultName, 'Sessions')
    await ensureDir(fileSystem, sessionsDir)

    const messageRows = await executeRawSql(
      sqliteClient,
      'SELECT * FROM agent_messages WHERE session_id = ? ORDER BY order_index ASC',
      [sessionId]
    )
    const partRows = await executeRawSql(
      sqliteClient,
      'SELECT * FROM agent_parts WHERE session_id = ?',
      [sessionId]
    )

    const partsByMessage = new Map<string, Record<string, unknown>[]>()
    for (const rawPart of partRows.rows) {
      const part = normalizePartRow(rawPart as Record<string, unknown>)
      const messageId = String(part['messageId'] ?? '')
      if (!messageId) continue
      const list = partsByMessage.get(messageId) ?? []
      list.push(part)
      partsByMessage.set(messageId, list)
    }

    const messages = messageRows.rows.map((rawMessage) => {
      const message = normalizeMessageRow(rawMessage as Record<string, unknown>)
      const messageId = String(message['id'] ?? '')
      return {
        ...message,
        parts: partsByMessage.get(messageId) ?? []
      }
    })

    const aggregate = { session, messages }
    const sessionPath = path.join(sessionsDir, `${sessionId}.json`)
    await fileSystem.writeFile(sessionPath, JSON.stringify(aggregate, null, 2), 'utf8')
  }
}
