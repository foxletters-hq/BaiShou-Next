import { describe, expect, it } from 'vitest'
import {
  needsDataUriForImageDisplay,
  resolveDisplayFallbackUri
} from '../mobile-attachment-display-path.util'

describe('mobile-attachment-display-path', () => {
  describe('needsDataUriForImageDisplay', () => {
    it('returns true for BaiShou_Root external paths', () => {
      expect(
        needsDataUriForImageDisplay(
          '/storage/emulated/0/BaiShou_Root/Personal/Journals/2024/01/attachment/a.jpg'
        )
      ).toBe(true)
    })

    it('returns true for paths missing /storage prefix', () => {
      expect(needsDataUriForImageDisplay('/emulated/0/BaiShou_Root/foo.jpg')).toBe(true)
    })

    it('returns false for sandbox-like paths', () => {
      expect(needsDataUriForImageDisplay('/data/user/0/com.baishou/files/Vaults/foo.jpg')).toBe(
        false
      )
    })
  })

  describe('resolveDisplayFallbackUri', () => {
    it('returns null for external storage paths', () => {
      expect(
        resolveDisplayFallbackUri('/storage/emulated/0/BaiShou_Root/Personal/Attachments/x.png')
      ).toBeNull()
    })

    it('returns file:// for sandbox paths', () => {
      expect(resolveDisplayFallbackUri('/data/user/0/com.baishou/cache/img.jpg')).toBe(
        'file:///data/user/0/com.baishou/cache/img.jpg'
      )
    })
  })
})
