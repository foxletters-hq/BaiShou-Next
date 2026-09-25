import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CompanionAskStreamSession,
  clearCompanionAskStreamSessionsForTests,
  parseCompanionAskStreamArgs,
  peekCompanionAskInflight,
  registerCompanionAskStreamSession,
  shouldKeepCompanionAskAfterStream,
  startCompanionAskFromStreamInput,
  waitCompanionAskInflight
} from '../companion-ask-stream.util'

afterEach(() => {
  clearCompanionAskStreamSessionsForTests()
})

describe('parseCompanionAskStreamArgs', () => {
  it('should return null when the argument JSON is still incomplete', () => {
    expect(parseCompanionAskStreamArgs('{"question":"你在哪')).toBeNull()
    expect(parseCompanionAskStreamArgs('')).toBeNull()
    expect(parseCompanionAskStreamArgs('{}')).toBeNull()
  })

  it('should return the question once the object has closed', () => {
    expect(parseCompanionAskStreamArgs('{"question":"你在哪个城市？","options":["北京","上海"]}')).toEqual(
      {
        question: '你在哪个城市？',
        options: ['北京', '上海']
      }
    )
  })

  it('should return null when options are not a string list', () => {
    expect(parseCompanionAskStreamArgs('{"question":"你在哪？","options":"北京"}')).toBeNull()
  })
})

describe('CompanionAskStreamSession', () => {
  it('should run once when split deltas become a complete question', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    const session = new CompanionAskStreamSession(run)

    session.pushDelta('c1', '{"question":"你在哪个城市？","options":["北京"')
    expect(run).not.toHaveBeenCalled()

    session.pushDelta('c1', ',"上海"]}')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({
      question: '你在哪个城市？',
      options: ['北京', '上海']
    })

    session.pushDelta('c1', '')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('should reuse the in-flight ask when execute arrives later', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    const session = new CompanionAskStreamSession(run)

    session.pushDelta('c1', '{"question":"继续吗？"}')
    const again = session.claim('c1', { question: '继续吗？' })

    expect(run).toHaveBeenCalledTimes(1)
    await expect(again).resolves.toBe('ok')
  })

  it('should reuse the in-flight ask when a later execute uses another call id', async () => {
    const run = vi.fn().mockResolvedValue('ok')
    const session = new CompanionAskStreamSession(run)

    session.pushDelta('c1', '{"question":"继续吗？"}')
    const again = session.claim('c2', { question: '继续吗？' })

    expect(run).toHaveBeenCalledTimes(1)
    await expect(again).resolves.toBe('ok')
  })
})

describe('startCompanionAskFromStreamInput', () => {
  it('should execute companion_ask once the streamed input already has a question', () => {
    const execute = vi.fn().mockResolvedValue('ok')
    startCompanionAskFromStreamInput(
      { companion_ask: { execute } },
      {
        toolName: 'companion_ask',
        toolCallId: 'c1',
        input: { question: '你在哪个城市？', options: ['北京', '上海'] }
      }
    )
    expect(execute).toHaveBeenCalledWith(
      { question: '你在哪个城市？', options: ['北京', '上海'] },
      { toolCallId: 'c1' }
    )
  })

  it('should ignore a tool-start that still has empty arguments', () => {
    const execute = vi.fn()
    startCompanionAskFromStreamInput(
      { companion_ask: { execute } },
      { toolName: 'companion_ask', toolCallId: 'c1', input: {} }
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it('should claim the registered session even when execute is missing', () => {
    const run = vi.fn().mockResolvedValue('ok')
    registerCompanionAskStreamSession('sess_1', new CompanionAskStreamSession(run))
    startCompanionAskFromStreamInput(
      { companion_ask: {} },
      {
        toolName: 'companion_ask',
        toolCallId: 'c1',
        input: { question: '你在哪个城市？' }
      },
      'sess_1'
    )
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith({ question: '你在哪个城市？' })
    expect(peekCompanionAskInflight('sess_1')).toBeDefined()
  })
})

describe('shouldKeepCompanionAskAfterStream', () => {
  it('should keep the session gate when companion_ask is still pending', () => {
    expect(shouldKeepCompanionAskAfterStream([{ action: 'workspace_write' }])).toBe(false)
    expect(shouldKeepCompanionAskAfterStream([{ action: 'companion_ask' }])).toBe(true)
  })
})

describe('waitCompanionAskInflight', () => {
  it('should wait until the registered ask settles', async () => {
    let release = () => {}
    const held = new Promise<string>((resolve) => {
      release = () => resolve('ok')
    })
    registerCompanionAskStreamSession(
      'sess_1',
      new CompanionAskStreamSession(() => held)
    )
    startCompanionAskFromStreamInput(
      { companion_ask: {} },
      { toolName: 'companion_ask', toolCallId: 'c1', input: { question: '继续吗？' } },
      'sess_1'
    )
    let settled = false
    const waiting = waitCompanionAskInflight('sess_1').then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    release()
    await waiting
    expect(settled).toBe(true)
  })
})
