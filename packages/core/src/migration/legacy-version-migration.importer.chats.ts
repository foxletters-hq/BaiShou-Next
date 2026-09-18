import {
  generateRemappedId,
  workspaceSectionId,
  type LegacyVersionMigrationImportResult
} from './legacy-version-migration.util'
import {
  hashString,
  quoteSqlString,
  type LegacyAgentRows,
  type LegacyVersionMigrationImporterDeps
} from './legacy-version-migration.importer.types'
import {
  buildLegacyMessageAggregate,
  toDate
} from './legacy-version-migration.importer.chats.build'
import { streamLegacySessionFromSource } from './legacy-version-migration.importer.chats.persist'

export async function importLegacyChatsFromRows(
  deps: LegacyVersionMigrationImporterDeps,
  rows: Pick<LegacyAgentRows, 'sessions' | 'messages' | 'parts' | 'errors'>,
  assistantIdMap: Record<string, string>,
  legacyVaultName: string
): Promise<LegacyVersionMigrationImportResult> {
  const { sessionManager, onProgress, upsertSessionAggregate } = deps
  const existingSessionIds = await deps.existingSessionIds()
  const { sessions, messages, parts, errors } = rows

  let imported = 0
  let skipped = 0
  let failed = 0
  const warnings: string[] = []
  const failureSamples: string[] = []

  const messagesBySession = new Map<string, Record<string, unknown>[]>()
  for (const message of messages) {
    const sessionId = String(message.session_id ?? '')
    if (!sessionId) continue
    const list = messagesBySession.get(sessionId) ?? []
    list.push(message)
    messagesBySession.set(sessionId, list)
  }

  const partsByMessage = new Map<string, Record<string, unknown>[]>()
  for (const part of parts) {
    const messageId = String(part.message_id ?? '')
    if (!messageId) continue
    const list = partsByMessage.get(messageId) ?? []
    list.push(part)
    partsByMessage.set(messageId, list)
  }

  const fallbackAssistantId = Object.values(assistantIdMap)[0]

  for (const sessionRow of sessions) {
    const oldSessionId = String(sessionRow.id ?? '')
    if (!oldSessionId) continue
    onProgress?.(String(sessionRow.title ?? oldSessionId))

    const rawAssistantId =
      sessionRow.assistant_id != null && String(sessionRow.assistant_id).trim() !== ''
        ? String(sessionRow.assistant_id)
        : null
    const mappedAssistantId = rawAssistantId ? assistantIdMap[rawAssistantId] : fallbackAssistantId
    if (!mappedAssistantId) {
      skipped += 1
      if (!warnings.includes('version_migration.import_chat_missing_assistant')) {
        warnings.push('version_migration.import_chat_missing_assistant')
      }
      continue
    }

    const newSessionId = existingSessionIds.has(oldSessionId)
      ? generateRemappedId('legacy_sess')
      : oldSessionId

    const enrichedMessages = (messagesBySession.get(oldSessionId) ?? [])
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((messageRow, index) =>
        buildLegacyMessageAggregate(
          messageRow,
          partsByMessage.get(String(messageRow.id ?? '')) ?? [],
          newSessionId,
          index
        )
      )

    try {
      const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)
      await upsertSessionAggregate({
        session: {
          id: newSessionId,
          title: sessionRow.title != null ? String(sessionRow.title) : null,
          vaultName: targetVaultName,
          assistantId: mappedAssistantId,
          isPinned: Number(sessionRow.is_pinned) === 1,
          systemPrompt:
            sessionRow.system_prompt != null ? String(sessionRow.system_prompt) : undefined,
          providerId: sessionRow.provider_id != null ? String(sessionRow.provider_id) : '',
          modelId: sessionRow.model_id != null ? String(sessionRow.model_id) : '',
          totalInputTokens:
            sessionRow.total_input_tokens != null ? Number(sessionRow.total_input_tokens) : 0,
          totalOutputTokens:
            sessionRow.total_output_tokens != null ? Number(sessionRow.total_output_tokens) : 0,
          totalCostMicros:
            sessionRow.total_cost_micros != null ? Number(sessionRow.total_cost_micros) : 0,
          createdAt: toDate(sessionRow.created_at),
          updatedAt: toDate(sessionRow.updated_at)
        },
        messages: enrichedMessages
      })
      await sessionManager.flushSessionToDisk(newSessionId)
      imported += 1
    } catch (error) {
      failed += 1
      if (failureSamples.length < 12) {
        const title = String(sessionRow.title ?? oldSessionId)
        const message = error instanceof Error ? error.message : String(error)
        failureSamples.push(`会话 ${title}: ${message}`)
      }
    }
  }

  if (errors.length > 0) {
    warnings.push('version_migration.warning_agent_db_read_partial')
  }

  return {
    sectionId: workspaceSectionId(legacyVaultName),
    imported,
    skipped,
    failed,
    warnings,
    errors: errors.length > 0 ? errors : undefined,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}

type LegacyChatImportCandidate = {
  sessionRow: Record<string, unknown>
  oldSessionId: string
  newSessionId: string
  mappedAssistantId: string
  attachPath: string
}

export async function importLegacyChatsFromSources(
  deps: LegacyVersionMigrationImporterDeps,
  rows: Pick<LegacyAgentRows, 'sessions' | 'errors' | 'sessionSources'>,
  assistantIdMap: Record<string, string>,
  legacyVaultName: string
): Promise<LegacyVersionMigrationImportResult> {
  const { onProgress } = deps
  const existingSessionIds = await deps.existingSessionIds()
  const { sessions, errors } = rows

  let imported = 0
  let skipped = 0
  let failed = 0
  const warnings: string[] = []
  const failureSamples: string[] = []
  const fallbackAssistantId = Object.values(assistantIdMap)[0]
  const sessionsByAttachPath = new Map<string, LegacyChatImportCandidate[]>()
  let attachGroupIndex = 0

  for (const sessionRow of sessions) {
    const oldSessionId = String(sessionRow.id ?? '')
    if (!oldSessionId) continue

    const rawAssistantId =
      sessionRow.assistant_id != null && String(sessionRow.assistant_id).trim() !== ''
        ? String(sessionRow.assistant_id)
        : null
    const mappedAssistantId = rawAssistantId ? assistantIdMap[rawAssistantId] : fallbackAssistantId
    if (!mappedAssistantId) {
      skipped += 1
      if (!warnings.includes('version_migration.import_chat_missing_assistant')) {
        warnings.push('version_migration.import_chat_missing_assistant')
      }
      continue
    }

    const newSessionId = existingSessionIds.has(oldSessionId)
      ? generateRemappedId('legacy_sess')
      : oldSessionId
    const source = rows.sessionSources?.get(oldSessionId)
    if (!source) {
      skipped += 1
      if (!warnings.includes('version_migration.warning_agent_db_read_partial')) {
        warnings.push('version_migration.warning_agent_db_read_partial')
      }
      continue
    }

    const group = sessionsByAttachPath.get(source.attachPath) ?? []
    group.push({
      sessionRow,
      oldSessionId,
      newSessionId,
      mappedAssistantId,
      attachPath: source.attachPath
    })
    sessionsByAttachPath.set(source.attachPath, group)
  }

  for (const [attachPath, candidates] of sessionsByAttachPath) {
    attachGroupIndex += 1
    const alias = `legacy_chat_${attachGroupIndex}_${hashString(attachPath)}`
    let attached = false
    try {
      await deps.executeRawSql(
        deps.sqliteClient,
        `ATTACH DATABASE ${quoteSqlString(attachPath)} AS ${alias}`
      )
      attached = true

      for (const candidate of candidates) {
        const { sessionRow, oldSessionId, newSessionId, mappedAssistantId } = candidate
        onProgress?.(String(sessionRow.title ?? oldSessionId))
        try {
          await streamLegacySessionFromSource({
            deps,
            alias,
            oldSessionId,
            newSessionId,
            sessionRow,
            mappedAssistantId,
            legacyVaultName
          })
          imported += 1
        } catch (error) {
          failed += 1
          if (failureSamples.length < 12) {
            const title = String(sessionRow.title ?? oldSessionId)
            const message = error instanceof Error ? error.message : String(error)
            failureSamples.push(`会话 ${title}: ${message}`)
          }
        }
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      if (failureSamples.length < 12) {
        failureSamples.push(
          `无法连接旧版会话数据库（影响 ${candidates.length} 个会话）: ${message}`
        )
      }
    } finally {
      if (attached) {
        await deps
          .executeRawSql(deps.sqliteClient, `DETACH DATABASE ${alias}`)
          .catch(() => undefined)
      }
    }
  }

  if (errors.length > 0) {
    warnings.push('version_migration.warning_agent_db_read_partial')
  }

  return {
    sectionId: workspaceSectionId(legacyVaultName),
    imported,
    skipped,
    failed,
    warnings,
    errors: errors.length > 0 ? errors : undefined,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}
