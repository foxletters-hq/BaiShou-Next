import { describe, expect, it } from 'vitest'
import { resolveInputBarPrimaryAction } from '../input-bar-primary-action.util'

describe('resolveInputBarPrimaryAction', () => {
  it('shows stop while generating with an empty composer', () => {
    expect(
      resolveInputBarPrimaryAction({
        isLoading: true,
        canSend: false,
        allowSendWhileLoading: true,
        hasStopHandler: true
      })
    ).toBe('stop')
  })

  it('switches to send when the composer has text during generation', () => {
    expect(
      resolveInputBarPrimaryAction({
        isLoading: true,
        canSend: true,
        allowSendWhileLoading: true,
        hasStopHandler: true
      })
    ).toBe('send')
  })

  it('keeps stop if send-while-loading is not allowed', () => {
    expect(
      resolveInputBarPrimaryAction({
        isLoading: true,
        canSend: true,
        allowSendWhileLoading: false,
        hasStopHandler: true
      })
    ).toBe('stop')
  })

  it('shows send when idle', () => {
    expect(
      resolveInputBarPrimaryAction({
        isLoading: false,
        canSend: true
      })
    ).toBe('send')
    expect(
      resolveInputBarPrimaryAction({
        isLoading: false,
        canSend: false
      })
    ).toBe('send')
  })
})
