import {
  describe,
  it,
  expect,
  beforeEach
} from 'vitest'
import {
  ContextEpoch,
  MemoryContextEpochStore,
  SessionInbox,
  MemorySessionInboxStore,
  clampMaxSteps,
  createDoomLoopTracker,
  needsProviderTurnContinuation,
  resolveSessionRuntimeProfile,
  prepareSystemPromptWithEpoch
} from '../index'
import {
  resetContextEpochStoreForTests,
  setContextEpochStore
} from '../context-epoch/store'
import { resetSharedContextEpochForTests } from '../context-epoch/context-epoch'
import { resetSharedSessionInboxForTests, setSessionInboxStore } from '../inbox/inbox'

describe('session-runtime context epoch', () => {
  beforeEach(() => {
    resetContextEpochStoreForTests()
    setContextEpochStore(new MemoryContextEpochStore())
    resetSharedContextEpochForTests()
  })

  it('keeps baseline stable and emits updates when workspace env changes', () => {
    const epoch = new ContextEpoch()
    const full1 = [
      '<assistant_persona>',
      'You are helpful.',
      '</assistant_persona>',
      '',
      '<runtime_context>',
      'time-a',
      '</runtime_context>',
      '',
      '<workspace_env>',
      'cwd=/a',
      '</workspace_env>'
    ].join('\n')

    const first = epoch.prepare({
      sessionId: 's1',
      fullSystemPrompt: full1,
      sourceContents: {
        'runtime/time': 'time-a',
        'workspace/env': 'cwd=/a'
      }
    })
    expect(first.isNewEpoch).toBe(true)
    expect(first.baseline).toContain('You are helpful.')

    const second = epoch.prepare({
      sessionId: 's1',
      fullSystemPrompt: full1.replace('cwd=/a', 'cwd=/b').replace('time-a', 'time-b'),
      sourceContents: {
        'runtime/time': 'time-b',
        'workspace/env': 'cwd=/b'
      }
    })
    expect(second.isNewEpoch).toBe(false)
    expect(second.updates.map((u) => u.sourceId).sort()).toEqual([
      'runtime/time',
      'workspace/env'
    ])
    expect(second.baseline).toBe(first.baseline)
  })

  it('replace clears sources and bumps baselineSeq', () => {
    const epoch = new ContextEpoch()
    epoch.prepare({
      sessionId: 's2',
      fullSystemPrompt: '<assistant_persona>\nP\n</assistant_persona>',
      sourceContents: { 'runtime/time': 't' }
    })
    const replaced = epoch.replace('s2', 'new-baseline')
    expect(replaced.baselineSeq).toBe(1)
    expect(replaced.baseline).toBe('new-baseline')
    expect(Object.keys(replaced.sources)).toHaveLength(0)
  })

  it('replace empty baseline then prepare rebuilds from full system', () => {
    const epoch = new ContextEpoch()
    const full = [
      '<assistant_persona>',
      'Stable persona.',
      '</assistant_persona>',
      '',
      '<runtime_context>',
      'time-old',
      '</runtime_context>',
      '',
      '<workspace_env>',
      'cwd=/old',
      '</workspace_env>'
    ].join('\n')

    epoch.prepare({
      sessionId: 's3',
      fullSystemPrompt: full,
      sourceContents: {
        'runtime/time': 'time-old',
        'workspace/env': 'cwd=/old'
      }
    })

    // 压缩成功后 replace('')：清空 sources、bump seq；下次 prepare 因 baseline 空走 strip(full)
    const replaced = epoch.replace('s3', '')
    expect(replaced.baselineSeq).toBe(1)
    expect(replaced.baseline).toBe('')
    expect(Object.keys(replaced.sources)).toHaveLength(0)

    const nextFull = full.replace('time-old', 'time-new').replace('cwd=/old', 'cwd=/new')
    const prepared = epoch.prepare({
      sessionId: 's3',
      fullSystemPrompt: nextFull,
      sourceContents: {
        'runtime/time': 'time-new',
        'workspace/env': 'cwd=/new'
      }
    })
    expect(prepared.isNewEpoch).toBe(false)
    expect(prepared.baselineSeq).toBe(1)
    expect(prepared.baseline).toContain('Stable persona.')
    expect(prepared.baseline).not.toContain('time-new')
    expect(prepared.baseline).not.toContain('cwd=/new')
    expect(prepared.systemPrompt).toContain('Stable persona.')
    expect(prepared.systemPrompt).toContain('time-new')
    expect(prepared.systemPrompt).toContain('cwd=/new')
  })

  it('reuses composed systemPrompt when full fingerprint and sources unchanged', () => {
    const epoch = new ContextEpoch()
    const full = [
      '<assistant_persona>',
      'You are helpful.',
      '</assistant_persona>',
      '',
      '<runtime_context>',
      'time-a',
      '</runtime_context>',
      '',
      '<workspace_env>',
      'cwd=/a',
      '</workspace_env>'
    ].join('\n')

    const first = epoch.prepare({
      sessionId: 's-cache',
      fullSystemPrompt: full,
      sourceContents: {
        'runtime/time': 'time-a',
        'workspace/env': 'cwd=/a'
      }
    })
    expect(first.isNewEpoch).toBe(true)

    const second = epoch.prepare({
      sessionId: 's-cache',
      fullSystemPrompt: full,
      sourceContents: {
        'runtime/time': 'time-a',
        'workspace/env': 'cwd=/a'
      }
    })
    expect(second.isNewEpoch).toBe(false)
    expect(second.updates).toEqual([])
    expect(second.systemPrompt).toBe(first.systemPrompt)
    expect(second.baselineSeq).toBe(first.baselineSeq)

    const peeked = epoch.peekUnchangedPrepare('s-cache', full)
    expect(peeked?.systemPrompt).toBe(first.systemPrompt)
    expect(peeked?.updates).toEqual([])
  })

  it('skips compose when updates empty but full prompt fingerprint differs', () => {
    const epoch = new ContextEpoch()
    const full1 = [
      '<assistant_persona>',
      'You are helpful.',
      '</assistant_persona>',
      '',
      '<runtime_context>',
      'time-a',
      '</runtime_context>'
    ].join('\n')
    const first = epoch.prepare({
      sessionId: 's-reuse',
      fullSystemPrompt: full1,
      sourceContents: { 'runtime/time': 'time-a' }
    })

    // 非易变段微调：sources 指纹不变 → updates 空 → 复用 composed
    const full2 = full1.replace('You are helpful.', 'You are helpful!')
    const second = epoch.prepare({
      sessionId: 's-reuse',
      fullSystemPrompt: full2,
      sourceContents: { 'runtime/time': 'time-a' }
    })
    expect(second.updates).toEqual([])
    expect(second.systemPrompt).toBe(first.systemPrompt)
  })

  it('prepareSystemPromptWithEpoch returns cached without re-extract on same full', () => {
    const full = [
      '<assistant_persona>',
      'P',
      '</assistant_persona>',
      '<runtime_context>',
      't1',
      '</runtime_context>'
    ].join('\n')
    const a = prepareSystemPromptWithEpoch({ sessionId: 's-prep', fullSystemPrompt: full })
    const b = prepareSystemPromptWithEpoch({ sessionId: 's-prep', fullSystemPrompt: full })
    expect(b.systemPrompt).toBe(a.systemPrompt)
    expect(b.updates).toEqual([])
    expect(b.isNewEpoch).toBe(false)
  })
})

describe('resolveSessionRuntimeProfile', () => {
  it('defaults workspace to v2 on and companion to v2 off', () => {
    expect(
      resolveSessionRuntimeProfile({ sessionKind: 'workspace' }).sessionRuntimeV2
    ).toBe(true)
    expect(
      resolveSessionRuntimeProfile({ sessionKind: 'companion' }).sessionRuntimeV2
    ).toBe(false)
    expect(resolveSessionRuntimeProfile({}).sessionRuntimeV2).toBe(false)
  })

  it('honors explicit false over workspace default and option true', () => {
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'workspace',
        userConfig: { sessionRuntimeV2: false }
      }).sessionRuntimeV2
    ).toBe(false)
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'workspace',
        userConfig: { 'sessionRuntime.v2': false },
        options: { sessionRuntimeV2: true }
      }).sessionRuntimeV2
    ).toBe(false)
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'workspace',
        options: { sessionRuntimeV2: false }
      }).sessionRuntimeV2
    ).toBe(false)
  })

  it('enables companion v2 when config or option is explicit true', () => {
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'companion',
        userConfig: { sessionRuntimeV2: true }
      }).sessionRuntimeV2
    ).toBe(true)
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'companion',
        options: { sessionRuntimeV2: true }
      }).sessionRuntimeV2
    ).toBe(true)
  })

  it('resolves interrupt from v2, workspace, or explicit true', () => {
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'companion',
        options: { sessionRuntimeV2: true }
      }).interruptOnGateReject
    ).toBe(true)
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'workspace',
        userConfig: { sessionRuntimeV2: false }
      }).interruptOnGateReject
    ).toBe(true)
    expect(
      resolveSessionRuntimeProfile({
        sessionKind: 'companion',
        userConfig: { interruptOnGateReject: true }
      }).interruptOnGateReject
    ).toBe(true)
    expect(
      resolveSessionRuntimeProfile({ sessionKind: 'companion' }).interruptOnGateReject
    ).toBe(false)
  })

  it('resolves maxSteps and doomLoopThreshold with clamps', () => {
    expect(
      resolveSessionRuntimeProfile({
        userConfig: { maxSteps: 7, doomLoopThreshold: 5 }
      })
    ).toMatchObject({ maxSteps: 7, doomLoopThreshold: 5 })
    expect(
      resolveSessionRuntimeProfile({
        userConfig: { maxSteps: 100, doomLoopThreshold: 1 },
        options: { maxSteps: 12, doomLoopThreshold: 9 }
      })
    ).toMatchObject({ maxSteps: 12, doomLoopThreshold: 9 })
    expect(resolveSessionRuntimeProfile({}).maxSteps).toBe(10)
    expect(resolveSessionRuntimeProfile({}).doomLoopThreshold).toBe(3)
  })
})

describe('session-runtime inbox', () => {
  beforeEach(() => {
    resetSharedSessionInboxForTests()
    setSessionInboxStore(new MemorySessionInboxStore())
  })

  it('promotes steer before queue and survives listPending', () => {
    const inbox = new SessionInbox()
    inbox.admit({ sessionId: 's', text: 'q1', delivery: 'queue' })
    inbox.admit({ sessionId: 's', text: 's1', delivery: 'steer' })
    inbox.admit({ sessionId: 's', text: 'q2', delivery: 'queue' })
    const first = inbox.promoteNext('s')
    expect(first?.text).toBe('s1')
    const second = inbox.promoteNext('s')
    expect(second?.text).toBe('q1')
    expect(inbox.listPending('s')).toHaveLength(1)
  })
})

describe('session-runtime guards', () => {
  it('clamps maxSteps', () => {
    expect(clampMaxSteps(0)).toBe(10)
    expect(clampMaxSteps(100)).toBe(50)
    expect(clampMaxSteps(7)).toBe(7)
  })

  it('trips doom-loop on repeated fingerprint', () => {
    const tracker = createDoomLoopTracker(3)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 1 }).count).toBe(2)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(true)
    expect(tracker.observe('t', { a: 1 }).count).toBe(4)
  })

  it('resets doom-loop fingerprint counter', () => {
    const tracker = createDoomLoopTracker(2)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(true)
    tracker.reset()
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(true)
  })

  it('does not trip doom-loop when fingerprint changes', () => {
    const tracker = createDoomLoopTracker(3)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 1 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 2 }).tripped).toBe(false)
    expect(tracker.observe('t', { a: 2 }).count).toBe(2)
  })

  it('needs continuation for tool-calls under maxSteps', () => {
    expect(
      needsProviderTurnContinuation({
        finishReason: 'tool-calls',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(true)
    expect(
      needsProviderTurnContinuation({
        finishReason: 'tool_calls',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(true)
  })

  it('continues only for unknown/empty finishReason when hadToolCalls', () => {
    expect(
      needsProviderTurnContinuation({
        finishReason: 'unknown',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(true)
    expect(
      needsProviderTurnContinuation({
        finishReason: '',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(true)
    expect(
      needsProviderTurnContinuation({
        finishReason: 'stop',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(false)
    expect(
      needsProviderTurnContinuation({
        finishReason: 'stop',
        hadToolCalls: false,
        turnIndex: 0,
        maxSteps: 10
      })
    ).toBe(false)
  })

  it('stops continuation when aborted, doom-loop, or maxSteps reached', () => {
    expect(
      needsProviderTurnContinuation({
        finishReason: 'tool-calls',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10,
        aborted: true
      })
    ).toBe(false)
    expect(
      needsProviderTurnContinuation({
        finishReason: 'tool-calls',
        hadToolCalls: true,
        turnIndex: 0,
        maxSteps: 10,
        doomLoopTripped: true
      })
    ).toBe(false)
    expect(
      needsProviderTurnContinuation({
        finishReason: 'tool-calls',
        hadToolCalls: true,
        turnIndex: 9,
        maxSteps: 10
      })
    ).toBe(false)
  })
})
