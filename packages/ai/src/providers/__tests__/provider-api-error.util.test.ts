import { describe, expect, it } from 'vitest'
import {
  extractApiErrorMessage,
  formatModelNotAvailableMessage,
  isBenignConnectionTestLimitError,
  normalizeApiErrorObject
} from '../provider-api-error.util'

describe('provider-api-error.util', () => {
  it('extracts message from API response body JSON', () => {
    const err = {
      message: 'Bad Request',
      responseBody: '{"code":20012,"message":"Model does not exist. Please check it carefully."}'
    }
    expect(extractApiErrorMessage(err)).toBe('Model does not exist. Please check it carefully.')
  })

  it('extracts nested error.message from OpenAI/DeepSeek style responseBody when message is empty', () => {
    const err = Object.assign(new Error(''), {
      name: 'AI_APICallError',
      statusCode: 402,
      responseBody:
        '{"error":{"message":"Insufficient Balance (request_id: 1b902b43)","type":"insufficient_balance_error","param":null,"code":"invalid_request_error"}}'
    })
    expect(extractApiErrorMessage(err)).toBe('Insufficient Balance (request_id: 1b902b43)')
    expect(normalizeApiErrorObject(err).message).toBe('Insufficient Balance (request_id: 1b902b43)')
  })

  it('falls back to HTTP status description when message and responseBody are empty (HTTP/2 empty statusText)', () => {
    const err = Object.assign(new Error(''), {
      name: 'AI_APICallError',
      statusCode: 402,
      responseBody: ''
    })
    expect(normalizeApiErrorObject(err).message).toBe(
      'HTTP 402 Payment Required (Insufficient Balance)'
    )
  })

  it('formats model not available with suggestions', () => {
    const msg = formatModelNotAvailableMessage('SiliconFlow', 'gpt-4o', [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-7B-Instruct'
    ])
    expect(msg).toContain('gpt-4o')
    expect(msg).toContain('deepseek-ai/DeepSeek-V3')
  })

  it('treats max_tokens truncation as benign for connection test', () => {
    expect(
      isBenignConnectionTestLimitError(
        'Could not finish the message because max_tokens or model output limit was reached.'
      )
    ).toBe(true)
    expect(isBenignConnectionTestLimitError('Unauthorized')).toBe(false)
  })

  it('normalizes provider safety filter errors to a gentle message while keeping rawDetail', () => {
    const err = Object.assign(new Error('Forbidden'), {
      statusCode: 403,
      responseBody:
        '{"error":{"message":"Response blocked due to PROHIBITED_CONTENT","status":"PERMISSION_DENIED"}}'
    })
    const normalized = normalizeApiErrorObject(err) as Error & {
      code?: string
      rawDetail?: string
    }
    expect(normalized.code).toBe('PROVIDER_CONTENT_FILTER')
    expect(normalized.message).toBe('伙伴被服务商安全机制拦截了呀~不是白守的错哦')
    expect(normalized.rawDetail).toContain('PROHIBITED_CONTENT')
  })
})
