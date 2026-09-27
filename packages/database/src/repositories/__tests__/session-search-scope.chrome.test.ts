import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'session.repository.sessions.ts'),
  'utf8'
)

describe('session content search scope chrome', () => {
  it('should constrain FTS and LIKE message search to the current vault and assistant', () => {
    expect(src).toContain('findSessionIdsMatchingMessageContent')
    expect(src).toContain('INNER JOIN agent_sessions s ON s.id = f.session_id')
    expect(src).toContain('innerJoin(agentSessionsTable')
    expect(src).toContain('eq(agentSessionsTable.vaultId, vaultId)')
    expect(src).toContain('eq(agentSessionsTable.assistantId, normalizedAssistantId)')
  })
})
