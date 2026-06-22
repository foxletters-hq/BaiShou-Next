import { describe, expect, it } from 'vitest'
import { syncIoPathKey } from '../mobile-sync-path.util'

describe('syncIoPathKey', () => {
  it('去掉 file:// 与尾部斜杠', () => {
    expect(syncIoPathKey('file:///data/user/0/app/cache/sync.tmp/')).toBe(
      '/data/user/0/app/cache/sync.tmp'
    )
  })

  it('修正 /emulated/0 前缀', () => {
    expect(syncIoPathKey('/emulated/0/Documents/note.md')).toBe(
      '/storage/emulated/0/Documents/note.md'
    )
  })
})
