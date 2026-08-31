import { describe, expect, it } from 'vitest'
import {
  applyNotebookAskProgress,
  EMPTY_NOTEBOOK_ASK_STREAM,
  isNotebookAskAbortError
} from '../notebook-ask-progress.util'

describe('notebook-ask-progress.util', () => {
  it('keeps earlier text while thinking chunks arrive', () => {
    const afterText = applyNotebookAskProgress(EMPTY_NOTEBOOK_ASK_STREAM, {
      phase: 'answering',
      text: '先出正文'
    })
    expect(
      applyNotebookAskProgress(afterText, {
        phase: 'thinking',
        reasoning: '先检索再归纳'
      })
    ).toEqual({
      phase: 'thinking',
      text: '先出正文',
      reasoning: '先检索再归纳',
      tools: []
    })
  })

  it('classifies abort errors so the pane does not treat them as ask failures', () => {
    expect(isNotebookAskAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(
      true
    )
    expect(isNotebookAskAbortError(new Error('embedding-not-configured'))).toBe(false)
  })
})
