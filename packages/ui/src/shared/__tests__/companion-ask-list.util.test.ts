import { describe, expect, it } from 'vitest'
import type { CompanionAskPresentation } from '../tool-result.util'
import { companionAskWaitingSubtitle, isCompanionAskAwaitingAnswer } from '../companion-ask-list.util'

function ask(partial: Partial<CompanionAskPresentation> = {}): CompanionAskPresentation {
  return {
    mode: 'companion_ask',
    question: '要搜哪类新闻？',
    answer: null,
    declined: false,
    options: [
      { id: '0', label: '科技' },
      { id: '1', label: '财经' }
    ],
    selectedOptionIds: [],
    ...partial
  }
}

describe('companionAskWaitingSubtitle', () => {
  it('should show the pending question so the asking row is not an empty spinner', () => {
    expect(companionAskWaitingSubtitle(ask())).toBe('要搜哪类新闻？')
    expect(companionAskWaitingSubtitle(ask({ question: '  ' }))).toBeUndefined()
  })
})

describe('isCompanionAskAwaitingAnswer', () => {
  it('should be true when the question has options but no answer yet', () => {
    expect(isCompanionAskAwaitingAnswer(ask())).toBe(true)
  })

  it('should be false after the user answered or declined', () => {
    expect(isCompanionAskAwaitingAnswer(ask({ answer: '科技', selectedOptionIds: ['0'] }))).toBe(
      false
    )
    expect(isCompanionAskAwaitingAnswer(ask({ declined: true }))).toBe(false)
    expect(isCompanionAskAwaitingAnswer(ask({ selectedOptionIds: ['0'] }))).toBe(false)
  })

  it('should be false when the tool already returned a result without an answer', () => {
    expect(isCompanionAskAwaitingAnswer(ask(), { hasResult: true })).toBe(false)
  })
})

