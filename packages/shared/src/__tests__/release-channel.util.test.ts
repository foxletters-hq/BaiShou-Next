import { describe, expect, it, vi } from 'vitest'
import {
  fetchReleaseChannelManifest,
  isAppVersionNewer,
  parseReleaseChannelManifest,
  releaseTagToPageUrl
} from '../utils/release-channel.util'

describe('release-channel.util', () => {
  it('isAppVersionNewer compares semver segments', () => {
    expect(isAppVersionNewer('1.2.4', '1.2.3')).toBe(true)
    expect(isAppVersionNewer('1.2.3', '1.2.3')).toBe(false)
    expect(isAppVersionNewer('1.2.0', '1.2.3')).toBe(false)
  })

  it('parseReleaseChannelManifest reads platform entries', () => {
    const manifest = parseReleaseChannelManifest({
      android: {
        version: '1.2.3',
        tag: 'mobile/v1.2.3',
        downloadUrl: 'https://example.com/a.apk'
      },
      windows: {
        version: '1.2.0',
        tag: 'desktop/v1.2.0',
        downloadUrl: 'https://example.com/w.exe'
      }
    })
    expect(manifest.android?.version).toBe('1.2.3')
    expect(manifest.windows?.artifact).toBe('BaiShou-Windows-Setup.exe')
  })

  it('releaseTagToPageUrl encodes tag', () => {
    expect(releaseTagToPageUrl('mobile/v1.2.3')).toContain('/releases/tag/mobile%2Fv1.2.3')
  })

  it('fetchReleaseChannelManifest falls back to GitHub raw when primary CDN fails', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('CDN unreachable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          windows: {
            version: '1.5.10',
            tag: 'v1.5.10',
            downloadUrl:
              'https://dl.foxletters.com/releases/download/v1.5.10/BaiShou-Windows-Setup.exe'
          }
        })
      })

    const manifest = await fetchReleaseChannelManifest(
      undefined,
      mockFetch as unknown as typeof fetch
    )
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(manifest.windows?.version).toBe('1.5.10')
  })
})
