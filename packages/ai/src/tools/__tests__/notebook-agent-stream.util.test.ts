import { describe, expect, it } from 'vitest'
import { applyNotebookAgentStreamPart } from '../notebook-agent-stream.util'

describe('notebook-agent-stream.util', () => {
  it('keeps reasoning and answer separate and records tool status', () => {
    let state = { text: '', reasoning: '' }
    state = applyNotebookAgentStreamPart({ type: 'reasoning-delta', text: '先检索' }, state)
    const afterCall = applyNotebookAgentStreamPart(
      { type: 'tool-call', toolName: 'knowledge_search' },
      state
    )
    expect(afterCall.tool).toEqual({ name: 'knowledge_search', status: 'running' })
    state = { text: afterCall.text, reasoning: afterCall.reasoning }
    const afterText = applyNotebookAgentStreamPart({ type: 'text-delta', text: '结论' }, state)
    expect(afterText.text).toBe('结论')
    expect(afterText.reasoning).toBe('先检索')
  })

  it('maps tool-output-available without toolName to the last running tool', () => {
    const afterCall = applyNotebookAgentStreamPart(
      { type: 'tool-input-start', toolName: 'knowledge_search' },
      { text: '', reasoning: '' }
    )
    const afterResult = applyNotebookAgentStreamPart(
      { type: 'tool-output-available', output: '## 知识库检索\n查询：对齐' },
      { text: afterCall.text, reasoning: afterCall.reasoning, lastToolName: afterCall.lastToolName }
    )
    expect(afterResult.tool).toEqual({
      name: 'knowledge_search',
      status: 'done',
      result: '## 知识库检索\n查询：对齐'
    })
  })
})
