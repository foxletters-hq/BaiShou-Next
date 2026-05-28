import { describe, expect, it } from 'vitest'
import { extractApiErrorMessage, formatModelNotAvailableMessage } from '../provider-api-error.util'

describe('provider-api-error.util', () => {
  it('extracts message from API response body JSON', () => {
    const err = {
      message: 'Bad Request',
      responseBody: '{"code":20012,"message":"Model does not exist. Please check it carefully."}'
    }
    expect(extractApiErrorMessage(err)).toBe('Model does not exist. Please check it carefully.')
  })

  it('formats model not available with suggestions', () => {
    const msg = formatModelNotAvailableMessage('SiliconFlow', 'gpt-4o', [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-7B-Instruct'
    ])
    expect(msg).toContain('gpt-4o')
    expect(msg).toContain('deepseek-ai/DeepSeek-V3')
  })
})
