import { describe, it, expect, vi } from 'vitest'
import type { IFileSystem } from '../../../fs/file-system.types'
import {
  buildDeepSeekImportedSessionId,
  importDeepSeekSessions,
  scanDeepSeekExtractedArchive,
  type DeepSeekImportDeps
} from '../index'

function createMemoryFs(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial))
  const normalize = (p: string) => p.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  const dirEntries = (dirPath: string): string[] => {
    const prefix = `${normalize(dirPath)}/`
    const names = new Set<string>()
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        const first = key.slice(prefix.length).split('/')[0]
        if (first) names.add(first)
      }
    }
    return [...names]
  }

  const fs: IFileSystem = {
    async exists(p) {
      const n = normalize(p)
      return store.has(n) || dirEntries(n).length > 0
    },
    async mkdir() {},
    async readFile(p) {
      const val = store.get(normalize(p))
      if (val === undefined) throw new Error(`ENOENT: ${p}`)
      return val
    },
    async writeFile(p, data) {
      store.set(normalize(p), data)
    },
    async copyFile(src, dest) {
      const val = store.get(normalize(src))
      if (val === undefined) throw new Error(`ENOENT: ${src}`)
      store.set(normalize(dest), val)
    },
    async unlink(p) {
      store.delete(normalize(p))
    },
    async readdir(p) {
      return dirEntries(p)
    },
    async stat(p) {
      const n = normalize(p)
      if (store.has(n)) return { isFile: true, isDirectory: false, size: store.get(n)!.length }
      if (dirEntries(n).length > 0) return { isFile: false, isDirectory: true }
      throw new Error(`ENOENT: ${p}`)
    },
    async rename(a, b) {
      const v = store.get(normalize(a))
      if (v !== undefined) {
        store.set(normalize(b), v)
        store.delete(normalize(a))
      }
    },
    async rm() {},
    async appendFile(p, data) {
      const n = normalize(p)
      store.set(n, (store.get(n) ?? '') + data)
    }
  }
  return { fs, store }
}

function buildSampleArchiveFiles(): Record<string, string> {
  return {
    '/extract/manifest.json': JSON.stringify({ export_format_version: 3 }),
    '/extract/chat_session_index.json': JSON.stringify([
      {
        id: 'sess-1',
        title: 'First Chat',
        pinned: false,
        message_count: 2,
        inserted_at: '2025-06-09T04:48:46.765Z',
        updated_at: '2025-06-09T04:48:55.010Z'
      },
      {
        id: 'sess-2',
        title: 'Second Chat',
        pinned: false,
        message_count: 2,
        inserted_at: '2025-04-20T17:15:13.215Z',
        updated_at: '2025-04-20T17:34:09.800Z'
      }
    ]),
    '/extract/chat_sessions/sess-1.json': JSON.stringify({
      id: 'sess-1',
      title: 'First Chat',
      pinned: false,
      current_message_id: 2,
      inserted_at: '2025-06-09T04:48:46.765Z',
      updated_at: '2025-06-09T04:48:55.010Z',
      messages: [
        {
          id: 1,
          parent_id: null,
          role: 'USER',
          status: 'FINISHED',
          inserted_at: '2025-06-09T04:48:47.468Z',
          fragments: [
            { type: 'REQUEST', content: 'Check image' },
            {
              type: 'FILE',
              files: [
                {
                  id: 'img-1',
                  file_name: 'pic.png',
                  file_size: 128,
                  is_image: true,
                  export_path: 'chat_sessions/sess-1_files/img-1_pic.png'
                }
              ]
            }
          ]
        },
        {
          id: 2,
          parent_id: 1,
          role: 'ASSISTANT',
          status: 'FINISHED',
          inserted_at: '2025-06-09T04:48:50.000Z',
          fragments: [{ type: 'RESPONSE', content: 'Looks good!' }]
        }
      ]
    }),
    '/extract/chat_sessions/sess-1_files/img-1_pic.png': 'FAKE_PNG_BYTES',
    '/extract/chat_sessions/sess-2.json': JSON.stringify({
      id: 'sess-2',
      title: 'Second Chat',
      pinned: false,
      current_message_id: 2,
      inserted_at: '2025-04-20T17:15:13.215Z',
      updated_at: '2025-04-20T17:34:09.800Z',
      messages: [
        {
          id: 1,
          parent_id: null,
          role: 'USER',
          status: 'FINISHED',
          inserted_at: '2025-04-20T17:15:14.000Z',
          fragments: [{ type: 'REQUEST', content: 'Hello' }]
        },
        {
          id: 2,
          parent_id: 1,
          role: 'ASSISTANT',
          status: 'FINISHED',
          inserted_at: '2025-04-20T17:15:16.000Z',
          fragments: [{ type: 'RESPONSE', content: 'Hi there' }]
        }
      ]
    })
  }
}

describe('importDeepSeekSessions', () => {
  it('should import into existing assistant, copy images, flush to disk, and deduplicate on re-import', async () => {
    const { fs, store } = createMemoryFs(buildSampleArchiveFiles())
    const scanResult = await scanDeepSeekExtractedArchive(fs, '/extract')

    const existingSessionId = buildDeepSeekImportedSessionId('ast-existing', 'sess-2')
    const upsertAggregate = vi.fn(async () => {})
    const flushSessionToDisk = vi.fn(async () => {})
    const deps: DeepSeekImportDeps = {
      fileSystem: fs,
      sessionRepo: {
        upsertAggregate,
        findAllSessions: vi.fn(async () => [{ id: existingSessionId }])
      },
      sessionManager: {
        flushSessionToDisk
      },
      assistantManager: {
        create: vi.fn(async () => {})
      }
    }

    const result = await importDeepSeekSessions(deps, {
      scanResult,
      target: { mode: 'existing', assistantId: 'ast-existing', assistantName: 'Latte' },
      vaultId: 'vault-1',
      vaultName: 'Personal',
      attachmentsBaseDir: '/vault/Attachments'
    })

    expect(result.createdNewAssistant).toBe(false)
    expect(result.assistantId).toBe('ast-existing')
    expect(result.importedSessions).toBe(1)
    expect(result.skippedSessions).toBe(1)
    expect(result.importedMessages).toBe(2)
    expect(result.importedAttachments).toBe(1)
    expect(result.failedSessions).toBe(0)
    expect(upsertAggregate).toHaveBeenCalledTimes(1)
    expect(flushSessionToDisk).toHaveBeenCalledWith(
      buildDeepSeekImportedSessionId('ast-existing', 'sess-1'),
      'Personal'
    )

    const copiedKey = [...store.keys()].find((k) =>
      k.startsWith(
        `/vault/Attachments/${buildDeepSeekImportedSessionId('ast-existing', 'sess-1')}/`
      )
    )
    expect(copiedKey).toBeDefined()
    expect(store.get(copiedKey!)).toBe('FAKE_PNG_BYTES')
  })

  it('should create a new assistant and bind all selected sessions to it', async () => {
    const { fs } = createMemoryFs(buildSampleArchiveFiles())
    const scanResult = await scanDeepSeekExtractedArchive(fs, '/extract')

    const createdAssistants: Array<Record<string, unknown>> = []
    const upsertedAggregates: Array<{ session: { assistantId: string } }> = []
    const deps: DeepSeekImportDeps = {
      fileSystem: fs,
      sessionRepo: {
        upsertAggregate: vi.fn(async (agg) => {
          upsertedAggregates.push(agg)
        }),
        findAllSessions: vi.fn(async () => [])
      },
      sessionManager: {
        flushSessionToDisk: vi.fn(async () => {})
      },
      assistantManager: {
        create: vi.fn(async (input) => {
          createdAssistants.push(input)
        })
      }
    }

    const result = await importDeepSeekSessions(deps, {
      scanResult,
      selectedSessionIds: ['sess-1'],
      target: {
        mode: 'new',
        name: 'DeepSeek 伙伴',
        description: '从 DeepSeek 导入',
        systemPrompt: '你是一位严谨的技术助手',
        assistantKind: 'work',
        providerId: 'deepseek',
        modelId: 'deepseek-chat'
      },
      vaultId: 'vault-1',
      vaultName: 'Personal'
    })

    expect(result.createdNewAssistant).toBe(true)
    expect(result.assistantName).toBe('DeepSeek 伙伴')
    expect(createdAssistants).toHaveLength(1)
    expect(createdAssistants[0]).toMatchObject({
      name: 'DeepSeek 伙伴',
      systemPrompt: '你是一位严谨的技术助手',
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
      assistantKind: 'work'
    })
    expect(result.importedSessions).toBe(1)
    expect(upsertedAggregates[0]!.session.assistantId).toBe(result.assistantId)
  })

  it('should not create assistant when selected sessions list is empty or name is blank', async () => {
    const { fs } = createMemoryFs(buildSampleArchiveFiles())
    const scanResult = await scanDeepSeekExtractedArchive(fs, '/extract')
    const createAssistant = vi.fn(async () => {})
    const deps: DeepSeekImportDeps = {
      fileSystem: fs,
      sessionRepo: { upsertAggregate: vi.fn(async () => {}) },
      sessionManager: { flushSessionToDisk: vi.fn(async () => {}) },
      assistantManager: { create: createAssistant }
    }

    await expect(
      importDeepSeekSessions(deps, {
        scanResult,
        selectedSessionIds: [],
        target: { mode: 'new', name: 'DeepSeek' },
        vaultId: 'vault-1',
        vaultName: 'Personal'
      })
    ).rejects.toMatchObject({ code: 'EMPTY_ARCHIVE' })

    await expect(
      importDeepSeekSessions(deps, {
        scanResult,
        target: { mode: 'new', name: '   ' },
        vaultId: 'vault-1',
        vaultName: 'Personal'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TARGET' })

    expect(createAssistant).not.toHaveBeenCalled()
  })

  it('should continue importing remaining sessions when one session fails to persist', async () => {
    const { fs } = createMemoryFs(buildSampleArchiveFiles())
    const scanResult = await scanDeepSeekExtractedArchive(fs, '/extract')

    let callCount = 0
    const deps: DeepSeekImportDeps = {
      fileSystem: fs,
      sessionRepo: {
        upsertAggregate: vi.fn(async () => {
          callCount += 1
          if (callCount === 1) throw new Error('SQLITE_BUSY')
        }),
        findAllSessions: vi.fn(async () => [])
      },
      sessionManager: {
        flushSessionToDisk: vi.fn(async () => {})
      },
      assistantManager: {
        create: vi.fn(async () => {})
      }
    }

    const result = await importDeepSeekSessions(deps, {
      scanResult,
      target: { mode: 'existing', assistantId: 'ast-1', assistantName: 'A' },
      vaultId: 'vault-1',
      vaultName: 'Personal'
    })

    expect(result.failedSessions).toBe(1)
    expect(result.importedSessions).toBe(1)
    expect(result.failureSamples).toHaveLength(1)
    expect(result.failureSamples[0]).toContain('SQLITE_BUSY')
  })
})
