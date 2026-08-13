import { describe, expect, it, vi } from 'vitest'
import {
  buildWorkspaceEditResendModelText,
  runWorkspaceEditResendPipeline
} from '../run-workspace-edit-resend.pipeline'

describe('runWorkspaceEditResendPipeline', () => {
  function createSpies(overrides?: { isStreaming?: boolean; confirm?: boolean }) {
    const calls: string[] = []
    const stopChat = vi.fn(() => {
      calls.push('stop')
    })
    const rollbackRound = vi.fn(async () => {
      calls.push('rollback')
      return { restored: ['a.ts'], deleted: [], skipped: [] }
    })
    const prepareWorkspaceTurn = vi.fn(async (modelText: string) => {
      calls.push('prepare')
      return { sessionId: 's1', userMessageId: 'u-new', createdNew: false, modelText }
    })
    const admitAndStream = vi.fn(async () => {
      calls.push('admit')
    })
    const confirm = vi.fn(async () => {
      calls.push('confirm')
      return overrides?.confirm ?? true
    })

    return {
      calls,
      stopChat,
      rollbackRound,
      prepareWorkspaceTurn,
      admitAndStream,
      confirm,
      isStreaming: overrides?.isStreaming ?? false
    }
  }

  it('ED-01: order is confirm → stop → rollback → prepare → admit; prepare gets edited text; no double prepare', async () => {
    const spies = createSpies({ isStreaming: true })
    const modelText = 'edited body'

    const outcome = await runWorkspaceEditResendPipeline({
      confirm: spies.confirm,
      isStreaming: spies.isStreaming,
      stopChat: spies.stopChat,
      rollbackRound: spies.rollbackRound,
      prepareWorkspaceTurn: spies.prepareWorkspaceTurn,
      admitAndStream: spies.admitAndStream,
      modelText,
      providerId: 'prov-x',
      modelId: 'model-y',
      currentSessionId: 's1'
    })

    expect(outcome).toBe('completed')
    expect(spies.calls).toEqual(['confirm', 'stop', 'rollback', 'prepare', 'admit'])
    expect(spies.calls.filter((c) => c === 'prepare')).toHaveLength(1)
    expect(spies.prepareWorkspaceTurn).toHaveBeenCalledTimes(1)
    expect(spies.prepareWorkspaceTurn).toHaveBeenCalledWith(modelText)
    expect(spies.calls.indexOf('rollback')).toBeLessThan(spies.calls.indexOf('prepare'))
    expect(spies.calls.indexOf('prepare')).toBeLessThan(spies.calls.indexOf('admit'))
  })

  it('ED-cancel: confirm false → no rollback / prepare / admit', async () => {
    const spies = createSpies({ confirm: false, isStreaming: true })

    const outcome = await runWorkspaceEditResendPipeline({
      confirm: spies.confirm,
      isStreaming: spies.isStreaming,
      stopChat: spies.stopChat,
      rollbackRound: spies.rollbackRound,
      prepareWorkspaceTurn: spies.prepareWorkspaceTurn,
      admitAndStream: spies.admitAndStream,
      modelText: 'x',
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's1'
    })

    expect(outcome).toBe('cancelled')
    expect(spies.calls).toEqual(['confirm'])
    expect(spies.stopChat).not.toHaveBeenCalled()
    expect(spies.rollbackRound).not.toHaveBeenCalled()
    expect(spies.prepareWorkspaceTurn).not.toHaveBeenCalled()
    expect(spies.admitAndStream).not.toHaveBeenCalled()
  })

  it('ED-stream: isStreaming true → stopChat before rollbackRound', async () => {
    let streaming = true
    const order: string[] = []

    await runWorkspaceEditResendPipeline({
      confirm: async () => true,
      isStreaming: true,
      stopChat: () => {
        streaming = false
        order.push('stop')
      },
      rollbackRound: async () => {
        order.push(streaming ? 'rollback-while-streaming' : 'rollback-after-stop')
        return { restored: [], deleted: [], skipped: [] }
      },
      prepareWorkspaceTurn: async () => ({
        sessionId: 's1',
        userMessageId: 'u-new',
        createdNew: false
      }),
      admitAndStream: async () => {
        order.push('admit')
      },
      modelText: 'n',
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's1'
    })

    expect(streaming).toBe(false)
    expect(order).toEqual(['stop', 'rollback-after-stop', 'admit'])
  })

  it('ED-stream idle: isStreaming false → does not call stopChat', async () => {
    const spies = createSpies({ isStreaming: false })

    await runWorkspaceEditResendPipeline({
      confirm: spies.confirm,
      isStreaming: false,
      stopChat: spies.stopChat,
      rollbackRound: spies.rollbackRound,
      prepareWorkspaceTurn: spies.prepareWorkspaceTurn,
      admitAndStream: spies.admitAndStream,
      modelText: 'n',
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's1'
    })

    expect(spies.stopChat).not.toHaveBeenCalled()
    expect(spies.calls).toEqual(['confirm', 'rollback', 'prepare', 'admit'])
  })

  it('Model: admit gets current providerId/modelId and edited model text', async () => {
    const spies = createSpies()
    const modelText = buildWorkspaceEditResendModelText('plain edit', [
      { command: 'sum', content: 'SUM_SKILL' }
    ])

    await runWorkspaceEditResendPipeline({
      confirm: spies.confirm,
      isStreaming: false,
      stopChat: spies.stopChat,
      rollbackRound: spies.rollbackRound,
      prepareWorkspaceTurn: spies.prepareWorkspaceTurn,
      admitAndStream: spies.admitAndStream,
      modelText,
      providerId: 'openai-compatible',
      modelId: 'gpt-test',
      reasoningEffort: 'high',
      searchMode: true,
      currentSessionId: 's1'
    })

    expect(spies.admitAndStream).toHaveBeenCalledWith({
      sessionId: 's1',
      text: modelText,
      userMessageId: 'u-new',
      providerId: 'openai-compatible',
      modelId: 'gpt-test',
      reasoningEffort: 'high',
      searchMode: true
    })
  })

  it('skillRefs rebuild into model text for prepare', async () => {
    const modelText = buildWorkspaceEditResendModelText('user question', [
      { command: 'translate', content: 'You are a translator.' },
      { command: 'summarize', content: 'Summarize briefly.' }
    ])

    expect(modelText).toBe(
      ['You are a translator.', 'Summarize briefly.', 'user question'].join('\n\n')
    )

    const prepareWorkspaceTurn = vi.fn(async (text: string) => ({
      sessionId: 's1',
      userMessageId: 'u-new',
      createdNew: false,
      received: text
    }))

    await runWorkspaceEditResendPipeline({
      confirm: async () => true,
      isStreaming: false,
      stopChat: vi.fn(),
      rollbackRound: async () => ({ restored: [], deleted: [], skipped: [] }),
      prepareWorkspaceTurn,
      admitAndStream: async () => undefined,
      modelText,
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's1'
    })

    expect(prepareWorkspaceTurn).toHaveBeenCalledWith(modelText)
    expect(prepareWorkspaceTurn.mock.calls[0]?.[0]).toContain('You are a translator.')
    expect(prepareWorkspaceTurn.mock.calls[0]?.[0]).toContain('user question')
  })

  it('afterRollback runs between rollback and prepare', async () => {
    const calls: string[] = []
    await runWorkspaceEditResendPipeline({
      confirm: async () => true,
      isStreaming: false,
      stopChat: vi.fn(),
      rollbackRound: async () => {
        calls.push('rollback')
        return { restored: [], deleted: [], skipped: [] }
      },
      afterRollback: async () => {
        calls.push('afterRollback')
      },
      prepareWorkspaceTurn: async () => {
        calls.push('prepare')
        return { sessionId: 's1', userMessageId: 'u-new', createdNew: false }
      },
      admitAndStream: async () => {
        calls.push('admit')
      },
      modelText: 'x',
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's1'
    })

    expect(calls).toEqual(['rollback', 'afterRollback', 'prepare', 'admit'])
  })

  it('notifies onCreatedNewSession when prepare creates a different session', async () => {
    const onCreatedNewSession = vi.fn()
    await runWorkspaceEditResendPipeline({
      confirm: async () => true,
      isStreaming: false,
      stopChat: vi.fn(),
      rollbackRound: async () => ({ restored: [], deleted: [], skipped: [] }),
      prepareWorkspaceTurn: async () => ({
        sessionId: 's-new',
        userMessageId: 'u-new',
        createdNew: true
      }),
      admitAndStream: async () => undefined,
      modelText: 'x',
      providerId: 'p',
      modelId: 'm',
      currentSessionId: 's-old',
      onCreatedNewSession
    })

    expect(onCreatedNewSession).toHaveBeenCalledWith('s-new')
  })
})

describe('buildWorkspaceEditResendModelText', () => {
  it('returns trimmed plain when no skillRefs', () => {
    expect(buildWorkspaceEditResendModelText('  hello  ')).toBe('hello')
  })

  it('joins skill contents before plain with blank lines', () => {
    expect(
      buildWorkspaceEditResendModelText('ask', [
        { command: 'a', content: 'A' },
        { command: 'b', content: '  B  ' }
      ])
    ).toBe('A\n\nB\n\nask')
  })
})
