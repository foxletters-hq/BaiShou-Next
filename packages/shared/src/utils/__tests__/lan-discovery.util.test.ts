import { describe, expect, it } from 'vitest'
import {
  formatLanBackupSizeMb,
  formatLanReceivedBackupContent,
  buildLanServiceName,
  getLanDeviceDedupKey,
  pickBestLanIpv4,
  removeDiscoveredLanDevice,
  resolveDiscoveredLanIpv4,
  upsertDiscoveredLanDevice
} from '../lan-discovery.util'

describe('lan-discovery.util', () => {
  it('prefers private IPv4 from txt records', () => {
    expect(
      resolveDiscoveredLanIpv4({
        txt: { ip: '192.168.1.10' },
        addresses: ['198.18.0.1'],
        host: 'desktop.local'
      })
    ).toBe('192.168.1.10')
  })

  it('falls back to addresses before host', () => {
    expect(
      resolveDiscoveredLanIpv4({
        txt: {},
        addresses: ['192.168.1.20'],
        host: 'desktop.local'
      })
    ).toBe('192.168.1.20')
  })

  it('deduplicates legacy services by host ip and device type', () => {
    const first = {
      deviceId: '',
      nickname: 'BaishouMob',
      ip: '192.168.1.10',
      port: 8080,
      deviceType: 'mobile',
      rawServiceId: 'BaiShou-BaishouMob-1111'
    }
    const second = {
      ...first,
      port: 8081,
      rawServiceId: 'BaiShou-BaishouMob-2222'
    }

    expect(getLanDeviceDedupKey(first)).toBe('host:mobile:192.168.1.10')
    expect(upsertDiscoveredLanDevice([first], second)).toEqual([second])
  })

  it('removes by deviceId or raw service id', () => {
    const devices = [
      {
        deviceId: 'desktop-1',
        nickname: 'PC',
        ip: '192.168.1.5',
        port: 9000,
        deviceType: 'desktop',
        rawServiceId: 'BaiShou-PC-aaaa'
      }
    ]

    expect(removeDiscoveredLanDevice(devices, 'desktop-1')).toEqual([])
    expect(removeDiscoveredLanDevice(devices, 'BaiShou-PC-aaaa')).toEqual([])
  })

  it('builds stable service names from device id suffix', () => {
    expect(buildLanServiceName('DemoUser', 'desktop-12345678-abcd')).toBe('BaiShou-DemoUser-5678abcd')
  })

  it('picks best lan ipv4', () => {
    expect(pickBestLanIpv4(['127.0.0.1', '192.168.1.8', '8.8.8.8'])).toBe('192.168.1.8')
  })

  it('formats received backup content size placeholder', () => {
    expect(formatLanBackupSizeMb(2 * 1024 * 1024)).toBe('2.00')
    expect(
      formatLanReceivedBackupContent('来自局域网设备的数据 ($size MB)。', 2.5 * 1024 * 1024)
    ).toBe('来自局域网设备的数据 (2.50 MB)。')
  })
})
