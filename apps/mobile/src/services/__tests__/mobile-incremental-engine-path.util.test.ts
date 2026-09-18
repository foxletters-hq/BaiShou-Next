import { describe, expect, it } from 'vitest'
import { joinIncrementalPath } from '../mobile-incremental-engine-path.util'

describe('joinIncrementalPath', () => {
  it('should join segments without duplicate slashes when parts have edges trimmed', () => {
    expect(joinIncrementalPath('/root/', '/.baishou/', 'manifest.json')).toBe(
      '/root/.baishou/manifest.json'
    )
  })

  it('should drop empty segments when joining a path', () => {
    expect(joinIncrementalPath('root', '', 'file')).toBe('root/file')
  })
})
