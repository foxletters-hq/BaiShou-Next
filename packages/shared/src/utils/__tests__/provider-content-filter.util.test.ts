import { describe, expect, it } from 'vitest'
import {
  PROVIDER_CONTENT_FILTER_ERROR_CODE,
  PROVIDER_CONTENT_FILTER_MESSAGE,
  createProviderContentFilterError,
  isContentFilterFinishReason,
  isProviderContentFilterError,
  localizeStreamDisplayError,
  readProviderContentFilterDetail
} from '../provider-content-filter.util'

describe('provider-content-filter.util', () => {
  it('creates and identifies ProviderContentFilterError while preserving raw detail', () => {
    const err = createProviderContentFilterError('promptFeedback.blockReason=PROHIBITED_CONTENT')
    expect(err.message).toBe(PROVIDER_CONTENT_FILTER_MESSAGE)
    expect(err.code).toBe(PROVIDER_CONTENT_FILTER_ERROR_CODE)
    expect(readProviderContentFilterDetail(err)).toBe(
      'promptFeedback.blockReason=PROHIBITED_CONTENT'
    )
    expect(isProviderContentFilterError(err)).toBe(true)
  })

  it('recognizes finishReason and rawFinishReason variants from all major providers', () => {
    expect(isContentFilterFinishReason('content-filter')).toBe(true)
    expect(isContentFilterFinishReason('other', 'PROHIBITED_CONTENT')).toBe(true)
    expect(isContentFilterFinishReason('other', 'SAFETY')).toBe(true)
    expect(isContentFilterFinishReason('other', 'IMAGE_SAFETY')).toBe(true)
    expect(isContentFilterFinishReason('other', 'content_filter')).toBe(true)
    expect(isContentFilterFinishReason('other', 'refusal')).toBe(true)
    expect(isContentFilterFinishReason('stop', 'STOP')).toBe(false)
    expect(isContentFilterFinishReason('length')).toBe(false)
  })

  it('matches upstream safety filter and moderation error messages accurately', () => {
    expect(
      isProviderContentFilterError(new Error('Response was blocked due to PROHIBITED_CONTENT'))
    ).toBe(true)
    expect(
      isProviderContentFilterError(
        new Error('Your request was rejected as a result of our safety system.')
      )
    ).toBe(true)
    expect(
      isProviderContentFilterError(new Error('Output blocked by content filtering policy'))
    ).toBe(true)
    expect(
      isProviderContentFilterError({
        statusCode: 400,
        responseBody:
          '{"error":{"code":"DataInspectionFailed","message":"Input data may contain inappropriate content."}}'
      })
    ).toBe(true)
    expect(isProviderContentFilterError('系统检测到输入或生成内容可能包含不安全或敏感内容')).toBe(
      true
    )
  })

  it('does not misclassify API key, rate limit, balance, or safetySettings schema errors', () => {
    expect(isProviderContentFilterError(new Error('API key not valid'))).toBe(false)
    expect(isProviderContentFilterError(new Error('HTTP 429 Too Many Requests'))).toBe(false)
    expect(isProviderContentFilterError(new Error('Insufficient Balance'))).toBe(false)
    expect(
      isProviderContentFilterError(
        new Error("Invalid argument: Unknown name 'safetySettings' at 'generation_config'")
      )
    ).toBe(false)
    expect(isProviderContentFilterError(new Error('Model does not support image input'))).toBe(
      false
    )
  })

  it('localizes content filter and vision errors for bubble display', () => {
    const t = (key: string, fallback: string) =>
      key === 'agent.error.content_filter' ? 'Blocked gently' : fallback

    expect(localizeStreamDisplayError('Response blocked due to SAFETY', t)).toBe('Blocked gently')
    expect(localizeStreamDisplayError(PROVIDER_CONTENT_FILTER_MESSAGE, t)).toBe('Blocked gently')
    expect(localizeStreamDisplayError('Network request failed', t)).toBe('Network request failed')
  })
})
