import { describe, it, expect } from 'vitest'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'

describe('isMissingSqliteFunctionError', () => {
  it('detects missing sqlite function errors', () => {
    expect(isMissingSqliteFunctionError('no such function: vec_distance_cosine')).toBe(true)
    expect(isMissingSqliteFunctionError('Unknown function: libsql_vector_idx')).toBe(true)
  })

  it('does not treat transient errors as missing function', () => {
    expect(isMissingSqliteFunctionError('database is locked')).toBe(false)
    expect(isMissingSqliteFunctionError('Mismatched vector dimensions')).toBe(false)
  })

  it('walks drizzle Failed query cause to the sqlite function error', () => {
    const inner = new Error('no such function: vec_distance_cosine')
    const wrapped = new Error('Failed query: select vec_distance_cosine(...)')
    wrapped.cause = inner
    expect(isMissingSqliteFunctionError(wrapped)).toBe(true)
  })
})
