import { describe, it, expect, vi } from 'vitest'
import {
  importLegacyChatsFromRows,
  importLegacyWorkspaceSection
} from '../legacy-version-migration.importer'
import { createDeps } from './legacy-version-migration.importer.test-helpers'

describe('legacy-version-migration.importer chats', () => {
  it('streams legacy sqlite messages by session instead of reading the whole workspace', async () => {
    const executedSql: string[] = []
    const writtenFiles = new Map<string, string>()
    const upsertSessionAggregate = vi.fn(async () => {})
    const flushSessionToDisk = vi.fn(async () => {})
    const createAssistant = vi.fn(async () => {})

    const deps = createDeps({
      fileSystem: {
        exists: async (p: string) =>
          String(p) === '/legacy/Personal/.baishou/agent.sqlite' || writtenFiles.has(String(p)),
        readdir: async () => [],
        stat: async (p: string) => ({
          isFile: String(p).endsWith('agent.sqlite'),
          isDirectory: false,
          size: 1024 * 1024
        }),
        mkdir: async () => {},
        writeFile: async (p: string, data: string) => {
          writtenFiles.set(String(p), data)
        },
        appendFile: async (p: string, data: string) => {
          writtenFiles.set(String(p), `${writtenFiles.get(String(p)) ?? ''}${data}`)
        },
        unlink: async (p: string) => {
          writtenFiles.delete(String(p))
        },
        rename: async (oldPath: string, newPath: string) => {
          const data = writtenFiles.get(String(oldPath))
          if (data != null) {
            writtenFiles.set(String(newPath), data)
            writtenFiles.delete(String(oldPath))
          }
        }
      } as never,
      assistantManager: {
        findAll: async () => [],
        create: createAssistant
      } as never,
      sessionManager: { flushSessionToDisk } as never,
      upsertSessionAggregate,
      getSessionsBaseDirectory: async () => '/target/Personal/Sessions',
      existingAssistantNames: async () => new Set(),
      existingSessionIds: async () => new Set(),
      resolveTargetVaultName: async () => 'Personal',
      vaultService: {
        getAllVaults: () => [],
        vaultExists: () => true,
        createVault: async () => {},
        switchVault: async () => {}
      } as never,
      executeRawSql: async (_client, statement, args = []) => {
        executedSql.push(statement)
        if (statement.includes('agent_assistants')) {
          return { rows: [{ id: 'legacy-assistant', name: '旧伙伴' }] }
        }
        if (statement.includes('agent_sessions ORDER BY id')) {
          return {
            rows:
              Number(args[1] ?? 0) === 0
                ? [
                    {
                      id: 'legacy-session',
                      title: '旧会话',
                      assistant_id: 'legacy-assistant',
                      provider_id: 'gemini',
                      model_id: 'gemini-3'
                    }
                  ]
                : []
          }
        }
        if (statement.includes("table_info('agent_messages')")) {
          return { rows: [{ name: 'order_index' }] }
        }
        if (statement.includes("table_info('agent_parts')")) {
          return { rows: [{ name: 'order_index' }] }
        }
        if (statement.includes('FROM legacy_chat_') && statement.includes('agent_messages')) {
          return {
            rows:
              Number(args[2] ?? 0) === 0
                ? [
                    {
                      id: 'legacy-message',
                      session_id: 'legacy-session',
                      role: 'user',
                      order_index: 0
                    }
                  ]
                : []
          }
        }
        if (statement.includes('FROM legacy_chat_') && statement.includes('agent_parts')) {
          return {
            rows:
              Number(args[2] ?? 0) === 0
                ? [
                    {
                      id: 'legacy-part',
                      message_id: 'legacy-message',
                      session_id: 'legacy-session',
                      type: 'text',
                      data: '{"text":"历史消息"}'
                    }
                  ]
                : []
          }
        }
        return { rows: [] }
      }
    })

    const result = await importLegacyWorkspaceSection(deps, 'Personal')

    expect(result.failed).toBe(0)
    expect(createAssistant).toHaveBeenCalled()
    expect(upsertSessionAggregate).not.toHaveBeenCalled()
    expect(flushSessionToDisk).not.toHaveBeenCalled()
    const sessionJson = writtenFiles.get('/target/Personal/Sessions/legacy-session.json')
    expect(sessionJson).toContain('"id":"legacy-message"')
    expect(sessionJson).toContain('"text":"历史消息"')
    expect(executedSql.some((sql) => sql.includes('WHERE session_id IN'))).toBe(false)
    expect(executedSql.some((sql) => sql.includes('WHERE message_id IN'))).toBe(false)
    expect(
      executedSql.some(
        (sql) =>
          sql.includes('WHERE session_id = ?') &&
          sql.includes('LIMIT ? OFFSET ?') &&
          sql.includes('agent_messages')
      )
    ).toBe(true)
  })

  it('attaches legacy agent db once when importing multiple sessions from the same source', async () => {
    const executedSql: string[] = []
    const writtenFiles = new Map<string, string>()
    const createAssistant = vi.fn(async () => {})

    const deps = createDeps({
      fileSystem: {
        exists: async (p: string) =>
          String(p) === '/legacy/Personal/.baishou/agent.sqlite' || writtenFiles.has(String(p)),
        readdir: async () => [],
        stat: async (p: string) => ({
          isFile: String(p).endsWith('agent.sqlite'),
          isDirectory: false,
          size: 1024 * 1024
        }),
        mkdir: async () => {},
        writeFile: async (p: string, data: string) => {
          writtenFiles.set(String(p), data)
        },
        appendFile: async (p: string, data: string) => {
          writtenFiles.set(String(p), `${writtenFiles.get(String(p)) ?? ''}${data}`)
        },
        unlink: async (p: string) => {
          writtenFiles.delete(String(p))
        },
        rename: async (oldPath: string, newPath: string) => {
          const data = writtenFiles.get(String(oldPath))
          if (data != null) {
            writtenFiles.set(String(newPath), data)
            writtenFiles.delete(String(oldPath))
          }
        }
      } as never,
      assistantManager: {
        findAll: async () => [],
        create: createAssistant
      } as never,
      sessionManager: { flushSessionToDisk: vi.fn(async () => {}) } as never,
      upsertSessionAggregate: vi.fn(async () => {}),
      getSessionsBaseDirectory: async () => '/target/Personal/Sessions',
      existingAssistantNames: async () => new Set(),
      existingSessionIds: async () => new Set(),
      resolveTargetVaultName: async () => 'Personal',
      vaultService: {
        getAllVaults: () => [],
        vaultExists: () => true,
        createVault: async () => {},
        switchVault: async () => {}
      } as never,
      executeRawSql: async (_client, statement, args = []) => {
        executedSql.push(statement)
        if (statement.includes('agent_assistants')) {
          return { rows: [{ id: 'legacy-assistant', name: '旧伙伴' }] }
        }
        if (statement.includes('agent_sessions ORDER BY id')) {
          return {
            rows:
              Number(args[1] ?? 0) === 0
                ? [
                    {
                      id: 'legacy-session-a',
                      title: '会话 A',
                      assistant_id: 'legacy-assistant',
                      provider_id: 'gemini',
                      model_id: 'gemini-3'
                    },
                    {
                      id: 'legacy-session-b',
                      title: '会话 B',
                      assistant_id: 'legacy-assistant',
                      provider_id: 'gemini',
                      model_id: 'gemini-3'
                    }
                  ]
                : []
          }
        }
        if (statement.includes("table_info('agent_messages')")) {
          return { rows: [{ name: 'order_index' }] }
        }
        if (statement.includes("table_info('agent_parts')")) {
          return { rows: [{ name: 'order_index' }] }
        }
        if (statement.includes('FROM legacy_chat_') && statement.includes('agent_messages')) {
          const sessionId = String(args[0] ?? '')
          return {
            rows:
              Number(args[2] ?? 0) === 0
                ? [
                    {
                      id: `${sessionId}-message`,
                      session_id: sessionId,
                      role: 'user',
                      order_index: 0
                    }
                  ]
                : []
          }
        }
        if (statement.includes('FROM legacy_chat_') && statement.includes('agent_parts')) {
          const messageId = String(args[0] ?? '')
          return {
            rows:
              Number(args[2] ?? 0) === 0
                ? [
                    {
                      id: `${messageId}-part`,
                      message_id: messageId,
                      session_id: messageId.replace(/-message$/, ''),
                      type: 'text',
                      data: '{"text":"历史消息"}'
                    }
                  ]
                : []
          }
        }
        return { rows: [] }
      }
    })

    const result = await importLegacyWorkspaceSection(deps, 'Personal')

    expect(result.failed).toBe(0)
    const chatAttachCount = executedSql.filter(
      (sql) => sql.includes('ATTACH DATABASE') && sql.includes('AS legacy_chat_')
    ).length
    expect(chatAttachCount).toBe(1)
    expect(writtenFiles.has('/target/Personal/Sessions/legacy-session-a.json')).toBe(true)
    expect(writtenFiles.has('/target/Personal/Sessions/legacy-session-b.json')).toBe(true)
    expect(result.imported).toBeGreaterThanOrEqual(2)
  })

  it('imports legacy sessions with empty assistant_id using the fallback assistant', async () => {
    const upsertSessionAggregate = vi.fn(async () => {})
    const flushSessionToDisk = vi.fn(async () => {})
    const deps = createDeps({
      upsertSessionAggregate,
      sessionManager: { flushSessionToDisk } as never,
      existingSessionIds: async () => new Set(),
      resolveTargetVaultName: async () => 'Personal'
    })

    const result = await importLegacyChatsFromRows(
      deps,
      {
        sessions: [
          {
            id: 'legacy-session',
            title: '旧会话',
            assistant_id: null,
            provider_id: 'gemini',
            model_id: 'gemini-3'
          }
        ],
        messages: [],
        parts: [],
        errors: []
      },
      { legacy_assistant: 'new-assistant' },
      'Personal'
    )

    expect(result.imported).toBe(1)
    expect(upsertSessionAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ assistantId: 'new-assistant' })
      })
    )
    expect(flushSessionToDisk).toHaveBeenCalledWith('legacy-session')
  })

  it('preserves legacy message ids and normalizes v3 text parts', async () => {
    const upsertSessionAggregate = vi.fn(async () => {})
    const deps = createDeps({
      upsertSessionAggregate,
      sessionManager: { flushSessionToDisk: vi.fn(async () => {}) } as never,
      existingSessionIds: async () => new Set(),
      resolveTargetVaultName: async () => 'Personal'
    })

    await importLegacyChatsFromRows(
      deps,
      {
        sessions: [
          {
            id: 'legacy-session',
            title: '旧会话',
            assistant_id: 'legacy-assistant',
            provider_id: 'gemini',
            model_id: 'gemini-3'
          }
        ],
        messages: [
          { id: 'legacy-msg-1', session_id: 'legacy-session', role: 'user', order_index: 0 }
        ],
        parts: [
          {
            id: 'legacy-part-1',
            message_id: 'legacy-msg-1',
            session_id: 'legacy-session',
            type: 'text',
            data: '{"text":"历史消息"}'
          }
        ],
        errors: []
      },
      { 'legacy-assistant': 'new-assistant' },
      'Personal'
    )

    expect(upsertSessionAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            id: 'legacy-msg-1',
            parts: [
              expect.objectContaining({
                id: 'legacy-part-1',
                messageId: 'legacy-msg-1',
                data: { text: '历史消息' }
              })
            ]
          })
        ]
      })
    )
  })
})
