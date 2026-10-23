import { describe, expect, it } from 'vitest'
import { isNoOutputGeneratedError } from '../no-output-generated-error.util'

describe('isNoOutputGeneratedError', () => {
  it('should return true when the vercel symbol is set', () => {
    const error = Object.assign(new Error('No output generated.'), {
      name: 'AI_NoOutputGeneratedError',
      [Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')]: true
    })
    expect(isNoOutputGeneratedError(error)).toBe(true)
  })

  it('should return true when the name or message mentions NoOutputGenerated', () => {
    expect(isNoOutputGeneratedError({ name: 'AI_NoOutputGeneratedError' })).toBe(true)
    expect(isNoOutputGeneratedError({ message: 'AI_NoOutputGeneratedError: empty' })).toBe(true)
    expect(isNoOutputGeneratedError('AI_NoOutputGeneratedError')).toBe(true)
  })

  it('should return false when the error is unrelated', () => {
    expect(isNoOutputGeneratedError(new Error('network'))).toBe(false)
    expect(isNoOutputGeneratedError(null)).toBe(false)
  })
})
