import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSharedSessionInbox,
  MemorySessionInboxStore,
  onAgentSessionRuntime,
  resetAgentSessionRuntimeForTests,
  resetSharedSessionInboxForTests,
  setSessionInboxStore
} from '@baishou/ai'
import {
  drainSessionInbox,
  resetSessionInboxDrainForTests
} from '../session-inbox-drain'

describe('drainSessionInbox', () => {
  beforeEach(() => {
    resetSessionInboxDrainForTests()
    resetSharedSessionInboxForTests()
    resetAgentSessionRuntimeForTests()
    setSessionInboxStore(new MemorySessionInboxStore())
  })

  it('promotes steer before queue and runs all pending when idle', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'q1', delivery: 'queue' })
    inbox.admit({ sessionId: 's1', text: 'steer', delivery: 'steer' })
    inbox.admit({ sessionId: 's1', text: 'q2', delivery: 'queue' })

    const ran: string[] = []
    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      runPromoted: async (input) => {
        ran.push(input.text)
      }
    })

    expect(ran).toEqual(['steer', 'q1', 'q2'])
    expect(inbox.listPending('s1')).toHaveLength(0)
  })

  it('emits promoted then idle when drain completes', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'only', delivery: 'queue' })

    const types: string[] = []
    const off = onAgentSessionRuntime((e) => {
      types.push(e.type)
    })

    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      runPromoted: async () => 'ok'
    })
    off()

    expect(types).toEqual(['session.promoted', 'session.idle'])
  })

  it('does not start when busy; keeps pending', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'queued', delivery: 'queue' })

    const runPromoted = vi.fn()
    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => true,
      runPromoted
    })

    expect(runPromoted).not.toHaveBeenCalled()
    expect(inbox.listPending('s1')).toHaveLength(1)
  })

  it('stops on aborted and leaves remaining pending', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'a', delivery: 'queue' })
    inbox.admit({ sessionId: 's1', text: 'b', delivery: 'queue' })
    inbox.admit({ sessionId: 's1', text: 'c', delivery: 'queue' })

    const ran: string[] = []
    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      runPromoted: async (input) => {
        ran.push(input.text)
        if (input.text === 'a') return 'aborted'
        return 'ok'
      }
    })

    expect(ran).toEqual(['a'])
    expect(inbox.listPending('s1').map((r) => r.text)).toEqual(['b', 'c'])
  })

  it('respects shouldDrain=false before promote', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'x', delivery: 'queue' })

    const runPromoted = vi.fn()
    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      shouldDrain: () => false,
      runPromoted
    })

    expect(runPromoted).not.toHaveBeenCalled()
    expect(inbox.listPending('s1')).toHaveLength(1)
  })

  it('prevents reentrant drain while first drain holds the lock', async () => {
    const inbox = getSharedSessionInbox()
    inbox.admit({ sessionId: 's1', text: 'one', delivery: 'queue' })
    inbox.admit({ sessionId: 's1', text: 'two', delivery: 'queue' })

    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const ran: string[] = []

    const first = drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      runPromoted: async (input) => {
        ran.push(input.text)
        if (input.text === 'one') await gate
        return 'ok'
      }
    })

    // 等第一条已进入 runPromoted
    await vi.waitFor(() => {
      expect(ran).toEqual(['one'])
    })

    const nestedRun = vi.fn()
    await drainSessionInbox({
      sessionId: 's1',
      isBusy: () => false,
      runPromoted: nestedRun
    })
    expect(nestedRun).not.toHaveBeenCalled()

    release()
    await first
    expect(ran).toEqual(['one', 'two'])
  })

  it('emits idle immediately when no pending', async () => {
    const types: string[] = []
    const off = onAgentSessionRuntime((e) => {
      types.push(e.type)
    })

    await drainSessionInbox({
      sessionId: 'empty',
      isBusy: () => false,
      runPromoted: async () => 'ok'
    })
    off()

    expect(types).toEqual(['session.idle'])
  })
})
