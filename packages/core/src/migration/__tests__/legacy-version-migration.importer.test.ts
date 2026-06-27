import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  importLegacyConfigSection,
  importLegacyArchivesForVault,
  importLegacyChatsFromRows,
  importLegacyDiariesForVault,
  importLegacyPersonasSection,
  importLegacyWorkspaceSection
} from '../legacy-version-migration.importer'
import type { LegacyVersionMigrationImporterDeps } from '../legacy-version-migration.importer'

function createDeps(
  overrides: Partial<LegacyVersionMigrationImporterDeps> = {}
): LegacyVersionMigrationImporterDeps {
  return {
    fileSystem: {} as never,
    sourceRoot: '/legacy',
    targetRoot: '/target',
    flutterPrefsConfig: null,
    flutterRawSp: {
      user_personas: JSON.stringify({
        旅行者: { 城市: '上海' }
      })
    },
    flutterDocumentsAvatarsDir: null,
    sqliteClient: {},
    executeRawSql: async () => ({ rows: [] }),
    settingsRepo: {} as never,
    profileRepo: {
      getProfile: async () => ({
        nickname: 'test',
        avatarPath: null,
        activePersonaId: 'default',
        personas: { default: { id: 'default', facts: {} } }
      }),
      saveProfile: vi.fn(async () => {})
    } as never,
    diaryService: {} as never,
    assistantManager: {} as never,
    sessionManager: {} as never,
    vaultService: {
      getAllVaults: () => [],
      vaultExists: () => false,
      createVault: async () => {},
      switchVault: async () => {}
    } as never,
    importAvatar: async () => 'avatars/x.png',
    saveUserAvatarPath: async () => {},
    existingAssistantNames: async () => new Set(),
    existingSessionIds: async () => new Set(),
    existingPersonaIds: async () => new Set(['旅行者']),
    upsertSessionAggregate: async () => {},
    runInVaultContext: async (_vaultName, fn) => fn(),
    resolveTargetVaultName: async (name) => name,
    ...overrides
  }
}

describe('legacy-version-migration.importer personas', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
  })

  it('appends two-digit suffix when persona id conflicts', async () => {
    const deps = createDeps()
    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    const ids = Object.keys(saved.personas)
    expect(ids.some((id) => /^旅行者\d{2}$/.test(id))).toBe(true)
  })

  it('imports user_personas from config when raw SP has no personas', async () => {
    const deps = createDeps({
      flutterRawSp: { user_nickname: 'Nick' },
      flutterPrefsConfig: {
        user_personas: JSON.stringify({ 工作: { 职业: '工程师' } })
      },
      existingPersonaIds: async () => new Set()
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.personas['工作']?.facts).toEqual({ 职业: '工程师' })
  })

  it('merges legacy facts into an existing same-name persona and restores active persona', async () => {
    const deps = createDeps({
      flutterRawSp: {
        user_active_persona_id: '默认身份',
        user_personas: JSON.stringify({
          默认身份: { 姓名: 'Anson', 职业: '全栈开发' }
        })
      },
      profileRepo: {
        getProfile: async () => ({
          nickname: 'test',
          avatarPath: null,
          activePersonaId: '默认身份',
          personas: { 默认身份: { id: '默认身份', facts: {} } }
        }),
        saveProfile: vi.fn(async () => {})
      } as never,
      existingPersonaIds: async () => new Set(['默认身份'])
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.activePersonaId).toBe('默认身份')
    expect(saved.personas['默认身份']?.facts).toEqual({ 姓名: 'Anson', 职业: '全栈开发' })
  })

  it('flushes settings to disk after saving imported personas', async () => {
    const flushSettingsToDisk = vi.fn(async () => {})
    const deps = createDeps({
      flushSettingsToDisk,
      existingPersonaIds: async () => new Set()
    })

    await importLegacyPersonasSection(deps)

    expect(flushSettingsToDisk).toHaveBeenCalledTimes(1)
  })

  it('merges identity_facts into active persona instead of creating a new card', async () => {
    const deps = createDeps({
      flutterRawSp: { user_nickname: 'Nick' },
      flutterPrefsConfig: {
        identity_facts: { name: 'Anson', role: 'dev' }
      },
      existingPersonaIds: async () => new Set()
    })

    const result = await importLegacyPersonasSection(deps)
    expect(result.imported).toBe(1)
    const saveProfile = deps.profileRepo.saveProfile as ReturnType<typeof vi.fn>
    const saved = saveProfile.mock.calls[0]?.[0]
    expect(saved.personas.default.facts).toEqual({ name: 'Anson', role: 'dev' })
    expect(saved.personas['默认身份']).toBeUndefined()
  })
})

describe('legacy-version-migration.importer config', () => {
  it('preserves existing cloud_sync_config when importing legacy config', async () => {
    const set = vi.fn(async () => {})
    const get = vi.fn(async (key: string) => {
      if (key === 'cloud_sync_config') return { target: 's3', s3Bucket: 'keep-me' }
      return undefined
    })
    const restoreSpy = vi.spyOn(
      await import('../../import/legacy-config-restore.shared'),
      'restoreLegacyDevicePreferences'
    )
    restoreSpy.mockResolvedValue(undefined)

    const deps = createDeps({
      flutterPrefsConfig: { sync_target: 1, webdav_url: 'https://legacy.example' },
      settingsRepo: { get, set } as never
    })

    const result = await importLegacyConfigSection(deps)
    expect(result.imported).toBe(1)
    expect(restoreSpy).toHaveBeenCalledWith(
      deps.settingsRepo,
      deps.profileRepo,
      deps.flutterPrefsConfig,
      { preserveCloudSync: true, skipProfileFields: true }
    )
    expect(set).not.toHaveBeenCalledWith(
      'cloud_sync_config',
      expect.objectContaining({ webdavUrl: 'https://legacy.example' })
    )
    restoreSpy.mockRestore()
  })
})

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

describe('legacy-version-migration.importer diaries', () => {
  it('imports a single legacy vault inside runInVaultContext', async () => {
    const vaultContexts: string[] = []
    const writeFile = vi.fn(async () => undefined)
    const mkdir = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (filePath: string) => {
          if (String(filePath).includes('/target/')) return false
          return true
        },
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async () => '---\ndate: 2024-01-15\n---\n\nbody',
        writeFile,
        mkdir,
        stat: async () => ({ isDirectory: false })
      } as never,
      getJournalsBaseDirectory: async () => '/target/Personal/Journals',
      runInVaultContext: async (vaultName, fn) => {
        vaultContexts.push(vaultName)
        return fn()
      }
    })

    const result = await importLegacyDiariesForVault(
      {
        ...deps,
        sourceRoot: '/legacy'
      },
      'Personal'
    )

    expect(vaultContexts).toEqual(['Personal'])
    expect(writeFile).toHaveBeenCalled()
    expect(result.imported).toBe(1)
  })

  it('skips diary when target file already matches legacy content', async () => {
    const raw = '---\ndate: 2024-01-15\n---\n\nbody'
    const writeFile = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async () => true,
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async (filePath: string) => {
          if (String(filePath).includes('/legacy/')) return raw
          return raw
        },
        writeFile,
        stat: async () => ({ isDirectory: false })
      } as never,
      getJournalsBaseDirectory: async () => '/target/Personal/Journals',
      readTargetJournalRaw: async () => raw,
      runInVaultContext: async (_vaultName, fn) => fn()
    })

    const result = await importLegacyDiariesForVault({ ...deps, sourceRoot: '/legacy' }, 'Personal')

    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes diaries into the mapped target vault when the original name conflicts', async () => {
    const writeFile = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (filePath: string) => {
          if (String(filePath).includes('/target/')) return false
          return true
        },
        readdir: async (dir: string) => {
          if (dir.endsWith('Journals')) return ['2024-01-15.md']
          return []
        },
        readFile: async () => '---\ndate: 2024-01-15\n---\n\nbody',
        writeFile,
        mkdir: vi.fn(async () => undefined),
        stat: async () => ({ isDirectory: false })
      } as never,
      resolveTargetVaultName: async () => 'Personal95',
      getJournalsBaseDirectory: async (targetVaultName) => `/target/${targetVaultName}/Journals`,
      readTargetJournalRaw: async (_dateStr, targetVaultName) => {
        expect(targetVaultName).toBe('Personal95')
        return null
      },
      runInVaultContext: async (_vaultName, fn) => fn()
    })

    const result = await importLegacyDiariesForVault({ ...deps, sourceRoot: '/legacy' }, 'Personal')

    expect(result.imported).toBe(1)
    expect(writeFile).toHaveBeenCalledWith(
      '/target/Personal95/Journals/2024/01/2024-01-15.md',
      expect.any(String),
      'utf8'
    )
  })
})

describe('legacy-version-migration.importer archives', () => {
  it('copies legacy Archives tree into target vault', async () => {
    const copyFile = vi.fn(async () => undefined)
    const mkdir = vi.fn(async () => undefined)
    const deps = createDeps({
      fileSystem: {
        exists: async (p: string) => String(p).includes('Archives'),
        readdir: async (dir: string) => {
          if (dir.endsWith('Archives')) return ['Weekly']
          if (dir.endsWith('Weekly')) return ['2024-01-01.md']
          return []
        },
        stat: async (p: string) => ({
          isDirectory: String(p).endsWith('Archives') || String(p).endsWith('Weekly')
        }),
        copyFile,
        mkdir
      } as never,
      targetRoot: '/target',
      resolveTargetVaultName: async () => 'Personal'
    })

    const result = await importLegacyArchivesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(copyFile).toHaveBeenCalled()
    expect(result.imported).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('returns empty result when legacy Archives is missing', async () => {
    const deps = createDeps({
      fileSystem: {
        exists: async () => false
      } as never
    })

    const result = await importLegacyArchivesForVault(
      { ...deps, sourceRoot: '/legacy' },
      'Personal'
    )

    expect(result).toEqual({ imported: 0, skipped: 0, failed: 0 })
  })
})
