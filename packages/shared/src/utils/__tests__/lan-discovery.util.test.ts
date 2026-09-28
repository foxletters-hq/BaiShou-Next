import { describe, expect, it } from 'vitest'
import {
  formatLanBackupSizeMb,
  formatLanReceivedBackupContent,
  buildLanServiceName,
  getLanDeviceDedupKey,
  isVirtualLanInterfaceName,
  normalizeLanDeviceType,
  pickBestLanIpv4,
  removeDiscoveredLanDevice,
  resolveDiscoveredLanIpv4,
  upsertDiscoveredLanDevice
} from '../lan-discovery.util'

describe('lan-discovery.util', () => {
  it('prefers private IPv4 from txt records', () => {
    expect(
      resolveDiscoveredLanIpv4({
        txt: { ip: '192.168.31.10' },
        addresses: ['198.18.0.1'],
        host: 'desktop.local'
      })
    ).toBe('192.168.31.10')
  })

  it('falls back to addresses before host', () => {
    expect(
      resolveDiscoveredLanIpv4({
        txt: {},
        addresses: ['192.168.31.20'],
        host: 'desktop.local'
      })
    ).toBe('192.168.31.20')
  })

  it('deduplicates legacy services by host ip and device type', () => {
    const first = {
      deviceId: '',
      nickname: 'BaishouMob',
      ip: '192.168.31.10',
      port: 8080,
      deviceType: 'mobile',
      rawServiceId: 'BaiShou-BaishouMob-1111'
    }
    const second = {
      ...first,
      port: 8081,
      rawServiceId: 'BaiShou-BaishouMob-2222'
    }

    expect(getLanDeviceDedupKey(first)).toBe('host:mobile:192.168.31.10')
    expect(upsertDiscoveredLanDevice([first], second)).toEqual([second])
  })

  it('removes by deviceId or raw service id', () => {
    const devices = [
      {
        deviceId: 'desktop-1',
        nickname: 'PC',
        ip: '192.168.31.5',
        port: 9000,
        deviceType: 'desktop',
        rawServiceId: 'BaiShou-PC-aaaa'
      }
    ]

    expect(removeDiscoveredLanDevice(devices, 'desktop-1')).toEqual([])
    expect(removeDiscoveredLanDevice(devices, 'BaiShou-PC-aaaa')).toEqual([])
  })

  it('builds stable service names from device id suffix', () => {
    expect(buildLanServiceName('Anson', 'desktop-12345678-abcd')).toBe('BaiShou-Anson-5678abcd')
  })

  it('picks best lan ipv4', () => {
    expect(pickBestLanIpv4(['127.0.0.1', '192.168.1.8', '8.8.8.8'])).toBe('192.168.1.8')
  })

  it('prefers 192.168 over docker-like 172.x private ranges', () => {
    expect(pickBestLanIpv4(['172.19.0.1', '192.168.31.42', '10.0.0.5'])).toBe('192.168.31.42')
    expect(pickBestLanIpv4(['172.19.0.1', '10.0.0.5'])).toBe('10.0.0.5')
  })

  it('detects virtual lan interface names', () => {
    expect(isVirtualLanInterfaceName('vEthernet (WSL)')).toBe(true)
    expect(isVirtualLanInterfaceName('docker0')).toBe(true)
    expect(isVirtualLanInterfaceName('WLAN')).toBe(false)
    expect(isVirtualLanInterfaceName('以太网')).toBe(false)
  })

  it('formats received backup content size placeholder', () => {
    expect(formatLanBackupSizeMb(2 * 1024 * 1024)).toBe('2.00')
    expect(
      formatLanReceivedBackupContent('来自局域网设备的数据 ($size MB)。', 2.5 * 1024 * 1024)
    ).toBe('来自局域网设备的数据 (2.50 MB)。')
  })

  it('normalizes lan device type from txt, id prefix, and nickname', () => {
    expect(normalizeLanDeviceType({ txt: { device_type: 'mobile' } })).toBe('mobile')
    expect(normalizeLanDeviceType({ txt: { dtype: 'desktop' } })).toBe('desktop')
    expect(normalizeLanDeviceType({ deviceId: 'mobile-abc' })).toBe('mobile')
    expect(normalizeLanDeviceType({ deviceId: 'desktop-xyz' })).toBe('desktop')
    expect(normalizeLanDeviceType({ nickname: 'BaishouMob' })).toBe('mobile')
    expect(normalizeLanDeviceType({ nickname: 'AnsonPC' })).toBe('desktop')
    expect(normalizeLanDeviceType({ deviceType: 'other', nickname: '客厅平板' })).toBe('other')
  })
})
