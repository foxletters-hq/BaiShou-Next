import { describe, expect, it } from 'vitest'
import type { CompanionAskPresentation } from '../tool-result.util'
import {
  isCompanionAskAwaitingAnswer,
  shouldRenderCompanionAskResultInList
} from '../companion-ask-list.util'

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

describe('isCompanionAskAwaitingAnswer', () => {
  it('should be true when the question has options but no answer yet', () => {
    expect(isCompanionAskAwaitingAnswer(ask())).toBe(true)
  })

  it('should be false after the user answered or declined', () => {
    expect(isCompanionAskAwaitingAnswer(ask({ answer: '科技', selectedOptionIds: ['0'] }))).toBe(
      false
    )
    expect(isCompanionAskAwaitingAnswer(ask({ declined: true }))).toBe(false)
  })
})

describe('shouldRenderCompanionAskResultInList', () => {
  it('should hide the option card while the ask is still loading', () => {
    expect(shouldRenderCompanionAskResultInList(ask({ answer: '科技' }), 'loading')).toBe(false)
  })

  it('should show the result card only after an answer or decline', () => {
    expect(shouldRenderCompanionAskResultInList(ask(), 'success')).toBe(false)
    expect(shouldRenderCompanionAskResultInList(ask({ answer: '科技' }), 'success')).toBe(true)
    expect(shouldRenderCompanionAskResultInList(ask({ declined: true }), 'success')).toBe(true)
  })
})
