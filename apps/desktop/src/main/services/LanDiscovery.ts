import { Bonjour, Browser } from 'bonjour-service'
import { DiscoveredDevice } from '@baishou/core-desktop'
import {
  getLanDeviceDedupKey,
  lanDevicesEquivalent,
  parseLanTxtIpv4,
  pickBestLanIpv4,
  resolveDiscoveredLanIpv4
} from '@baishou/shared'

/**
 * 负责局域网 mDNS (Bonjour) 服务的广播发布与局域网伙伴嗅探发现。
 */
export class LanDiscovery {
  private bonjour: Bonjour | null = null
  private browser: Browser | null = null
  private publishedService: any = null
  private activeDevices = new Map<string, DiscoveredDevice>()
  private serviceNameToDedupKey = new Map<string, string>()

  private getBonjour(): Bonjour {
    if (!this.bonjour) {
      this.bonjour = new Bonjour()
    }
    return this.bonjour
  }

  public publish(name: string, port: number, txt: Record<string, unknown>) {
    this.unpublish()
    const bj = this.getBonjour()
    const normalizedTxt = Object.fromEntries(
      Object.entries(txt).map(([key, value]) => [key, String(value ?? '')])
    )
    this.publishedService = bj.publish({
      name,
      type: 'baishou',
      protocol: 'tcp',
      port,
      txt: normalizedTxt
    })
    return this.publishedService
  }

  public unpublish() {
    if (this.publishedService) {
      this.publishedService.stop()
      this.publishedService = null
    }
  }

  private parseDevice(service: {
    name: string
    port: number
    txt?: Record<string, unknown>
    addresses?: string[]
    host?: string
  }): DiscoveredDevice {
    const records = (service.txt ?? {}) as Record<string, unknown>
    const txtIps = String(records.ip ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)
    const addressIps = (service.addresses ?? []).filter((addr) => !addr.includes(':'))
    const deviceIp =
      resolveDiscoveredLanIpv4({
        txt: records,
        addresses: [...txtIps, ...addressIps],
        host: service.host
      }) ||
      pickBestLanIpv4([...txtIps, ...addressIps]) ||
      txtIps[0] ||
      addressIps[0] ||
      'Unknown'

    return {
      deviceId: String(records.device_id ?? records.deviceId ?? '').trim(),
      nickname: String(records.nickname ?? service.name),
      ip: deviceIp,
      port: service.port,
      deviceType: (records.device_type as DiscoveredDevice['deviceType']) || 'other',
      rawServiceId: service.name
    }
  }

  private emitDevice(
    device: DiscoveredDevice,
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) {
    const dedupKey = getLanDeviceDedupKey(device)
    const previous = this.activeDevices.get(dedupKey)
    if (previous && lanDevicesEquivalent(previous, device)) return

    if (previous && previous.rawServiceId !== device.rawServiceId) {
      this.serviceNameToDedupKey.delete(previous.rawServiceId)
      onDeviceLost(previous.deviceId || previous.rawServiceId)
    }

    this.activeDevices.set(dedupKey, device)
    this.serviceNameToDedupKey.set(device.rawServiceId, dedupKey)
    onDeviceFound(device)
  }

  private removeDeviceByServiceName(
    serviceName: string,
    onDeviceLost: (deviceId: string) => void
  ) {
    const dedupKey = this.serviceNameToDedupKey.get(serviceName)
    if (!dedupKey) {
      onDeviceLost(serviceName)
      return
    }

    const device = this.activeDevices.get(dedupKey)
    this.activeDevices.delete(dedupKey)
    this.serviceNameToDedupKey.delete(serviceName)
    onDeviceLost(device?.deviceId || serviceName)
  }

  public startDiscovery(
    publishedServiceName: string | null,
    onDeviceFound: (device: DiscoveredDevice) => void,
    onDeviceLost: (deviceId: string) => void
  ) {
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()

    const bj = this.getBonjour()
    this.browser = bj.find({ type: 'baishou' }, (service) => {
      try {
        if (publishedServiceName && service.name === publishedServiceName) {
          return
        }

        const device = this.parseDevice(service)
        if (!parseLanTxtIpv4(service.txt as Record<string, unknown>) && device.ip === 'Unknown') {
          return
        }
        this.emitDevice(device, onDeviceFound, onDeviceLost)
      } catch (e) {
        console.error('Failed to parse mDNS txt string', e)
      }
    })

    this.browser.on('down', (service) => {
      this.removeDeviceByServiceName(service.name, onDeviceLost)
    })
  }

  public stopDiscovery() {
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
    this.activeDevices.clear()
    this.serviceNameToDedupKey.clear()
  }

  public destroy() {
    this.unpublish()
    this.stopDiscovery()
    if (this.bonjour) {
      this.bonjour.destroy()
      this.bonjour = null
    }
  }

  public hasPublishedService(): boolean {
    return !!this.publishedService
  }
}
