import { describe, expect, it } from 'vitest'
import { shouldWaitForGraphExtract } from '../organize-pipeline-waiting.util'

describe('shouldWaitForGraphExtract', () => {
  it('should hide the graph waiting card when embed finished but pipeline stayed embed', () => {
    expect(
      shouldWaitForGraphExtract({ organizePipeline: 'embed', indexing: false })
    ).toBe(false)
  })

  it('should keep waiting while batch embed is still running', () => {
    expect(shouldWaitForGraphExtract({ organizePipeline: 'embed', indexing: true })).toBe(true)
  })

  it('should wait when the pipeline is explicitly on graph extract', () => {
    expect(shouldWaitForGraphExtract({ organizePipeline: 'graph', indexing: false })).toBe(true)
  })

  it('should stay idle when nothing is organizing', () => {
    expect(shouldWaitForGraphExtract({ organizePipeline: 'idle', indexing: false })).toBe(false)
  })
})
