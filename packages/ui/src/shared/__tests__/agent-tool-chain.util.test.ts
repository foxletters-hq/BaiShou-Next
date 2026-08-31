import { describe, expect, it } from 'vitest'
import { buildAgentToolChainItems } from '../agent-tool-chain/agent-tool-chain.util'
import { isToolResultError } from '../tool-result.util'

describe('buildAgentToolChainItems', () => {
  it('merges streaming completed tools with duration and result', () => {
    const items = buildAgentToolChainItems({
      completedTools: [
        {
          name: 'url_read',
          durationMs: 820,
          toolCallId: 'call-1',
          result: '# Title\n\nBody'
        }
      ]
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.durationMs).toBe(820)
    expect(items[0]?.hasContent).toBe(true)
    expect(items[0]?.invocation?.toolCallId).toBe('call-1')
  })

  it('deduplicates completed tools and invocations by toolCallId', () => {
    const items = buildAgentToolChainItems({
      completedTools: [
        {
          name: 'web_search',
          durationMs: 500,
          toolCallId: 'call-1'
        }
      ],
      invocations: [
        {
          toolCallId: 'call-1',
          toolName: 'web_search',
          result: 'search text'
        }
      ]
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.durationMs).toBe(500)
    expect(items[0]?.invocation?.result).toBe('search text')
  })

  it('appends active loading tool after completed tools', () => {
    const items = buildAgentToolChainItems({
      completedTools: [{ name: 'url_read', durationMs: 120 }],
      activeToolName: 'web_search',
      activeToolArgs: { query: 'docs' }
    })

    expect(items.map((item) => item.status)).toEqual(['success', 'loading'])
    expect(items[1]?.invocation?.args).toEqual({ query: 'docs' })
  })

  it('marks completed tools with error as error status', () => {
    const items = buildAgentToolChainItems({
      completedTools: [
        {
          name: 'workspace_read',
          durationMs: 10,
          error: 'not found',
          args: { path: 'missing.md' }
        }
      ]
    })

    expect(items[0]?.status).toBe('error')
    expect(items[0]?.hasContent).toBe(true)
  })
})

describe('isToolResultError', () => {
  it('does not treat webpage text containing "failed" as an error', () => {
    expect(
      isToolResultError({
        toolName: 'url_read',
        result: 'The project failed to launch after many attempts.'
      })
    ).toBe(false)
  })

  it('detects object error payloads', () => {
    expect(
      isToolResultError({
        toolName: 'web_search',
        result: { error: 'network down' }
      })
    ).toBe(true)
  })

  it('detects Tool execution failed without a colon', () => {
    expect(
      isToolResultError({
        toolName: 'skill_write',
        result: 'Tool execution failed'
      })
    ).toBe(true)
  })
})
