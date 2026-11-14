import { describe, it, expect, vi } from 'vitest'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import {
  GOOGLE_PERMISSIVE_SAFETY_SETTINGS,
  createGooglePermissiveSafetyMiddleware,
  wrapGoogleLanguageModelWithSafetySettings
} from '../google-safety-settings.util'

function createFakeLanguageModel(): {
  model: LanguageModelV3
  doGenerate: ReturnType<typeof vi.fn>
} {
  const doGenerate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'ok' }],
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    warnings: []
  })
  const model: LanguageModelV3 = {
    specificationVersion: 'v3',
    provider: 'google.generative-ai',
    modelId: 'gemini-2.5-flash',
    supportedUrls: {},
    doGenerate,
    doStream: vi.fn()
  }
  return { model, doGenerate }
}

describe('google-safety-settings.util', () => {
  it('should inject BLOCK_NONE safetySettings when providerOptions is absent', async () => {
    const middleware = createGooglePermissiveSafetyMiddleware()
    const transformed = await middleware.transformParams!({
      type: 'generate',
      params: {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
      } as never,
      model: {} as never
    })

    expect(transformed.providerOptions).toEqual({
      google: {
        safetySettings: GOOGLE_PERMISSIVE_SAFETY_SETTINGS
      }
    })
  })

  it('should preserve existing google providerOptions such as thinkingConfig', async () => {
    const middleware = createGooglePermissiveSafetyMiddleware()
    const transformed = await middleware.transformParams!({
      type: 'generate',
      params: {
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        providerOptions: {
          google: {
            thinkingConfig: { thinkingBudget: 1024 }
          }
        }
      } as never,
      model: {} as never
    })

    expect(transformed.providerOptions).toEqual({
      google: {
        thinkingConfig: { thinkingBudget: 1024 },
        safetySettings: GOOGLE_PERMISSIVE_SAFETY_SETTINGS
      }
    })
  })

  it('should not override explicit safetySettings provided by caller', async () => {
    const customSafetySettings = [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
    ]
    const middleware = createGooglePermissiveSafetyMiddleware()
    const transformed = await middleware.transformParams!({
      type: 'generate',
      params: {
        prompt: [],
        providerOptions: {
          google: {
            safetySettings: customSafetySettings
          }
        }
      } as never,
      model: {} as never
    })

    expect((transformed.providerOptions as any).google.safetySettings).toEqual(customSafetySettings)
  })

  it('should pass injected safetySettings through wrapLanguageModel to doGenerate', async () => {
    const { model, doGenerate } = createFakeLanguageModel()
    const wrapped = wrapGoogleLanguageModelWithSafetySettings(
      model as never
    ) as unknown as LanguageModelV3

    await wrapped.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
    } as never)

    expect(doGenerate).toHaveBeenCalledTimes(1)
    const calledParams = doGenerate.mock.calls[0]?.[0] as {
      providerOptions?: { google?: { safetySettings?: unknown } }
    }
    expect(calledParams.providerOptions?.google?.safetySettings).toEqual(
      GOOGLE_PERMISSIVE_SAFETY_SETTINGS
    )
  })
})
