import { describe, expect, it } from 'vitest'
import { readProviderTurnMessages } from '../read-provider-turn-messages'

function noOutputError(): Error {
  return Object.assign(new Error('No output generated.'), {
    name: 'AI_NoOutputGeneratedError',
    [Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')]: true
  })
}

describe('readProviderTurnMessages', () => {
  it('should return response messages when they exist', async () => {
    const messages = [{ role: 'assistant', content: [] }]
    await expect(
      readProviderTurnMessages({
        response: Promise.resolve({ messages })
      })
    ).resolves.toEqual(messages)
  })

  it('should fall back to stream messages when response throws no-output', async () => {
    const messages = [{ role: 'tool', content: 'ok' }]
    await expect(
      readProviderTurnMessages({
        response: Promise.reject(noOutputError()),
        messages
      })
    ).resolves.toEqual(messages)
  })

  it('should return null when both sources are empty after no-output', async () => {
    await expect(
      readProviderTurnMessages({
        response: Promise.reject(noOutputError()),
        messages: []
      })
    ).resolves.toBeNull()
  })

  it('should rethrow unrelated response errors', async () => {
    await expect(
      readProviderTurnMessages({
        response: Promise.reject(new Error('network'))
      })
    ).rejects.toThrow('network')
  })
})
