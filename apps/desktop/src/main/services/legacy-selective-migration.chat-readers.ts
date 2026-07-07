import {
  readLegacySqlite,
  type LegacyMessageRow,
  type LegacyPartRow
} from './legacy-selective-migration.helpers'

export function normalizeMessageRole(role: string): 'system' | 'user' | 'assistant' | 'tool' {
  return (['system', 'user', 'assistant', 'tool'].includes(role) ? role : 'user') as
    | 'system'
    | 'user'
    | 'assistant'
    | 'tool'
}

export function normalizePartType(type: string): 'text' | 'tool' | 'stepFinish' | 'compaction' {
  if (type === 'tool' || type === 'stepFinish' || type === 'compaction') return type
  return 'text'
}

export function readMessagesForSession(agentDbs: string[], sessionId: string): LegacyMessageRow[] {
  const messages: LegacyMessageRow[] = []
  const seen = new Set<string>()
  for (const dbPath of agentDbs) {
    for (const row of readLegacySqlite<LegacyMessageRow>(
      dbPath,
      'SELECT id, session_id, role, order_index, is_summary, ask_id, provider_id, model_id, input_tokens, output_tokens, cost_micros FROM agent_messages WHERE session_id = ? ORDER BY order_index ASC',
      sessionId
    )) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      messages.push(row)
    }
  }
  return messages.sort((a, b) => a.order_index - b.order_index)
}

export function readPartsForMessage(agentDbs: string[], messageId: string): LegacyPartRow[] {
  const parts: LegacyPartRow[] = []
  const seen = new Set<string>()
  for (const dbPath of agentDbs) {
    for (const row of readLegacySqlite<LegacyPartRow>(
      dbPath,
      'SELECT id, message_id, session_id, type, data FROM agent_parts WHERE message_id = ?',
      messageId
    )) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      parts.push(row)
    }
  }
  return parts
}
