import { describe, expect, it } from 'vitest'

import { resolveMobileSnapshotsDirectory } from '../mobile-snapshot-path.util'

describe('resolveMobileSnapshotsDirectory', () => {
  it('places snapshots under app document directory', () => {
    expect(resolveMobileSnapshotsDirectory('file:///data/user/0/com.baishou.baishou/files/')).toBe(
      '/data/user/0/com.baishou.baishou/files/snapshots'
    )
  })
})
