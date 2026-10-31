import { sql } from 'drizzle-orm'

const indexedAgentDbs = new WeakSet<object>()

export async function ensureAgentSessionIndexes(db: unknown): Promise<void> {
  if (!db || typeof db !== 'object') return
  if (indexedAgentDbs.has(db)) return
  const runner = db as { run?: (q: unknown) => unknown }
  if (typeof runner.run !== 'function') return
  indexedAgentDbs.add(db)
  try {
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_agent_messages_session_order ON agent_messages(session_id, order_index DESC)`
    )
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_agent_parts_message_id ON agent_parts(message_id)`
    )
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_agent_parts_session_id ON agent_parts(session_id)`
    )
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_agent_parts_session_type ON agent_parts(session_id, type)`
    )
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_agent_sessions_vault_assistant_updated ON agent_sessions(vault_id, assistant_id, is_pinned DESC, updated_at DESC)`
    )
    await runner.run(
      sql`CREATE INDEX IF NOT EXISTS idx_compression_snapshots_session_id ON compression_snapshots(session_id, id DESC)`
    )
  } catch {
    // ignore if index creation is unsupported on mock db
  }
}

export interface InsertSessionInput {
  id: string
  title?: string
  vaultId: string
  assistantId?: string
  systemPrompt?: string
  mountedNotebookIds?: string[]
  providerId: string
  modelId: string
}

export interface InsertMessageInput {
  id: string
  sessionId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  isSummary?: boolean
  orderIndex: number
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
  providerId?: string
  modelId?: string
  createdAt?: Date | number | string
}

export interface InsertPartInput {
  id: string
  messageId: string
  sessionId: string
  type: string
  data: any
}
