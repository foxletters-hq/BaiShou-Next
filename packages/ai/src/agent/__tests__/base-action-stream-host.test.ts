import { beforeEach, describe, expect, it, vi } from 'vitest'

const runStreamChat = vi.fn()

vi.mock('../agent-chat-core.service', () => ({
  AgentChatCoreService: {
    runStreamChat: (...args: unknown[]) => runStreamChat(...args),
    resetAbortController: vi.fn()
  }
}))

import { runStreamWithPersistence, type ActionDeps } from '../actions/base.action'

function baseDeps(overrides: Partial<ActionDeps> = {}): ActionDeps {
  return {
    emitter: { sendFinish: vi.fn() } as unknown as ActionDeps['emitter'],
    sessionId: 's1',
    realSessionRepo: {},
    realSnapshotRepo: {},
    toolRegistry: {},
    diarySearcher: {},
    webSearchResultFetcher: vi.fn(),
    fetchSearchPage: vi.fn(),
    ...overrides
  }
}

const config = { provider: {}, modelId: 'm', systemModels: null, userConfig: {}, userText: 'hi' }

describe('runStreamWithPersistence stream host', () => {
  beforeEach(() => {
    runStreamChat.mockReset()
    runStreamChat.mockResolvedValue({ aborted: false })
  })

  it('should forward the host graph reader and memory source when regenerating', async () => {
    const graphReader = { recallRelations: vi.fn() }
    const rawDataSourceManager = {} as never
    const syncGraphPendingIndex = vi.fn()
    const notebookIds = ['nb-1']

    await runStreamWithPersistence(
      baseDeps({
        streamHost: {
          graphReader,
          rawDataSourceManager,
          syncGraphPendingIndex,
          workspace: { folderRoot: '', sessionKind: 'companion', notebookIds }
        }
      }),
      config
    )

    const params = runStreamChat.mock.calls[0]![0]
    expect(params.graphReader).toBe(graphReader)
    expect(params.rawDataSourceManager).toBe(rawDataSourceManager)
    expect(params.syncGraphPendingIndex).toBe(syncGraphPendingIndex)
    expect(params.workspace.notebookIds).toEqual(notebookIds)
  })

  it('should keep the per-call session and text when the host is spread first', async () => {
    await runStreamWithPersistence(baseDeps({ streamHost: {} }), {
      ...config,
      userText: 'again',
      userMessageId: 'u1'
    })

    const params = runStreamChat.mock.calls[0]![0]
    expect(params.sessionId).toBe('s1')
    expect(params.userText).toBe('again')
    expect(params.userMessageId).toBe('u1')
  })

  it('should leave the graph reader empty when the host omits it', async () => {
    await runStreamWithPersistence(baseDeps(), config)

    expect(runStreamChat.mock.calls[0]![0].graphReader).toBeUndefined()
  })
})
