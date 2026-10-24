import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyOpenAiThinkingBodyInject } from '../reasoning/openai-thinking-inject'
import { buildReasoningProviderOptionsResult } from '../reasoning/reasoning-provider-options'
import { OpenAIAdaptedProvider } from '../openai.provider'
import { ProviderType, createAiProvider } from '@baishou/shared'
import * as openaiCompatibleSdk from '@ai-sdk/openai-compatible'

vi.mock('@ai-sdk/openai-compatible', () => {
  const dummyModel = {}
  const dummyEmbedModel = {}
  const chatModelFn = vi.fn().mockReturnValue(dummyModel)
  const mockProvider = {
    chatModel: chatModelFn,
    textEmbeddingModel: vi.fn().mockReturnValue(dummyEmbedModel)
  }

  return {
    createOpenAICompatible: vi.fn().mockReturnValue(mockProvider)
  }
})

describe('MiniMax reasoning split and thinking injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('applyOpenAiThinkingBodyInject', () => {
    it('injects reasoning_split when specified in ALS inject', () => {
      const body: Record<string, unknown> = {}
      applyOpenAiThinkingBodyInject(body, { reasoningSplit: true })
      expect(body.reasoning_split).toBe(true)

      const bodyDisabled: Record<string, unknown> = {}
      applyOpenAiThinkingBodyInject(bodyDisabled, { reasoningSplit: false })
      expect(bodyDisabled.reasoning_split).toBe(false)
    })
  })

  describe('buildReasoningProviderOptionsResult for MiniMax models', () => {
    it('sets reasoningSplit: true and adaptive thinking for minimax-m3 on high effort', () => {
      const built = buildReasoningProviderOptionsResult({
        modelId: 'minimax-m3',
        providerType: 'minimax',
        effort: 'high'
      })
      expect(built.openAiThinkingInject).toMatchObject({
        thinkingType: 'adaptive',
        reasoningSplit: true
      })
    })

    it('sets reasoningSplit: false and disabled thinking for minimax-m3 on none effort', () => {
      const built = buildReasoningProviderOptionsResult({
        modelId: 'minimax-m3',
        providerType: 'minimax',
        effort: 'none'
      })
      expect(built.openAiThinkingInject).toMatchObject({
        thinkingType: 'disabled',
        reasoningSplit: false
      })
    })
  })

  describe('OpenAIAdaptedProvider fetch interceptor for MiniMax', () => {
    it('automatically injects reasoning_split: true for MiniMax chat completion requests', async () => {
      let capturedBody: Record<string, unknown> | null = null
      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        if (init?.body && typeof init.body === 'string') {
          capturedBody = JSON.parse(init.body)
        }
        return new Response(JSON.stringify({ id: 'test', choices: [] }), { status: 200 })
      })
      globalThis.fetch = mockFetch

      const config = createAiProvider({
        id: 'minimax-test',
        name: 'MiniMax',
        type: ProviderType.MiniMax,
        apiKey: 'test-key',
        baseUrl: 'https://api.minimaxi.com/v1'
      })

      const provider = new OpenAIAdaptedProvider(config)
      provider.getLanguageModel('MiniMax-Text-01')

      const createArgs = vi.mocked(openaiCompatibleSdk.createOpenAICompatible).mock.calls[0]?.[0]
      expect(createArgs).toBeDefined()
      const fetchInterceptor = createArgs?.fetch as typeof fetch
      expect(fetchInterceptor).toBeDefined()

      await fetchInterceptor('https://api.minimaxi.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true
        })
      })

      expect(capturedBody).toBeDefined()
      expect(capturedBody!['reasoning_split']).toBe(true)
    })

    it('preserves existing reasoning_split if explicitly provided in request body', async () => {
      let capturedBody: Record<string, unknown> | null = null
      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        if (init?.body && typeof init.body === 'string') {
          capturedBody = JSON.parse(init.body)
        }
        return new Response(JSON.stringify({ id: 'test', choices: [] }), { status: 200 })
      })
      globalThis.fetch = mockFetch

      const config = createAiProvider({
        id: 'minimax-test',
        name: 'MiniMax',
        type: ProviderType.MiniMax,
        apiKey: 'test-key',
        baseUrl: 'https://api.minimaxi.com/v1'
      })

      const provider = new OpenAIAdaptedProvider(config)
      provider.getLanguageModel('MiniMax-Text-01')

      const createArgs = vi.mocked(openaiCompatibleSdk.createOpenAICompatible).mock.calls[0]?.[0]
      const fetchInterceptor = createArgs?.fetch as typeof fetch

      await fetchInterceptor('https://api.minimaxi.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          messages: [{ role: 'user', content: 'hello' }],
          stream: true,
          reasoning_split: false
        })
      })

      expect(capturedBody).toBeDefined()
      expect(capturedBody!['reasoning_split']).toBe(false)
    })
  })
})
