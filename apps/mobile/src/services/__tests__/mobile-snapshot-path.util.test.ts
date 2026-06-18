import { describe, expect, it } from 'vitest'

import {
  resolveLegacySandboxSnapshotsDirectory,
  resolveMobileSnapshotsDirectory
} from '../mobile-snapshot-path.util'

describe('resolveMobileSnapshotsDirectory', () => {
  it('places snapshots under workspace root', () => {
    expect(resolveMobileSnapshotsDirectory('file:///storage/emulated/0/BaiShou_Root/')).toBe(
      '/storage/emulated/0/BaiShou_Root/snapshots'
    )
  })
})

describe('resolveLegacySandboxSnapshotsDirectory', () => {
  it('resolves old sandbox snapshot path for migration', () => {
    expect(
      resolveLegacySandboxSnapshotsDirectory('file:///data/user/0/com.baishou.baishou/files/')
    ).toBe('/data/user/0/com.baishou.baishou/files/snapshots')
  })
})
