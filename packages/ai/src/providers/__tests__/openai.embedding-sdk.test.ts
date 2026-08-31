import { describe, it, expect } from 'vitest'
import { embed } from 'ai'
import { OpenAIAdaptedProvider } from '../openai.provider'
import { ProviderType, createAiProvider } from '@baishou/shared'

describe('OpenAIAdaptedProvider embedding model spec', () => {
  it('returns compatible-gateway embedding models that current embed() accepts', async () => {
    const provider = new OpenAIAdaptedProvider(
      createAiProvider({
        id: ProviderType.SiliconFlow,
        name: 'SiliconFlow',
        type: ProviderType.SiliconFlow,
        apiKey: 'test-key',
        baseUrl: 'https://api.siliconflow.cn/v1'
      })
    )

    const model = provider.getEmbeddingModel('Qwen/Qwen3-Embedding-4B') as {
      specificationVersion?: string
      provider?: string
      modelId?: string
    }

    expect(model.specificationVersion).toBe('v4')
    expect(model.modelId).toBe('Qwen/Qwen3-Embedding-4B')
    expect(model.provider).toBe('openaiCompatible.embedding')

    try {
      await embed({ model: model as never, value: 'hi' })
    } catch (error) {
      expect(String(error)).not.toMatch(/Unsupported model version/)
    }
  })
})
