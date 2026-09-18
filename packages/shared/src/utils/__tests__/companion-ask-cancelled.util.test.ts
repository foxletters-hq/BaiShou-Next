import { describe, expect, it } from 'vitest'
import {
  companionAskCancelledMessage,
  isCompanionAskCancelledMessage
} from '../companion-ask-cancelled.util'

describe('companionAskCancelledMessage', () => {
  it('should return Chinese for zh', () => {
    expect(companionAskCancelledMessage('zh')).toBe('用户取消了这一次操作')
  })

  it('should return English for en', () => {
    expect(companionAskCancelledMessage('en')).toBe('The user cancelled this operation.')
  })

  it('should recognize every locale variant', () => {
    expect(isCompanionAskCancelledMessage('用户取消了这一次操作')).toBe(true)
    expect(isCompanionAskCancelledMessage('The user cancelled this operation.')).toBe(true)
    expect(isCompanionAskCancelledMessage('使用者取消了這一次操作')).toBe(true)
    expect(isCompanionAskCancelledMessage('ユーザーはこの操作をキャンセルしました。')).toBe(true)
    expect(isCompanionAskCancelledMessage('User declined to answer.')).toBe(false)
  })
})
