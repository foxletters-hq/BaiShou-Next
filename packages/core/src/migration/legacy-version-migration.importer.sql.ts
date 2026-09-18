import {
  normalizeSqliteAttachPath,
  scanLegacyDatabases,
  isVaultSpecificLegacyAgentDb,
  resolveLegacyAgentDbPathsForVault
} from './legacy-migration.shared'
import { legacySessionBelongsToVault } from './legacy-version-migration.util'
import {
  LEGACY_IMPORT_SESSION_PAGE_SIZE,
  quoteSqlString,
  type LegacyAgentRows,
  type LegacyAgentSessionSource,
  type LegacyVersionMigrationImporterDeps
} from './legacy-version-migration.importer.types'

export async function queryLegacyAgentRows(
  deps: LegacyVersionMigrationImporterDeps,
  options?: { legacyVaultName?: string }
): Promise<LegacyAgentRows> {
  const { fileSystem, sourceRoot, sqliteClient, executeRawSql } = deps
  const { legacyVaultName } = options ?? {}

  let agentDbPaths: string[]
  if (legacyVaultName) {
    agentDbPaths = await resolveLegacyAgentDbPathsForVault(fileSystem, sourceRoot, legacyVaultName)
  } else {
    agentDbPaths = (await scanLegacyDatabases(fileSystem, sourceRoot)).agentDbs
  }

  const uniquePaths = [...new Set(agentDbPaths.map((p) => normalizeSqliteAttachPath(p)))]
  const assistants: Record<string, unknown>[] = []
  const sessions: Record<string, unknown>[] = []
  const messages: Record<string, unknown>[] = []
  const parts: Record<string, unknown>[] = []
  const errors: string[] = []
  const seenAssistantIds = new Set<string>()
  const seenSessionIds = new Set<string>()
  const sessionSources = new Map<string, LegacyAgentSessionSource>()

  for (let i = 0; i < uniquePaths.length; i++) {
    const alias = `legacy_import_${i}`
    const rawAttachPath = uniquePaths[i]!
    const vaultSpecific = legacyVaultName
      ? isVaultSpecificLegacyAgentDb(rawAttachPath, legacyVaultName)
      : false
    try {
      const attachPath = deps.prepareSqliteAttachPath
        ? await deps.prepareSqliteAttachPath(rawAttachPath)
        : rawAttachPath
      console.info('[VersionMigration][import-agent-db] attach', {
        legacyVaultName,
        rawAttachPath,
        attachPath,
        vaultSpecific
      })
      await executeRawSql(sqliteClient, `ATTACH DATABASE ${quoteSqlString(attachPath)} AS ${alias}`)

      const assistantRows = (
        await executeRawSql(sqliteClient, `SELECT * FROM ${alias}.agent_assistants`)
      ).rows
      const sessionRows: Record<string, unknown>[] = []
      let sessionOffset = 0
      while (true) {
        const page = (
          await executeRawSql(
            sqliteClient,
            `SELECT * FROM ${alias}.agent_sessions ORDER BY id LIMIT ? OFFSET ?`,
            [LEGACY_IMPORT_SESSION_PAGE_SIZE, sessionOffset]
          )
        ).rows as Record<string, unknown>[]
        if (page.length === 0) break
        sessionRows.push(...page)
        if (page.length < LEGACY_IMPORT_SESSION_PAGE_SIZE) break
        sessionOffset += LEGACY_IMPORT_SESSION_PAGE_SIZE
      }

      const filteredSessions =
        legacyVaultName && !vaultSpecific
          ? sessionRows.filter((row) =>
              legacySessionBelongsToVault(row.vault_name, legacyVaultName)
            )
          : sessionRows
      console.info('[VersionMigration][import-agent-db] rows', {
        legacyVaultName,
        rawAttachPath,
        assistantRows: assistantRows.length,
        sessionRows: sessionRows.length,
        filteredSessions: filteredSessions.length
      })

      const sessionAssistantIds = new Set<string>()
      for (const row of filteredSessions) {
        const sid = String(row.id ?? '')
        if (!sid || seenSessionIds.has(sid)) continue
        seenSessionIds.add(sid)
        sessionSources.set(sid, { rawAttachPath, attachPath })
        sessions.push(row)
        if (row.assistant_id != null) {
          sessionAssistantIds.add(String(row.assistant_id))
        }
      }

      for (const row of assistantRows) {
        const aid = String(row.id ?? '')
        if (!aid || seenAssistantIds.has(aid)) continue
        if (
          legacyVaultName &&
          !vaultSpecific &&
          sessionAssistantIds.size > 0 &&
          !sessionAssistantIds.has(aid)
        ) {
          continue
        }
        seenAssistantIds.add(aid)
        assistants.push(row)
      }

      await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VersionMigration][import-agent-db] failed', {
        legacyVaultName,
        rawAttachPath,
        alias,
        error: message
      })
      errors.push(message)
      try {
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
      } catch {
        // ignore
      }
    }
  }

  return { assistants, sessions, messages, parts, errors, sessionSources }
}
