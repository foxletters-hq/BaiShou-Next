import { describe, expect, it } from 'vitest'
import {
  knowledgeGraphStepDetail,
  parseKnowledgeGraphStepError,
  wrapKnowledgeGraphStepError
} from '../knowledge-graph-step-error.util'

describe('knowledge-graph-step-error.util', () => {
  it('should wrap a raw provider error with the failing step', () => {
    const wrapped = wrapKnowledgeGraphStepError('node-embed', new Error('Payment Required'))
    expect(wrapped.message).toBe('graph-step:node-embed:Payment Required')
    expect(parseKnowledgeGraphStepError(wrapped)).toEqual({
      step: 'node-embed',
      detail: 'Payment Required'
    })
    expect(knowledgeGraphStepDetail(wrapped)).toBe('Payment Required')
  })

  it('should keep the original step when wrapping a tagged error again', () => {
    const first = wrapKnowledgeGraphStepError('node-embed', new Error('Payment Required'))
    const again = wrapKnowledgeGraphStepError('align', first)
    expect(parseKnowledgeGraphStepError(again)?.step).toBe('node-embed')
  })

  it('should return null when the message has no step prefix', () => {
    expect(parseKnowledgeGraphStepError('Payment Required')).toBeNull()
    expect(knowledgeGraphStepDetail('Payment Required')).toBe('Payment Required')
  })

  it('should keep nested provider body when AI_APICallError.message is empty', () => {
    const err = Object.assign(new Error(''), {
      name: 'AI_APICallError',
      statusCode: 402,
      responseBody:
        '{"error":{"message":"Insufficient Balance (request_id: abc)","type":"unknown_error","code":"invalid_request_error"}}'
    })
    const wrapped = wrapKnowledgeGraphStepError('extract', err)
    expect(wrapped.message).toBe('graph-step:extract:Insufficient Balance (request_id: abc)')
    expect(parseKnowledgeGraphStepError(wrapped)).toEqual({
      step: 'extract',
      detail: 'Insufficient Balance (request_id: abc)'
    })
  })
})
