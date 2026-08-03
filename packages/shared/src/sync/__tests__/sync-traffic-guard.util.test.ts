import {
  DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED,
  DEFAULT_SYNC_TRAFFIC_THRESHOLD_BYTES,
  DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB,
  shouldWarnCellularSyncTraffic,
  syncTrafficThresholdMbToBytes
} from '../sync-traffic-guard.util'

describe('sync-traffic-guard.util', () => {
  it('defaults threshold to 50 MB', () => {
    expect(DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED).toBe(true)
    expect(DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB).toBe(50)
    expect(DEFAULT_SYNC_TRAFFIC_THRESHOLD_BYTES).toBe(50 * 1024 * 1024)
    expect(syncTrafficThresholdMbToBytes(50)).toBe(50 * 1024 * 1024)
    expect(syncTrafficThresholdMbToBytes(-1)).toBe(0)
  })

  it('does not warn on Wi-Fi / unknown (isMetered false)', () => {
    expect(
      shouldWarnCellularSyncTraffic({
        enabled: true,
        thresholdBytes: 1024,
        isMetered: false,
        totalUploadBytes: 10_000_000,
        totalDownloadBytes: 10_000_000
      })
    ).toBe(false)
  })

  it('does not warn when feature disabled', () => {
    expect(
      shouldWarnCellularSyncTraffic({
        enabled: false,
        thresholdBytes: 1024,
        isMetered: true,
        totalUploadBytes: 10_000_000,
        totalDownloadBytes: 0
      })
    ).toBe(false)
  })

  it('warns only when metered and over threshold', () => {
    expect(
      shouldWarnCellularSyncTraffic({
        enabled: true,
        thresholdBytes: 50 * 1024 * 1024,
        isMetered: true,
        totalUploadBytes: 12 * 1024 * 1024,
        totalDownloadBytes: 40 * 1024 * 1024
      })
    ).toBe(true)

    expect(
      shouldWarnCellularSyncTraffic({
        enabled: true,
        thresholdBytes: 50 * 1024 * 1024,
        isMetered: true,
        totalUploadBytes: 10 * 1024 * 1024,
        totalDownloadBytes: 40 * 1024 * 1024
      })
    ).toBe(false)
  })
})
