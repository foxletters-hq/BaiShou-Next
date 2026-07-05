import { describe, it, expect } from 'vitest'
import { buildToolCallRepairHandler } from '../agent/tool-call-repair.util'

describe('buildToolCallRepairHandler', () => {
  const tools = {
    diary_read: { execute: async () => 'ok' },
    diary_search: { execute: async () => 'ok' }
  }

  it('returns null for empty tool names', async () => {
    const repair = buildToolCallRepairHandler()
    const result = await repair({
      toolCall: { toolCallId: '1', toolName: '', input: '{}' },
      tools
    })
    expect(result).toBeNull()
  })

  it('returns null when the tool name already matches', async () => {
    const repair = buildToolCallRepairHandler()
    const result = await repair({
      toolCall: { toolCallId: '1', toolName: 'diary_read', input: '{}' },
      tools
    })
    expect(result).toBeNull()
  })

  it('repairs case-insensitive tool names', async () => {
    const repair = buildToolCallRepairHandler()
    const result = await repair({
      toolCall: { toolCallId: '1', toolName: 'Diary_Read', input: '{}' },
      tools
    })
    expect(result).toEqual({
      toolCallId: '1',
      toolName: 'diary_read',
      input: '{}'
    })
  })

  it('returns null for unknown tool names', async () => {
    const repair = buildToolCallRepairHandler()
    const result = await repair({
      toolCall: { toolCallId: '1', toolName: 'not_a_real_tool', input: '{}' },
      tools
    })
    expect(result).toBeNull()
  })
})
