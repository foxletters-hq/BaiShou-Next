import * as path from '../fs/path.util'
import { deriveLegacyVaultId } from '@baishou/shared'
import {
  LEGACY_IMPORT_MESSAGE_PAGE_SIZE,
  LEGACY_IMPORT_PART_PAGE_SIZE,
  type LegacyVersionMigrationImporterDeps
} from './legacy-version-migration.importer.types'
import {
  buildLegacyMessageAggregate,
  buildLegacySessionAggregate,
  toUnixSec
} from './legacy-version-migration.importer.chats.build'

export function resolveTargetVaultId(
  deps: LegacyVersionMigrationImporterDeps,
  targetVaultName: string
): string {
  try {
    const vaults = deps.vaultService?.getAllVaults?.()
    if (Array.isArray(vaults)) {
      const match = vaults.find((v) => v.name === targetVaultName)
      if (match?.id) return match.id
    }
  } catch {
    // best-effort
  }
  return deriveLegacyVaultId(targetVaultName)
}

export async function resolveLegacyOrderBy(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  tableName: 'agent_messages' | 'agent_parts'
): Promise<string> {
  try {
    const info = await deps.executeRawSql(
      deps.sqliteClient,
      `PRAGMA ${alias}.table_info('${tableName}')`
    )
    const columns = new Set(info.rows.map((row) => String(row.name)).filter(Boolean))
    if (columns.has('order_index')) return 'order_index ASC, rowid ASC'
    if (columns.has('created_at')) return 'created_at ASC, rowid ASC'
  } catch {
    // Older/corrupt legacy DBs still get a stable best-effort order below.
  }
  return 'rowid ASC'
}

export async function loadLegacyPartsForMessage(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  messageId: string,
  orderBy: string
): Promise<Record<string, unknown>[]> {
  const parts: Record<string, unknown>[] = []
  let offset = 0
  while (true) {
    const page = (
      await deps.executeRawSql(
        deps.sqliteClient,
        `SELECT * FROM ${alias}.agent_parts
         WHERE message_id = ?
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [messageId, LEGACY_IMPORT_PART_PAGE_SIZE, offset]
      )
    ).rows as Record<string, unknown>[]
    if (page.length === 0) break
    parts.push(...page)
    if (page.length < LEGACY_IMPORT_PART_PAGE_SIZE) break
    offset += LEGACY_IMPORT_PART_PAGE_SIZE
  }
  return parts
}

export async function loadLegacyMessagesForSession(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  oldSessionId: string,
  newSessionId: string
) {
  const messages: ReturnType<typeof buildLegacyMessageAggregate>[] = []
  const messageOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_messages')
  const partOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_parts')
  let offset = 0
  let index = 0

  while (true) {
    const messageRows = (
      await deps.executeRawSql(
        deps.sqliteClient,
        `SELECT * FROM ${alias}.agent_messages
         WHERE session_id = ?
         ORDER BY ${messageOrderBy}
         LIMIT ? OFFSET ?`,
        [oldSessionId, LEGACY_IMPORT_MESSAGE_PAGE_SIZE, offset]
      )
    ).rows as Record<string, unknown>[]

    if (messageRows.length === 0) break

    for (const messageRow of messageRows) {
      const oldMessageId = String(messageRow.id ?? '')
      const parts = oldMessageId
        ? await loadLegacyPartsForMessage(deps, alias, oldMessageId, partOrderBy)
        : []
      messages.push(buildLegacyMessageAggregate(messageRow, parts, newSessionId, index))
      index += 1
    }

    if (messageRows.length < LEGACY_IMPORT_MESSAGE_PAGE_SIZE) break
    offset += LEGACY_IMPORT_MESSAGE_PAGE_SIZE
  }

  return messages
}

export async function replaceTargetSessionRows(
  deps: LegacyVersionMigrationImporterDeps,
  session: ReturnType<typeof buildLegacySessionAggregate>
): Promise<void> {
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_parts WHERE session_id = ?', [
    session.id
  ])
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_messages WHERE session_id = ?', [
    session.id
  ])
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_sessions WHERE id = ?', [
    session.id
  ])

  let columns = new Set<string>()
  try {
    const info = await deps.executeRawSql(deps.sqliteClient, `PRAGMA table_info('agent_sessions')`)
    columns = new Set(info.rows.map((row: any) => String(row.name)).filter(Boolean))
  } catch {
    // best-effort
  }

  const resolvedVaultId = session.vaultId || resolveTargetVaultId(deps, session.vaultName)

  // 当未能读出列名（如纯 mock 环境且未 mock table_info），默认组装包含 vault_id 的现代 Schema
  const hasVaultId = columns.size === 0 || columns.has('vault_id')
  const hasVaultName = columns.has('vault_name')

  const cols: string[] = ['id', 'title']
  const vals: unknown[] = [session.id, session.title ?? null]

  if (hasVaultId) {
    cols.push('vault_id')
    vals.push(resolvedVaultId)
  }
  if (hasVaultName) {
    cols.push('vault_name')
    vals.push(session.vaultName)
  }

  cols.push('assistant_id', 'is_pinned', 'system_prompt')
  vals.push(session.assistantId, session.isPinned ? 1 : 0, session.systemPrompt ?? null)

  if (columns.has('mounted_notebook_ids')) {
    cols.push('mounted_notebook_ids')
    vals.push('')
  }

  cols.push(
    'provider_id',
    'model_id',
    'total_input_tokens',
    'total_output_tokens',
    'total_cache_read_input_tokens',
    'total_cache_write_input_tokens',
    'total_cost_micros',
    'created_at',
    'updated_at'
  )
  vals.push(
    session.providerId,
    session.modelId,
    session.totalInputTokens,
    session.totalOutputTokens,
    session.totalCacheReadInputTokens,
    session.totalCacheWriteInputTokens,
    session.totalCostMicros,
    toUnixSec(session.createdAt),
    toUnixSec(session.updatedAt)
  )

  const placeholders = cols.map(() => '?').join(',')
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT INTO agent_sessions (${cols.join(',')}) VALUES (${placeholders})`,
    vals
  )
}

export async function insertTargetMessage(
  deps: LegacyVersionMigrationImporterDeps,
  message: ReturnType<typeof buildLegacyMessageAggregate>
): Promise<void> {
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT OR IGNORE INTO agent_messages
      (id, session_id, role, is_summary, order_index, input_tokens, output_tokens,
       cache_read_input_tokens, cache_write_input_tokens, cost_micros, provider_id, model_id,
       created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      message.id,
      message.sessionId,
      message.role,
      message.isSummary ? 1 : 0,
      message.orderIndex,
      message.inputTokens ?? null,
      message.outputTokens ?? null,
      null,
      null,
      message.costMicros ?? null,
      message.providerId ?? null,
      message.modelId ?? null,
      toUnixSec(message.createdAt)
    ]
  )
}

export async function insertTargetPart(
  deps: LegacyVersionMigrationImporterDeps,
  part: ReturnType<typeof buildLegacyMessageAggregate>['parts'][number]
): Promise<void> {
  const dataStr = typeof part.data === 'string' ? part.data : JSON.stringify(part.data ?? null)
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT OR IGNORE INTO agent_parts
      (id, message_id, session_id, type, data, created_at)
     VALUES (?,?,?,?,?,?)`,
    [part.id, part.messageId, part.sessionId, part.type, dataStr, toUnixSec(part.createdAt)]
  )
}

export async function streamLegacySessionFromSource(options: {
  deps: LegacyVersionMigrationImporterDeps
  alias: string
  oldSessionId: string
  newSessionId: string
  sessionRow: Record<string, unknown>
  mappedAssistantId: string
  legacyVaultName: string
}): Promise<void> {
  const {
    deps,
    alias,
    oldSessionId,
    newSessionId,
    sessionRow,
    mappedAssistantId,
    legacyVaultName
  } = options
  const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)
  const targetVaultId = resolveTargetVaultId(deps, targetVaultName)

  if (!deps.getSessionsBaseDirectory) {
    const enrichedMessages = await loadLegacyMessagesForSession(
      deps,
      alias,
      oldSessionId,
      newSessionId
    )
    await deps.upsertSessionAggregate({
      session: buildLegacySessionAggregate(
        sessionRow,
        newSessionId,
        mappedAssistantId,
        targetVaultName,
        targetVaultId
      ),
      messages: enrichedMessages
    })
    await deps.sessionManager.flushSessionToDisk(newSessionId)
    return
  }

  const session = buildLegacySessionAggregate(
    sessionRow,
    newSessionId,
    mappedAssistantId,
    targetVaultName,
    targetVaultId
  )
  await replaceTargetSessionRows(deps, session)

  const sessionsDir = await deps.getSessionsBaseDirectory(targetVaultName)
  await deps.fileSystem.mkdir(sessionsDir, { recursive: true })
  const sessionPath = path.join(sessionsDir, `${newSessionId}.json`)
  const tempPath = `${sessionPath}.tmp`
  const messageOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_messages')
  const partOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_parts')

  try {
    await deps.fileSystem.writeFile(
      tempPath,
      `{"session":${JSON.stringify(session)},"messages":[`,
      'utf8'
    )
    let wroteMessage = false
    let offset = 0
    let index = 0

    while (true) {
      const messageRows = (
        await deps.executeRawSql(
          deps.sqliteClient,
          `SELECT * FROM ${alias}.agent_messages
           WHERE session_id = ?
           ORDER BY ${messageOrderBy}
           LIMIT ? OFFSET ?`,
          [oldSessionId, LEGACY_IMPORT_MESSAGE_PAGE_SIZE, offset]
        )
      ).rows as Record<string, unknown>[]

      if (messageRows.length === 0) break

      for (const messageRow of messageRows) {
        const oldMessageId = String(messageRow.id ?? '')
        const parts = oldMessageId
          ? await loadLegacyPartsForMessage(deps, alias, oldMessageId, partOrderBy)
          : []
        const message = buildLegacyMessageAggregate(messageRow, parts, newSessionId, index)
        await insertTargetMessage(deps, message)
        for (const part of message.parts) {
          await insertTargetPart(deps, part)
        }
        const prefix = wroteMessage ? ',' : ''
        await deps.fileSystem.appendFile(tempPath, `${prefix}${JSON.stringify(message)}`, 'utf8')
        wroteMessage = true
        index += 1
      }

      if (messageRows.length < LEGACY_IMPORT_MESSAGE_PAGE_SIZE) break
      offset += LEGACY_IMPORT_MESSAGE_PAGE_SIZE
    }

    await deps.fileSystem.appendFile(tempPath, ']}', 'utf8')
    if (await deps.fileSystem.exists(sessionPath)) {
      await deps.fileSystem.unlink(sessionPath)
    }
    await deps.fileSystem.rename(tempPath, sessionPath)
  } catch (error) {
    try {
      if (await deps.fileSystem.exists(tempPath)) {
        await deps.fileSystem.unlink(tempPath)
      }
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}
