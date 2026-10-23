import { describe, expect, it, vi, beforeEach } from 'vitest'
import { generateText, streamText } from 'ai'
import {
  CONNECTION_TEST_MAX_OUTPUT_TOKENS,
  CONNECTION_TEST_PROMPT,
  probeProviderConnection,
  wrapConnectionTestError
} from '../provider-connection-test.util'

vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn()
}))

describe('provider-connection-test.util', () => {
  const model = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('probes with shared prompt and maxOutputTokens', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

    await probeProviderConnection({ model, modelId: 'gpt-4o' })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        prompt: CONNECTION_TEST_PROMPT,
        maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS
      })
    )
  })

  it('uses small-task reasoning options for openai reasoning models', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'ok' } as any)

    await probeProviderConnection({
      model,
      modelId: 'gpt-5.6-sol',
      providerType: 'openai'
    })

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: expect.objectContaining({
          openai: expect.objectContaining({
            reasoningEffort: expect.any(String)
          })
        })
      })
    )
  })

  it('treats max_tokens truncation as success', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(
      new Error(
        'Could not finish the message because max_tokens or model output limit was reached.'
      )
    )

    await expect(probeProviderConnection({ model, modelId: 'gpt-5' })).resolves.toBeUndefined()
  })

  it('rethrows non-benign failures', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Unauthorized'))

    await expect(probeProviderConnection({ model })).rejects.toThrow('Unauthorized')
  })

  it('resolves streaming probes without calling generateText', async () => {
    vi.mocked(streamText).mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: 'start' }
        yield { type: 'finish' }
      })()
    } as any)

    await expect(
      probeProviderConnection({ model, modelId: 'kimi-k2.7-code', streaming: true })
    ).resolves.toBeUndefined()

    expect(generateText).not.toHaveBeenCalled()
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        prompt: CONNECTION_TEST_PROMPT,
        maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS
      })
    )
  })

  it('surfaces errors emitted as streaming events', async () => {
    vi.mocked(streamText).mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: 'error', error: new Error('Unauthorized') }
      })()
    } as any)

    await expect(
      probeProviderConnection({ model, modelId: 'kimi-k2.7-code', streaming: true })
    ).rejects.toThrow('Unauthorized')
  })

  it('wraps connection test errors with provider name logging prefix', () => {
    const err = wrapConnectionTestError('OpenAI', new Error('boom'))
    expect(err.message).toBe('Connection test failed: boom')
  })
})
