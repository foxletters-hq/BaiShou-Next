import { describe, it, expect } from 'vitest'
import type { AiProviderModel } from '../ai-provider.types'
import { ProviderType } from '../ai-provider.types'

// TDD：AI 提供商高级配置类型测试
// 测试目标：验证 AiProviderAdvancedConfig 接口约束

describe('AiProviderAdvancedConfig', () => {
  it('should accept valid temperature value', () => {
    const config = {
      temperature: 0.7
    }
    expect(config.temperature).toBe(0.7)
  })

  it('should accept valid topK value', () => {
    const config = {
      topK: 40
    }
    expect(config.topK).toBe(40)
  })

  it('should accept valid topP value', () => {
    const config = {
      topP: 0.9
    }
    expect(config.topP).toBe(0.9)
  })

  it('should accept valid maxTokens value', () => {
    const config = {
      maxTokens: 4096
    }
    expect(config.maxTokens).toBe(4096)
  })

  it('should accept valid frequencyPenalty value', () => {
    const config = {
      frequencyPenalty: 0.5
    }
    expect(config.frequencyPenalty).toBe(0.5)
  })

  it('should accept valid presencePenalty value', () => {
    const config = {
      presencePenalty: 0.5
    }
    expect(config.presencePenalty).toBe(0.5)
  })

  it('should accept empty config object', () => {
    const config = {}
    expect(config).toEqual({})
  })

  it('should accept partial config with multiple parameters', () => {
    const config = {
      temperature: 0.8,
      topK: 50,
      maxTokens: 2048
    }
    expect(config).toEqual({
      temperature: 0.8,
      topK: 50,
      maxTokens: 2048
    })
  })

  it('should accept full config with all parameters', () => {
    const config = {
      temperature: 1.0,
      topK: 60,
      topP: 0.95,
      maxTokens: 8192,
      frequencyPenalty: 1.0,
      presencePenalty: 1.0
    }
    expect(config).toEqual({
      temperature: 1.0,
      topK: 60,
      topP: 0.95,
      maxTokens: 8192,
      frequencyPenalty: 1.0,
      presencePenalty: 1.0
    })
  })
})

describe('AiProviderModel with advancedConfig', () => {
  it('should accept AiProviderModel without advancedConfig', () => {
    const model: Partial<AiProviderModel> = {
      id: 'provider-1',
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      apiKey: 'sk-xxx',
      isEnabled: true,
      isSystem: false,
      sortOrder: 0
    }
    expect(model.advancedConfig).toBeUndefined()
  })

  it('should accept AiProviderModel with advancedConfig', () => {
    const model = {
      id: 'provider-1',
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      apiKey: 'sk-xxx',
      isEnabled: true,
      isSystem: false,
      sortOrder: 0,
      advancedConfig: {
        temperature: 0.7,
        maxTokens: 4096
      }
    }
    expect(model.advancedConfig).toEqual({
      temperature: 0.7,
      maxTokens: 4096
    })
  })

  it('should accept AiProviderModel with empty advancedConfig', () => {
    const model = {
      id: 'provider-1',
      name: 'OpenAI',
      type: ProviderType.OpenAI,
      apiKey: 'sk-xxx',
      isEnabled: true,
      isSystem: false,
      sortOrder: 0,
      advancedConfig: {}
    }
    expect(model.advancedConfig).toEqual({})
  })
})
