import { describe, expect, it } from 'vitest'
import {
  classifyAiApiCallError,
  formatAiApiCallError,
  localizeAiApiErrorMessage,
  toSerializableAiError
} from '../ai-api-error.util'

describe('formatAiApiCallError', () => {
  it('parses SiliconFlow balance error from responseBody', () => {
    const err = {
      message: 'Forbidden',
      statusCode: 403,
      responseBody:
        '{"code":30001,"message":"Sorry, your account balance is insufficient","data":null}'
    }
    expect(formatAiApiCallError(err)).toBe('Sorry, your account balance is insufficient')
    expect(classifyAiApiCallError(err)).toBe('balance')
  })

  it('falls back to message when responseBody is absent', () => {
    expect(formatAiApiCallError(new Error('connection reset'))).toBe('connection reset')
  })

  it('should read OpenAI-style nested error.message when the SDK message is empty', () => {
    const err = Object.assign(new Error(''), {
      name: 'AI_APICallError',
      statusCode: 402,
      responseBody:
        '{"error":{"message":"Insufficient Balance (request_id: e342be5d-d72f-4916-9840-a03538c0a60f)","type":"unknown_error","param":null,"code":"invalid_request_error"}}'
    })
    expect(formatAiApiCallError(err)).toBe(
      'Insufficient Balance (request_id: e342be5d-d72f-4916-9840-a03538c0a60f)'
    )
    expect(classifyAiApiCallError(err)).toBe('balance')
  })

  it('should read nested data.error.message when responseBody is absent', () => {
    const err = {
      message: '',
      statusCode: 402,
      data: { error: { message: 'Insufficient Balance', type: 'unknown_error' } }
    }
    expect(formatAiApiCallError(err)).toBe('Insufficient Balance')
    expect(classifyAiApiCallError(err)).toBe('balance')
  })

  it('wraps for IPC-safe Error', () => {
    const err = { message: 'Forbidden', statusCode: 403, responseBody: '{"message":"no funds"}' }
    const wrapped = toSerializableAiError(err, 'Batch embed failed')
    expect(wrapped.message).toBe('Batch embed failed: no funds')
    expect(wrapped).toBeInstanceOf(Error)
  })
})

describe('localizeAiApiErrorMessage', () => {
  const t = (_key: string, fallback: string) => fallback

  it('should localize a SiliconFlow balance error instead of calling it unconfigured', () => {
    const err = {
      message: 'Payment Required',
      statusCode: 402,
      responseBody:
        '{"code":30001,"message":"Sorry, your account balance is insufficient","data":null}'
    }
    expect(localizeAiApiErrorMessage(err, t)).toBe('模型服务商提示账号额度不足。')
    expect(localizeAiApiErrorMessage(err, t)).not.toContain('未配置')
  })
})
