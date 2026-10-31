import { eq, desc, or, sql, and, inArray } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import {
  DEFAULT_LATTE_ASSISTANT_ID,
  SYSTEM_LATTE_ASSISTANT_ID,
  deriveLegacyVaultId,
  isVaultId,
  parseMountedNotebookIds,
  serializeMountedNotebookIds
} from '@baishou/shared'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'
import { compressionSnapshotsTable } from '../schema/compression-snapshots'
import {
  ensureAgentSessionIndexes,
  type InsertSessionInput
} from './session.repository.types'
import { usesSyncTransaction } from './session.repository.utils'

export type AgentSessionRow = Omit<
  InferSelectModel<typeof agentSessionsTable>,
  'mountedNotebookIds'
> & {
  mountedNotebookIds: string[]
  snippet?: string
}

function collapsePreviewWhitespace(raw: string, maxChars: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, maxChars)}…`
}

function extractAroundSearchKeyword(raw: string, query: string, maxChars: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const needle = query.trim().toLowerCase()
  if (!needle || cleaned.length <= maxChars) {
    return collapsePreviewWhitespace(cleaned, maxChars)
  }
  const idx = cleaned.toLowerCase().indexOf(needle)
  if (idx === -1) {
    return collapsePreviewWhitespace(cleaned, maxChars)
  }
  const half = Math.max(4, Math.floor((maxChars - needle.length) / 2))
  const start = Math.max(0, idx - half)
  const end = Math.min(cleaned.length, start + maxChars)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < cleaned.length ? '…' : ''
  return `${prefix}${cleaned.slice(start, end)}${suffix}`
}

function normalizeSessionAssistantId(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  return trimmed === DEFAULT_LATTE_ASSISTANT_ID ? SYSTEM_LATTE_ASSISTANT_ID : trimmed
}

function withMountedNotebookIds<
  T extends { mountedNotebookIds?: unknown; assistantId?: string | null }
>(row: T): T & { mountedNotebookIds: string[] } {
  const normalizedAssistantId =
    row.assistantId != null
      ? (normalizeSessionAssistantId(row.assistantId) ?? row.assistantId)
      : row.assistantId
  return {
    ...row,
    ...(normalizedAssistantId !== undefined ? { assistantId: normalizedAssistantId } : {}),
    mountedNotebookIds: parseMountedNotebookIds(row.mountedNotebookIds)
  }
}

function resolveInsertVaultId(raw: string | undefined): string {
  const value = raw || 'default'
  return isVaultId(value) ? value : deriveLegacyVaultId(value)
}

export class SessionCrudOps {
  constructor(private readonly db: AppDatabase) {}

  private async ensureSessionQueryIndexes(): Promise<void> {
    await ensureAgentSessionIndexes(this.db)
  }

  async upsertSession(input: InsertSessionInput): Promise<void> {
    const vaultId = resolveInsertVaultId(input.vaultId)
    const providerId = input.providerId || 'default'
    const modelId = input.modelId || 'default'
    const assistantId = normalizeSessionAssistantId(input.assistantId) ?? input.assistantId

    const now = new Date()

    await this.db
      .insert(agentSessionsTable)
      .values({
        id: input.id,
        title: input.title,
        vaultId: vaultId,
        assistantId,
        systemPrompt: input.systemPrompt,
        mountedNotebookIds: serializeMountedNotebookIds(input.mountedNotebookIds),
        providerId: providerId,
        modelId: modelId,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [agentSessionsTable.id],
        set: {
          title: input.title,
          vaultId: vaultId,
          updatedAt: now,
          ...(assistantId ? { assistantId } : {}),
          ...(input.providerId ? { providerId } : {}),
          ...(input.modelId ? { modelId } : {}),
          ...(input.mountedNotebookIds
            ? { mountedNotebookIds: serializeMountedNotebookIds(input.mountedNotebookIds) }
            : {})
        }
      })
  }

  async updateTokenUsage(
    id: string,
    inputTokens: number,
    outputTokens: number,
    costMicros: number = 0,
    cacheReadInputTokens: number = 0,
    cacheWriteInputTokens: number = 0
  ): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({
        totalInputTokens: sql`${agentSessionsTable.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${agentSessionsTable.totalOutputTokens} + ${outputTokens}`,
        totalCacheReadInputTokens: sql`${agentSessionsTable.totalCacheReadInputTokens} + ${cacheReadInputTokens}`,
        totalCacheWriteInputTokens: sql`${agentSessionsTable.totalCacheWriteInputTokens} + ${cacheWriteInputTokens}`,
        totalCostMicros: sql`${agentSessionsTable.totalCostMicros} + ${costMicros}`,
        updatedAt: new Date()
      })
      .where(eq(agentSessionsTable.id, id))
  }

  async findAllSessions(
    limit: number = 20,
    offset: number = 0,
    assistantId?: string,
    searchQuery?: string,
    vaultId?: string | null
  ): Promise<AgentSessionRow[]> {
    const normalizedVaultId = vaultId?.trim() ? resolveInsertVaultId(vaultId.trim()) : undefined
    // 公开列表缺 vaultId → fail-closed（等价 1=0），禁止静默扫全表
    if (!normalizedVaultId) {
      console.warn('[SessionRepo] findAllSessions refused: vaultId is required (fail-closed)')
      return []
    }

    return this.querySessions({
      limit,
      offset,
      assistantId,
      searchQuery,
      vaultId: normalizedVaultId
    })
  }

  /**
   * 显式跨仓全表扫描（仅同步 / 迁移 / flush 缺盘补写使用）。
   * 日常列表请用 findAllSessions(..., vaultId)。
   */
  async findAllSessionsAcrossVaults(
    limit: number = 20,
    offset: number = 0,
    assistantId?: string,
    searchQuery?: string
  ): Promise<AgentSessionRow[]> {
    return this.querySessions({
      limit,
      offset,
      assistantId,
      searchQuery,
      vaultId: null
    })
  }

  private async querySessions(params: {
    limit: number
    offset: number
    assistantId?: string
    searchQuery?: string
    vaultId: string | null
  }): Promise<AgentSessionRow[]> {
    const { limit, offset, assistantId, searchQuery, vaultId } = params
    let matchedSessionIds: string[] = []

    if (searchQuery && searchQuery.trim()) {
      matchedSessionIds = await this.findSessionIdsMatchingMessageContent(
        searchQuery,
        vaultId,
        assistantId
      )
    }

    let q = this.db.select().from(agentSessionsTable)

    // 组合过滤条件
    const conditions: any[] = []

    if (vaultId) {
      conditions.push(eq(agentSessionsTable.vaultId, vaultId))
    }

    const normalizedAssistantId = assistantId?.trim()
    if (normalizedAssistantId) {
      if (
        normalizedAssistantId === SYSTEM_LATTE_ASSISTANT_ID ||
        normalizedAssistantId === DEFAULT_LATTE_ASSISTANT_ID
      ) {
        conditions.push(
          inArray(agentSessionsTable.assistantId, [
            SYSTEM_LATTE_ASSISTANT_ID,
            DEFAULT_LATTE_ASSISTANT_ID
          ])
        )
      } else {
        conditions.push(eq(agentSessionsTable.assistantId, normalizedAssistantId))
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const titlePattern = `%${searchQuery.replace(/[%_\\]/g, '\\$&')}%`
      const titleCond = sql`${agentSessionsTable.title} LIKE ${titlePattern} ESCAPE '\\'`

      if (matchedSessionIds.length > 0) {
        conditions.push(or(titleCond, inArray(agentSessionsTable.id, matchedSessionIds)))
      } else {
        conditions.push(titleCond)
      }
    }

    if (conditions.length > 0) {
      if (conditions.length === 1) {
        q = q.where(conditions[0]!) as any
      } else {
        q = q.where(and(...conditions)) as any
      }
    }

    let finalQuery: any = q.orderBy(
      desc(agentSessionsTable.isPinned),
      desc(agentSessionsTable.updatedAt),
      desc(agentSessionsTable.id)
    )

    if (limit > 0) {
      finalQuery = finalQuery.limit(limit).offset(offset)
    }

    const results: AgentSessionRow[] = (
      (await finalQuery) as InferSelectModel<typeof agentSessionsTable>[]
    ).map((row) => withMountedNotebookIds(row))

    if (vaultId !== null && results.length > 0 && (limit > 0 || results.length <= 200)) {
      await this.enrichSessionsWithSnippets(results, searchQuery)
    }

    return results
  }

  /**
   * 为当前页会话批量填充消息预览（snippet）：
   * - 无搜索词：取该会话最新一条非推理文本消息预览；
   * - 有搜索词：取命中关键词的消息片段；若命中的并非最新消息（如复制出来的对话分支命中了分叉前的共同历史），
   *   自动拼接「命中片段 · 最新: 最新消息预览」，从而在搜索结果中直接区分原会话与各个分支。
   */
  private async enrichSessionsWithSnippets(
    sessions: AgentSessionRow[],
    searchQuery?: string
  ): Promise<void> {
    if (sessions.length === 0 || typeof (this.db as any).all !== 'function') return

    const sessionIds = sessions.map((s) => s.id).filter(Boolean)
    if (sessionIds.length === 0) return

    const idListSql = sql.join(
      sessionIds.map((id) => sql`${id}`),
      sql`, `
    )
    const trimmedQuery = searchQuery?.trim() || ''

    type SnippetRow = {
      sessionId?: string
      messageId?: string
      orderIndex?: number
      text?: string
    }

    const latestBySession = new Map<string, { messageId: string; text: string }>()
    const matchedBySession = new Map<string, { messageId: string; text: string }>()

    try {
      await this.ensureSessionQueryIndexes()

      const latestRows = (await this.db.all(sql`
        WITH latest_msg AS (
          SELECT session_id, MAX(order_index) AS max_order
          FROM agent_messages
          WHERE session_id IN (${idListSql})
            AND role IN ('user', 'assistant')
          GROUP BY session_id
        )
        SELECT
          m.session_id as sessionId,
          m.id as messageId,
          m.order_index as orderIndex,
          json_extract(p.data, '$.text') as text
        FROM latest_msg lm
        INNER JOIN agent_messages m
          ON m.session_id = lm.session_id AND m.order_index = lm.max_order
        INNER JOIN agent_parts p
          ON p.message_id = m.id
        WHERE p.type = 'text'
          AND (
            json_extract(p.data, '$.isReasoning') IS NULL
            OR json_extract(p.data, '$.isReasoning') = 0
            OR json_extract(p.data, '$.isReasoning') = false
            OR json_extract(p.data, '$.isReasoning') = 'false'
          )
          AND LENGTH(TRIM(COALESCE(json_extract(p.data, '$.text'), ''))) > 0
        ORDER BY m.order_index DESC, p.created_at DESC
      `)) as SnippetRow[]

      for (const row of latestRows ?? []) {
        if (!row?.sessionId || !row.text || latestBySession.has(row.sessionId)) continue
        latestBySession.set(row.sessionId, {
          messageId: String(row.messageId ?? ''),
          text: String(row.text)
        })
      }

      const missingIds = sessionIds.filter((id) => !latestBySession.has(id))
      if (missingIds.length > 0) {
        const missingSql = sql.join(
          missingIds.map((id) => sql`${id}`),
          sql`, `
        )
        const fallbackRows = (await this.db.all(sql`
          SELECT
            m.session_id as sessionId,
            m.id as messageId,
            m.order_index as orderIndex,
            json_extract(p.data, '$.text') as text
          FROM agent_messages m
          INNER JOIN agent_parts p ON p.message_id = m.id
          WHERE m.session_id IN (${missingSql})
            AND m.role IN ('user', 'assistant')
            AND p.type = 'text'
            AND (
              json_extract(p.data, '$.isReasoning') IS NULL
              OR json_extract(p.data, '$.isReasoning') = 0
              OR json_extract(p.data, '$.isReasoning') = false
              OR json_extract(p.data, '$.isReasoning') = 'false'
            )
            AND LENGTH(TRIM(COALESCE(json_extract(p.data, '$.text'), ''))) > 0
          ORDER BY m.order_index DESC, p.created_at DESC
        `)) as SnippetRow[]

        for (const row of fallbackRows ?? []) {
          if (!row?.sessionId || !row.text || latestBySession.has(row.sessionId)) continue
          latestBySession.set(row.sessionId, {
            messageId: String(row.messageId ?? ''),
            text: String(row.text)
          })
        }
      }

      if (trimmedQuery) {
        const pattern = `%${trimmedQuery.replace(/[%_\\]/g, '\\$&')}%`
        const matchedRows = (await this.db.all(sql`
          SELECT
            m.session_id as sessionId,
            m.id as messageId,
            m.order_index as orderIndex,
            json_extract(p.data, '$.text') as text
          FROM agent_messages m
          INNER JOIN agent_parts p ON p.message_id = m.id
          WHERE m.session_id IN (${idListSql})
            AND p.type = 'text'
            AND (
              json_extract(p.data, '$.isReasoning') IS NULL
              OR json_extract(p.data, '$.isReasoning') = 0
              OR json_extract(p.data, '$.isReasoning') = false
              OR json_extract(p.data, '$.isReasoning') = 'false'
            )
            AND json_extract(p.data, '$.text') LIKE ${pattern} ESCAPE '\\'
          ORDER BY m.order_index DESC, p.created_at DESC
        `)) as SnippetRow[]

        for (const row of matchedRows ?? []) {
          if (!row?.sessionId || !row.text || matchedBySession.has(row.sessionId)) continue
          matchedBySession.set(row.sessionId, {
            messageId: String(row.messageId ?? ''),
            text: String(row.text)
          })
        }
      }
    } catch (e) {
      console.warn('[SessionRepo] enrichSessionsWithSnippets failed:', e)
      return
    }

    for (const session of sessions) {
      const latest = latestBySession.get(session.id)
      const matched = trimmedQuery ? matchedBySession.get(session.id) : undefined

      if (matched) {
        const matchedPreview = extractAroundSearchKeyword(matched.text, trimmedQuery, 30)
        if (latest && latest.messageId !== matched.messageId) {
          const latestPreview = collapsePreviewWhitespace(latest.text, 24)
          if (latestPreview && latestPreview !== matchedPreview) {
            session.snippet = `${matchedPreview} · 最新: ${latestPreview}`
            continue
          }
        }
        session.snippet = extractAroundSearchKeyword(matched.text, trimmedQuery, 48)
      } else if (latest) {
        session.snippet = collapsePreviewWhitespace(latest.text, 48)
      }
    }
  }

  /**
   * 先走消息全文索引，再用正文 LIKE 补漏。
   * 有工作空间 / 伙伴时先收窄会话范围，避免每次搜索扫全库 parts。
   */
  private async findSessionIdsMatchingMessageContent(
    searchQuery: string,
    vaultId: string | null,
    assistantId?: string
  ): Promise<string[]> {
    const cleaned = searchQuery.replace(/"/g, ' ').trim()
    const pattern = `%${searchQuery.replace(/[%_\\]/g, '\\$&')}%`
    const sessionIdsSet = new Set<string>()
    const normalizedAssistantId = assistantId?.trim()
    const isLatteAssistant =
      normalizedAssistantId === SYSTEM_LATTE_ASSISTANT_ID ||
      normalizedAssistantId === DEFAULT_LATTE_ASSISTANT_ID
    const tasks: Promise<void>[] = []

    if (cleaned) {
      tasks.push(
        (async () => {
          try {
            const ftsRows = await this.db.all(sql`
              SELECT DISTINCT f.session_id as sessionId
              FROM agent_messages_fts f
              INNER JOIN agent_sessions s ON s.id = f.session_id
              WHERE agent_messages_fts MATCH ${`"${cleaned}"`}
                ${vaultId ? sql`AND s.vault_id = ${vaultId}` : sql``}
                ${
                  isLatteAssistant
                    ? sql`AND s.assistant_id IN (${SYSTEM_LATTE_ASSISTANT_ID}, ${DEFAULT_LATTE_ASSISTANT_ID})`
                    : normalizedAssistantId
                      ? sql`AND s.assistant_id = ${normalizedAssistantId}`
                      : sql``
                }
            `)
            for (const row of ftsRows) {
              const id = (row as { sessionId?: string }).sessionId
              if (id) sessionIdsSet.add(id)
            }
          } catch (e) {
            console.warn('[SessionRepo] FTS search failed:', e)
          }
        })()
      )
    }

    tasks.push(
      (async () => {
        try {
          await this.ensureSessionQueryIndexes()
          const scope = [
            eq(partsTbl.type, 'text'),
            sql`json_extract(${partsTbl.data}, '$.text') LIKE ${pattern} ESCAPE '\\'`,
            or(
              sql`json_extract(${partsTbl.data}, '$.isReasoning') IS NULL`,
              sql`json_extract(${partsTbl.data}, '$.isReasoning') = 0`,
              sql`json_extract(${partsTbl.data}, '$.isReasoning') = false`,
              sql`json_extract(${partsTbl.data}, '$.isReasoning') = 'false'`
            )
          ]
          if (vaultId) scope.push(eq(agentSessionsTable.vaultId, vaultId))
          if (normalizedAssistantId) {
            if (isLatteAssistant) {
              scope.push(
                inArray(agentSessionsTable.assistantId, [
                  SYSTEM_LATTE_ASSISTANT_ID,
                  DEFAULT_LATTE_ASSISTANT_ID
                ])
              )
            } else {
              scope.push(eq(agentSessionsTable.assistantId, normalizedAssistantId))
            }
          }
          const selectFn =
            typeof (this.db as any).selectDistinct === 'function'
              ? this.db.selectDistinct.bind(this.db)
              : this.db.select.bind(this.db)
          const likeRows = await selectFn({ sessionId: partsTbl.sessionId })
            .from(partsTbl)
            .innerJoin(agentSessionsTable, eq(partsTbl.sessionId, agentSessionsTable.id))
            .where(and(...scope))
          for (const row of likeRows) {
            if (row.sessionId) sessionIdsSet.add(row.sessionId)
          }
        } catch (e) {
          console.error('[SessionRepo] LIKE message search failed:', e)
        }
      })()
    )

    await Promise.all(tasks)
    return Array.from(sessionIdsSet)
  }

  async updateSessionVaultId(sessionId: string, vaultId: string): Promise<void> {
    const normalized = resolveInsertVaultId(vaultId)
    await this.db
      .update(agentSessionsTable)
      .set({ vaultId: normalized, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  async updateSessionDialogueModel(
    sessionId: string,
    providerId: string,
    modelId: string
  ): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ providerId, modelId, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  async deleteSessions(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { inArray } = await import('drizzle-orm')
    if (usesSyncTransaction(this.db)) {
      await (this.db as any).transaction((tx: any) => {
        tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids)).run()
        tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids)).run()
        tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids)).run()
        tx.delete(compressionSnapshotsTable)
          .where(inArray(compressionSnapshotsTable.sessionId, ids))
          .run()
      })
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids))
        await tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids))
        await tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids))
        await tx
          .delete(compressionSnapshotsTable)
          .where(inArray(compressionSnapshotsTable.sessionId, ids))
      })
    }
  }

  async getSessionById(sessionId: string): Promise<any> {
    const docs = await this.db
      .select()
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.id, sessionId))
      .limit(1)
    const row = docs[0]
    return row ? withMountedNotebookIds(row) : null
  }

  async updateMountedNotebookIds(sessionId: string, notebookIds: string[]): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({
        mountedNotebookIds: serializeMountedNotebookIds(notebookIds),
        updatedAt: new Date()
      })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  /** 读取会话级 instruction 基线（JSON 字符串）；无记录返回 null */
  async getSessionInstructionState(sessionId: string): Promise<string | null> {
    const docs = await this.db
      .select({ instructionState: agentSessionsTable.instructionState })
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.id, sessionId))
      .limit(1)
    const raw = docs[0]?.instructionState
    return typeof raw === 'string' && raw.trim() ? raw : null
  }

  /** 写入会话级 instruction 基线（JSON 字符串）；传 null 清空 */
  async updateSessionInstructionState(sessionId: string, state: string | null): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ instructionState: state, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, id))
  }

  async updatePartsDataFallback(partIds: string[], fallbackData: any): Promise<void> {
    if (partIds.length === 0) return
    const { inArray } = await import('drizzle-orm')
    await this.db.update(partsTbl).set({ data: fallbackData }).where(inArray(partsTbl.id, partIds))
  }

  async updatePartsDataById(updates: Array<{ id: string; data: unknown }>): Promise<void> {
    if (updates.length === 0) return
    const { eq } = await import('drizzle-orm')

    if (usesSyncTransaction(this.db)) {
      await (this.db as any).transaction((tx: any) => {
        for (const update of updates) {
          tx.update(partsTbl).set({ data: update.data }).where(eq(partsTbl.id, update.id)).run()
        }
      })
      return
    }

    await this.db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(partsTbl).set({ data: update.data }).where(eq(partsTbl.id, update.id))
      }
    })
  }
}
