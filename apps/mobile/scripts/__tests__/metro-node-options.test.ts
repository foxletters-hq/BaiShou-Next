import { describe, expect, it } from 'vitest'
import { withMetroNodeOptions } from '../mobile-dev-host.mjs'

describe('withMetroNodeOptions', () => {
  it('should add max-old-space-size when NODE_OPTIONS is empty', () => {
    expect(withMetroNodeOptions({})).toBe('--max-old-space-size=6144')
  })

  it('should keep an existing max-old-space-size', () => {
    expect(withMetroNodeOptions({ NODE_OPTIONS: '--max-old-space-size=4096' })).toBe(
      '--max-old-space-size=4096'
    )
  })

  it('should append heap limit next to other NODE_OPTIONS', () => {
    expect(withMetroNodeOptions({ NODE_OPTIONS: '--no-warnings' })).toBe(
      '--no-warnings --max-old-space-size=6144'
    )
  })
})
