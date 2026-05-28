import { describe, expect, it } from 'vitest'
import {
  classifyAiApiCallError,
  formatAiApiCallError,
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

  it('wraps for IPC-safe Error', () => {
    const err = { message: 'Forbidden', statusCode: 403, responseBody: '{"message":"no funds"}' }
    const wrapped = toSerializableAiError(err, 'Batch embed failed')
    expect(wrapped.message).toBe('Batch embed failed: no funds')
    expect(wrapped).toBeInstanceOf(Error)
  })
})
