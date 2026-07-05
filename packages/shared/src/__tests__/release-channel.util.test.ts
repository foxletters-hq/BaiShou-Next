import { describe, expect, it } from 'vitest'
import {
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
})
