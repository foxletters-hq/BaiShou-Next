import { describe, it, expect } from 'vitest'
import { StreamAccumulator } from '../agent/stream-accumulator'

describe('StreamAccumulator tool-call filtering', () => {
  it('ignores tool-call events with empty tool names', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'tool-call',
      toolCallId: 'call_empty',
      toolName: '',
      input: {}
    } as any)
    expect(acc.toolCalls).toHaveLength(0)
  })

  it('does not store tool-result without a matching tool-call', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'tool-result',
      toolCallId: 'orphan',
      toolName: '',
      output: 'Error: Tool "" does not exist'
    } as any)
    expect(acc.toolResults).toHaveLength(0)
  })

  it('stores tool-result when a matching tool-call exists', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'tool-call',
      toolCallId: 'call_1',
      toolName: 'diary_read',
      input: { dates: ['2026-01-01'] }
    } as any)
    acc.add({
      type: 'tool-result',
      toolCallId: 'call_1',
      toolName: 'diary_read',
      output: 'ok'
    } as any)
    expect(acc.toolCalls).toHaveLength(1)
    expect(acc.toolResults).toHaveLength(1)
  })
})
