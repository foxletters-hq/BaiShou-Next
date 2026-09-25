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

  it('should keep a persisted running companion_ask loading when the stream is no longer active', () => {
    const items = buildAgentToolChainItems({
      invocations: [
        {
          toolCallId: 'ask-1',
          toolName: 'companion_ask',
          state: 'partial-call',
          args: { question: '哪座城市？' }
        }
      ]
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('loading')
  })

  it('should keep a waiting companion_ask as a single loading row when activeToolName is also set', () => {
    const items = buildAgentToolChainItems({
      invocations: [
        {
          toolCallId: 'ask-1',
          toolName: 'companion_ask',
          args: { question: '继续吗？', options: ['是', '否'] }
        }
      ],
      activeToolName: 'companion_ask',
      isToolError: isToolResultError
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('loading')
    expect(items[0]?.key).toBe('ask-1')
    expect(items[0]?.hasContent).toBe(false)
  })

  it('should keep a running tool as a single loading row when it is both active and in invocations', () => {
    const items = buildAgentToolChainItems({
      invocations: [
        {
          toolCallId: 'search-1',
          toolName: 'web_search',
          args: { query: '天气' }
        }
      ],
      activeToolName: 'web_search',
      activeToolArgs: { query: '天气' }
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('loading')
    expect(items[0]?.key).toBe('search-1')
  })

  it('should not keep a persisted companion_ask spinning after the stream ends', () => {
    const items = buildAgentToolChainItems({
      invocations: [
        {
          toolCallId: 'ask-1',
          toolName: 'companion_ask',
          args: { question: '继续吗？', options: ['是', '否'] }
        }
      ],
      isToolError: isToolResultError
    })
    expect(items[0]?.status).toBe('success')
    expect(items[0]?.hasContent).toBe(false)
  })

  it('should keep an answered companion_ask expandable like other tools', () => {
    const items = buildAgentToolChainItems({
      invocations: [
        {
          toolCallId: 'ask-1',
          toolName: 'companion_ask',
          args: { question: '继续吗？', options: ['是', '否'] },
          result: JSON.stringify({
            question: '继续吗？',
            answer: '是',
            selectedOptionIds: ['0']
          })
        }
      ],
      isToolError: isToolResultError
    })
    expect(items[0]?.status).toBe('success')
    expect(items[0]?.hasContent).toBe(true)
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

  it('detects Chinese tool execution failed prefix', () => {
    expect(
      isToolResultError({
        toolName: 'companion_ask',
        result: '工具执行失败 (companion_ask): stream aborted'
      })
    ).toBe(true)
  })

  it('does not treat a rejected companion_ask as a tool execution error', () => {
    expect(
      isToolResultError({
        toolName: 'companion_ask',
        result: '工具执行失败 (companion_ask): 用户拒绝了本次操作。'
      })
    ).toBe(false)
  })
})
