import { eq } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'

export class SessionAggregateSync {
  private static writeMutex: Promise<void> = Promise.resolve()

  constructor(private readonly db: AppDatabase) {}

  async getSessionAggregate(sessionId: string): Promise<any | null> {
    const sessionDoc = await this.db
      .select()
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.id, sessionId))
      .limit(1)
    if (!sessionDoc.length) return null
    const session = sessionDoc[0]

    const messages = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.sessionId, sessionId))
    messages.sort((a, b) => a.orderIndex - b.orderIndex)

    const parts = await this.db.select().from(partsTbl).where(eq(partsTbl.sessionId, sessionId))

    const enrichedMessages = messages.map((m) => ({
      ...m,
      parts: parts.filter((p) => p.messageId === m.id)
    }))

    return { session, messages: enrichedMessages }
  }

  async upsertAggregate(aggregate: any): Promise<void> {
    const unlock = await this._acquireMutex()
    try {
      await this._upsertAggregateInternal(aggregate)
    } finally {
      unlock()
    }
  }

  private _toDate(ts: any): Date {
    if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts
    const n = Number(ts)
    if (!isNaN(n)) {
      return new Date(n < 1e12 ? n * 1000 : n)
    }
    const d = new Date(ts)
    return isNaN(d.getTime()) ? new Date() : d
  }

  private _acquireMutex(): Promise<() => void> {
    let release: () => void
    const newMutex = new Promise<void>((resolve) => {
      release = resolve
    })
    const oldMutex = SessionAggregateSync.writeMutex
    SessionAggregateSync.writeMutex = oldMutex.then(() => newMutex)
    return oldMutex.then(() => release!)
  }

  private async _upsertAggregateInternal(aggregate: any): Promise<void> {
    const { session, messages } = aggregate
    const rawClient = (this.db as any).session?.client || (this.db as any).$client

    const toUnixSec = (ts: any): number => {
      const d = this._toDate(ts)
      return Math.floor(d.getTime() / 1000)
    }

    const stmts: Array<{ sql: string; args?: any[] }> = []

    stmts.push({
      sql: 'DELETE FROM agent_sessions WHERE id = ?',
      args: [session.id]
    })

    stmts.push({
      sql: `INSERT INTO agent_sessions
              (id, title, vault_name, assistant_id, is_pinned, system_prompt,
               provider_id, model_id, total_input_tokens, total_output_tokens,
               total_cost_micros, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        session.id,
        session.title ?? null,
        session.vaultName ?? null,
        session.assistantId ?? null,
        session.isPinned ? 1 : 0,
        session.systemPrompt ?? null,
        session.providerId ?? null,
        session.modelId ?? null,
        session.totalInputTokens ?? null,
        session.totalOutputTokens ?? null,
        session.totalCostMicros ?? null,
        toUnixSec(session.createdAt),
        toUnixSec(session.updatedAt)
      ]
    })

    if (messages && messages.length > 0) {
      for (const m of messages) {
        stmts.push({
          sql: `INSERT OR IGNORE INTO agent_messages
                    (id, session_id, role, is_summary, order_index, created_at)
                    VALUES (?,?,?,?,?,?)`,
          args: [
            m.id,
            m.sessionId,
            m.role,
            m.isSummary ? 1 : 0,
            m.orderIndex,
            toUnixSec(m.createdAt)
          ]
        })

        if (m.parts && m.parts.length > 0) {
          for (const p of m.parts) {
            const dataStr = typeof p.data === 'string' ? p.data : JSON.stringify(p.data ?? null)
            stmts.push({
              sql: `INSERT OR IGNORE INTO agent_parts
                          (id, message_id, session_id, type, data, created_at)
                          VALUES (?,?,?,?,?,?)`,
              args: [p.id, p.messageId, p.sessionId, p.type, dataStr, toUnixSec(p.createdAt)]
            })
          }
        }
      }
    }

    if (rawClient && typeof rawClient.batch === 'function') {
      await rawClient.batch(stmts)
    } else if (rawClient) {
      const runTx = rawClient.transaction((statements: typeof stmts) => {
        for (const stmt of statements) {
          rawClient.prepare(stmt.sql).run(...(stmt.args || []))
        }
      })
      runTx(stmts)
    }
  }
}
